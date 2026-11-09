// Healthspan: web push.
//   POST /functions/v1/push/subscribe   body {subscription, ua}, Authorization: Bearer <the owner's session token>
//   POST /functions/v1/push/send        body {title, body, url?, tag?}, header x-push-key: <push key from Vault>
//   POST /functions/v1/push/setup       generates the VAPID key pair once and stores it in Vault (no-op after that)
//   GET  /functions/v1/push/vapid       returns the VAPID public key the app subscribes with
// Subscriptions live in public.docs as coll "push". Keys live in Supabase Vault, read through fp_secret().
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-push-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

async function secret(n: string): Promise<string | null> {
  const { data, error } = await sb.rpc("fp_secret", { n });
  if (error) throw error;
  return data ? String(data) : null;
}
const hash = async (s: string) => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
};
async function ensureVapid(): Promise<string> {
  const pub = await secret("vapid_public");
  const prv = await secret("vapid_private");
  if (pub && prv) return pub;
  const keys = webpush.generateVAPIDKeys();
  const a = await sb.rpc("fp_set_secret", { n: "vapid_public", v: keys.publicKey });
  const b = await sb.rpc("fp_set_secret", { n: "vapid_private", v: keys.privateKey });
  if (a.error || b.error) throw new Error("could not store VAPID keys");
  return keys.publicKey;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const route = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();
  try {
    if (route === "setup" && req.method === "POST") {
      await ensureVapid();
      return json({ ok: true });
    }
    if (route === "vapid" && req.method === "GET") {
      return json({ ok: true, publicKey: await ensureVapid() });
    }
    if (route === "subscribe" && req.method === "POST") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u, error } = await sb.auth.getUser(token);
      if (error || !u?.user) return json({ ok: false, error: "sign in first" }, 401);
      const { subscription, ua } = await req.json();
      if (!subscription?.endpoint || !subscription?.keys?.p256dh) return json({ ok: false, error: "bad subscription" }, 400);
      const id = await hash(subscription.endpoint);
      const { error: e2 } = await sb.from("docs").upsert(
        [{ owner: u.user.id, coll: "push", id, data: { endpoint: subscription.endpoint, keys: subscription.keys, ua: String(ua || "").slice(0, 120), created: new Date().toISOString() } }],
        { onConflict: "coll,id" },
      );
      if (e2) return json({ ok: false, error: e2.message }, 500);
      return json({ ok: true, id });
    }
    if (route === "send" && req.method === "POST") {
      const key = req.headers.get("x-push-key") || "";
      const expected = await secret("push_key");
      if (!key || !expected || key !== expected) return json({ ok: false, error: "bad key" }, 401);
      const { title, body, url, tag } = await req.json();
      if (!title) return json({ ok: false, error: "title required" }, 400);
      const pub = await ensureVapid();
      const prv = await secret("vapid_private");
      webpush.setVapidDetails("mailto:owner@healthspan.app", pub, prv!);
      const { data: subs, error } = await sb.from("docs").select("id,data").eq("coll", "push");
      if (error) return json({ ok: false, error: error.message }, 500);
      const payload = JSON.stringify({ title: String(title).slice(0, 80), body: String(body || "").slice(0, 240), url: url || "./", tag: tag || "healthspan" });
      let sent = 0, dropped = 0;
      for (const s of subs || []) {
        const d = s.data as { endpoint: string; keys: { p256dh: string; auth: string } };
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys }, payload, { TTL: 3600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await sb.from("docs").delete().eq("coll", "push").eq("id", s.id);
            dropped++;
          }
        }
      }
      return json({ ok: true, sent, dropped, total: (subs || []).length });
    }
    return json({ ok: false, error: "unknown route" }, 404);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
