// Healthspan: direct watch import.
// Health Auto Export posts its JSON (same shape as the weekly export files) to
//   POST /functions/v1/hae?k=<import key>
// and this function writes daily metrics and runs into public.docs the same way the
// nightly coach used to from Drive. Add ?dry=1 to see what would be written without writing.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

type Row = { coll: string; id: string; data: Record<string, unknown>; version?: number };

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const localDate = (s: string) => String(s || "").slice(0, 10);
const hhmm = (s: string) => String(s || "").slice(11, 16).replace(":", "") || "0000";
const r1 = (n: number) => Math.round(n * 10) / 10;
const toMiles = (qty: number, units: string) => (/km/i.test(units) ? qty / 1.609344 : /^m$|meter/i.test(units) ? qty / 1609.344 : qty);
const toFeet = (qty: number, units: string) => (/^m$|meter/i.test(units) ? qty * 3.28084 : qty);
const toLb = (qty: number, units: string) => (/kg/i.test(units) ? qty * 2.20462 : qty);
const num = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "object" && v && "qty" in (v as Record<string, unknown>)) return num((v as Record<string, unknown>).qty);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const unitsOf = (v: unknown, fallback: string) =>
  v && typeof v === "object" && "units" in (v as Record<string, unknown>) ? String((v as Record<string, unknown>).units) : fallback;

// metric name -> daily field and a transform
const METRICS: Record<string, [string, (item: Record<string, unknown>, units: string) => number | null]> = {
  resting_heart_rate: ["rhr", (i) => (num(i.qty) == null ? null : Math.round(num(i.qty)!))],
  heart_rate_variability: ["hrv", (i) => (num(i.qty) == null ? null : Math.round(num(i.qty)!))],
  sleep_analysis: ["sleep", (i) => {
    // Apple sleep stages leave "asleep" at 0 and put the night in totalSleep or in core + deep + rem
    const pos = (x: number | null) => (x != null && x > 0 ? x : null);
    const stages = [i.core, i.deep, i.rem].map(num).filter((x): x is number => x != null && x > 0);
    const v = pos(num(i.totalSleep)) ?? pos(num(i.asleep)) ?? pos(stages.length ? stages.reduce((a, b) => a + b, 0) : null) ?? pos(num(i.qty));
    return v == null ? null : r1(v);
  }],
  weight_body_mass: ["weight", (i, u) => (num(i.qty) == null ? null : r1(toLb(num(i.qty)!, u)))],
  vo2_max: ["vo2", (i) => (num(i.qty) == null ? null : r1(num(i.qty)!))],
  step_count: ["steps", (i) => (num(i.qty) == null ? null : Math.round(num(i.qty)!))],
};

// Sleep sent as raw stage samples (one item per Core / Deep / REM / Awake stretch, no totalSleep) instead of one
// summary per night: add the asleep stages up per night. A night belongs to the date it ends on; a stretch that
// ends in the evening (after 6 PM) belongs to the next morning's night.
const isSegment = (i: Record<string, unknown>) =>
  i.totalSleep == null && i.core == null && (i.value != null || i.stage != null || i.endDate != null || i.end != null);
function nightOf(end: string): string | null {
  const d = localDate(end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (Number(end.slice(11, 13)) < 18) return d;
  const n = new Date(d + "T12:00:00Z");
  n.setUTCDate(n.getUTCDate() + 1);
  return n.toISOString().slice(0, 10);
}
function sleepFromSegments(items: Array<Record<string, unknown>>, units: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    if (!isSegment(i)) continue;
    const stage = String(i.value ?? i.stage ?? "");
    if (!/core|deep|rem|asleep/i.test(stage)) continue; // awake and in-bed time are not sleep
    const end = String(i.endDate ?? i.end ?? i.date ?? "");
    const night = nightOf(end);
    let h = num(i.qty);
    if (h == null) {
      const a = Date.parse(String(i.startDate ?? i.start ?? "").replace(" ", "T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2"));
      const b = Date.parse(end.replace(" ", "T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2"));
      h = Number.isFinite(a) && Number.isFinite(b) ? (b - a) / 3600000 : null;
    } else if (/min/i.test(units)) h = h / 60;
    else if (/^s|sec/i.test(units)) h = h / 3600;
    if (!night || h == null || h <= 0) continue;
    out[night] = (out[night] || 0) + h;
  }
  return out;
}

async function ownerId(): Promise<string> {
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 10 });
  if (error) throw error;
  const users = (data.users || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (!users.length) throw new Error("no owner");
  return users[0].id;
}

async function fetchRows(coll: string, ids?: string[]): Promise<Row[]> {
  let q = sb.from("docs").select("coll,id,data,version").eq("coll", coll);
  if (ids && ids.length) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Row[];
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const url = new URL(req.url);
  const key = url.searchParams.get("k") || req.headers.get("x-hae-key") || "";
  const { data: expected, error: kerr } = await sb.rpc("fp_secret", { n: "hae_key" });
  if (kerr || !expected || key !== expected) return json({ ok: false, error: "bad key" }, 401);
  const dry = url.searchParams.get("dry") === "1";

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "body must be JSON" }, 400);
  }
  const data = (payload.data || payload) as Record<string, unknown>;
  const metrics = (data.metrics || []) as Array<Record<string, unknown>>;
  const workouts = (data.workouts || []) as Array<Record<string, unknown>>;

  // ---- daily metrics: fill only empty fields
  const dailyPatch: Record<string, Record<string, unknown>> = {};
  let sleepSample: Record<string, unknown> | null = null; // shape of the sleep items, kept in settings/import so a wrong number can be traced
  for (const m of metrics) {
    const spec = METRICS[String(m.name || "")];
    if (!spec) continue;
    const [field, fn] = spec;
    const units = String(m.units || "");
    if (field === "sleep") {
      const items = (m.data || []) as Array<Record<string, unknown>>;
      sleepSample = { n: items.length, keys: Object.keys(items[0] || {}).sort(), units };
      for (const [d, h] of Object.entries(sleepFromSegments(items, units))) {
        (dailyPatch[d] ||= {}).sleep = Math.max(Number(dailyPatch[d].sleep || 0), r1(h));
      }
    }
    for (const item of (m.data || []) as Array<Record<string, unknown>>) {
      if (field === "sleep" && isSegment(item)) continue;
      const d = localDate(String(item.date || ""));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const v = fn(item, units);
      if (v == null) continue;
      (dailyPatch[d] ||= {})[field] = field === "steps" ? Number(dailyPatch[d][field] || 0) + v : field === "sleep" ? Math.max(Number(dailyPatch[d][field] || 0), v) : v; // steps arrive as samples: add them up per day
    }
  }
  const dayIds = Object.keys(dailyPatch);
  const existingDaily = dayIds.length ? await fetchRows("daily", dayIds) : [];
  const dailyWrites: Row[] = [];
  for (const d of dayIds) {
    const have = existingDaily.find((r) => r.id === d);
    const cur = (have?.data || { date: d }) as Record<string, unknown>;
    const next = { ...cur };
    let changed = false;
    for (const [k, v] of Object.entries(dailyPatch[d])) {
      if (k === "steps" || k === "sleep") {
        // partial exports can re-send a day (a sync at 3 AM sends half a night): keep the largest total seen for that day
        const cur = Number(next[k] || 0);
        if (Number(v) > cur) { next[k] = v; changed = true; }
      } else if (next[k] == null || next[k] === "") {
        next[k] = v;
        changed = true;
      }
    }
    if (!have || changed) dailyWrites.push({ coll: "daily", id: d, data: next });
  }

  // ---- workouts: runs, plus extra soccer notes
  const runs = workouts.filter((w) => /run/i.test(String(w.name || "")));
  const soccer = workouts.filter((w) => /soccer|football/i.test(String(w.name || "")));
  const runDates = [...new Set(runs.map((w) => localDate(String(w.start || ""))))];
  const existingRuns = (await fetchRows("runs")).filter((r) => runDates.includes(String(r.data.date || "")));
  const planRows = runDates.length || soccer.length ? await fetchRows("plan", [...runDates, ...soccer.map((w) => localDate(String(w.start || "")))]) : [];
  const runWrites: Row[] = [];
  const runUpdates: Row[] = [];
  for (const w of runs) {
    const start = String(w.start || "");
    const date = localDate(start);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const miles = r1(toMiles(num(w.distance) ?? 0, unitsOf(w.distance, "mi")));
    const dur = num(w.duration);
    const timeSec = dur == null ? null : Math.round(dur > 36000 ? dur / 1000 : dur);
    const hr = (w.heartRate || {}) as Record<string, unknown>;
    const avgHR = num(hr.avg) ?? num(w.avgHeartRate) ?? num(w.averageHeartRate);
    const maxHR = num(hr.max) ?? num(w.maxHeartRate);
    const elevRaw = (w.elevation as Record<string, unknown> | undefined)?.ascent ?? w.elevationUp ?? w.elevationAscended;
    const elevFt = elevRaw == null ? null : Math.round(toFeet(num(elevRaw) ?? 0, unitsOf(elevRaw, "m")));
    const plan = planRows.find((p) => p.id === date);
    const planRun = (plan?.data as Record<string, unknown> | undefined)?.run as Record<string, unknown> | undefined;
    const startMin = Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16));
    // a run he marked done by hand ("ran it, fill in from my watch"): take the watch numbers wholesale
    const placeholder = existingRuns.find((r) => {
      const rd = r.data as Record<string, unknown>;
      return String(rd.date) === date && rd.awaitWatch === true;
    });
    if (placeholder) {
      const rd = { ...(placeholder.data as Record<string, unknown>) };
      Object.assign(rd, { miles, timeSec, avgHR, maxHR, elevFt, startedAt: start, awaitWatch: false, source: "watch", filledFrom: "hae" });
      runUpdates.push({ coll: "runs", id: placeholder.id, data: rd, version: placeholder.version });
      Object.assign(placeholder.data as Record<string, unknown>, rd); // so a second run that day is matched against the real numbers, not the plan
      continue;
    }
    const twin = existingRuns.find((r) => {
      const rd = r.data as Record<string, unknown>;
      if (String(rd.date) !== date) return false;
      if (Math.abs(Number(rd.miles || 0) - miles) > 0.3) return false;
      const rs = String(rd.startedAt || rd.start || "");
      if (!rs) return true; // a hand-logged run with no clock time on the same day and distance is the same run
      const rm = Number(rs.slice(11, 13)) * 60 + Number(rs.slice(14, 16));
      return Math.abs(rm - startMin) <= 30;
    });
    if (twin) {
      const rd = { ...(twin.data as Record<string, unknown>) };
      let changed = false;
      for (const [k, v] of Object.entries({ avgHR, maxHR, elevFt, timeSec }) as Array<[string, number | null]>) {
        if (v != null && (rd[k] == null || rd[k] === "")) {
          rd[k] = v;
          changed = true;
        }
      }
      if (changed) runUpdates.push({ coll: "runs", id: twin.id, data: rd, version: twin.version });
      continue;
    }
    const id = `hae-${date}-${hhmm(start)}`;
    if (existingRuns.some((r) => r.id === id)) continue;
    runWrites.push({
      coll: "runs",
      id,
      data: {
        date, miles, timeSec, avgHR, maxHR, elevFt, startedAt: start,
        long: !!(planRun && planRun.long), notes: "", source: "watch",
      },
    });
    existingRuns.push({ coll: "runs", id, data: { date, miles, startedAt: start } });
  }
  const soccerNotes: Row[] = [];
  const soccerDates = [...new Set(soccer.map((w) => localDate(String(w.start || ""))))].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !dayIds.includes(d));
  if (soccerDates.length) existingDaily.push(...(await fetchRows("daily", soccerDates)));
  const putDaily = (date: string, next: Record<string, unknown>) => {
    const idx = dailyWrites.findIndex((r) => r.id === date);
    if (idx >= 0) dailyWrites[idx].data = next;
    else { const j = soccerNotes.findIndex((r) => r.id === date); if (j >= 0) soccerNotes[j].data = next; else soccerNotes.push({ coll: "daily", id: date, data: next }); }
  };
  for (const w of soccer) {
    const date = localDate(String(w.start || ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const plan = planRows.find((p) => p.id === date);
    const have = dailyWrites.find((r) => r.id === date) || soccerNotes.find((r) => r.id === date) || existingDaily.find((r) => r.id === date);
    const cur = (have?.data || { date }) as Record<string, unknown>;
    if (plan && (plan.data as Record<string, unknown>).soccer) {
      if (cur.soccer === true) continue; // already checked off in the app
      putDaily(date, { ...cur, soccer: true });
      continue;
    }
    if (cur.note) continue;
    putDaily(date, { ...cur, note: "Extra soccer (from the watch)" });
  }

  const summary = {
    ok: true, dry,
    days: dailyWrites.length + soccerNotes.length,
    runsAdded: runWrites.length, runsUpdated: runUpdates.length,
    metricsSeen: metrics.map((m) => m.name), workoutsSeen: workouts.length,
  };
  if (dry) return json({ ...summary, dailyWrites, runWrites, runUpdates, soccerNotes });

  const owner = await ownerId();
  const upserts = [...dailyWrites, ...soccerNotes, ...runWrites].map((r) => ({ owner, coll: r.coll, id: r.id, data: r.data }));
  if (upserts.length) {
    const { error } = await sb.from("docs").upsert(upserts, { onConflict: "coll,id" });
    if (error) return json({ ok: false, error: error.message }, 500);
  }
  for (const r of runUpdates) {
    const { error } = await sb.from("docs").update({ data: r.data }).eq("coll", "runs").eq("id", r.id);
    if (error) return json({ ok: false, error: error.message }, 500);
  }
  const stamp = { lastAt: new Date().toISOString(), source: "hae", runsAdded: runWrites.length, runsUpdated: runUpdates.length, days: summary.days, ...(sleepSample ? { sleepShape: sleepSample } : {}) };
  await sb.from("docs").upsert([{ owner, coll: "settings", id: "import", data: stamp }], { onConflict: "coll,id" });
  return json(summary);
});
