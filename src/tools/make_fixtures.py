"""Write synthetic, non-personal test fixtures to src/export/ (git-ignored).

The data follows the shapes in CLAUDE.md (plan, loads, liftlog, runs, daily, updates,
settings) and contains the elements the Playwright suites look for: a Smith bench on
Day A, a Smith squat first on Day B, a Day B superset, Prep and Finish blocks written as
comma lists, PT-tagged items, past sessions for "Previous" values and personal bests.
Dates are relative to today so the suites keep working.

Usage: python3 src/tools/make_fixtures.py            (writes src/export/<coll>/<id>.json)
       python3 src/tools/make_fixtures.py rows.json  (also saves the rows as one JSON array)

Real data can replace these at any time: export rows from Supabase and run write_fixtures.py.
"""

import datetime
import json
import pathlib
import re
import sys

OUT = pathlib.Path(__file__).resolve().parent.parent / "export"
T = datetime.date.today()
iso = datetime.date.isoformat


def day(offset):
    return T + datetime.timedelta(days=offset)


rows = []


def row(coll, id, data):
    rows.append({"coll": coll, "id": id, "data": data})


# ---- plan: 10 weeks around today, Mon A / Tue B / Wed run + PT / Thu D / Fri C + run / Sat long / Sun soccer
START = -35
first_monday = day(START) - datetime.timedelta(days=day(START).weekday())
for i in range(START, 35):
    d = day(i)
    wd = d.weekday()
    week = (d - first_monday).days // 7 + 1
    long_mi = 4 + week // 2
    p = {"date": iso(d), "phase": "Phase 1", "week": week, "note": ""}
    if wd == 0:
        p["lift"] = "A"
    elif wd == 1:
        p["lift"] = "B"
    elif wd == 2:
        p["run"] = {
            "miles": 3,
            "label": "Easy 3 mi",
            "detail": "HR under 143",
            "long": False,
        }
        p["extra"] = "PT: shrug, T/Y, wall slide, hi/low carry"
    elif wd == 3:
        p["lift"] = "D"
    elif wd == 4:
        p["lift"] = "C"
        p["run"] = {
            "miles": 3,
            "label": "Easy 3 mi",
            "detail": "After Day C",
            "long": False,
        }
    elif wd == 5:
        p["run"] = {
            "miles": long_mi,
            "label": f"Long run {long_mi} mi",
            "detail": "Easy, HR under 143",
            "long": True,
        }
    else:
        p["soccer"] = True
    row("plan", iso(d), p)


# ---- loads: (id, block, name, load, scheme, pt, pattern)
def ex(day_letter, items):
    for order, (id, block, name, load, scheme, pt, pattern) in enumerate(items):
        simple = block in ("Prep", "Finish")
        hist = []
        if not simple and load not in ("BW", "Band"):
            n = float(str(load).rstrip("s").split("/")[0])
            m = re.search(r"x\s*(\d+)", scheme)
            reps = int(m.group(1)) if m else 8
            for k in (3, 2, 1):
                hist.append(
                    {
                        "date": iso(day(-7 * k - 1)),
                        "load": n - 5 * k,
                        "reps": reps,
                        "scheme": scheme,
                    }
                )
        row(
            "loads",
            id,
            {
                "day": day_letter,
                "order": order,
                "block": block,
                "name": name,
                "load": load,
                "scheme": scheme,
                "cue": "",
                "track": not simple,
                "pt": pt,
                "pattern": pattern,
                "tempo": "",
                "hold": "",
                "rest": 90,
                "how": [],
                "why": "",
                "history": hist,
            },
        )


ex(
    "A",
    [
        (
            "a0",
            "Prep",
            "Chin tuck + head tilt 1x5, Band pull-apart 2x15",
            "BW",
            "",
            True,
            "",
        ),
        ("a1", "A1", "Smith bench", "135", "4 x 6", False, "hpress"),
        ("a2", "A2", "Lat pulldown", "120", "3 x 8", False, "vpull"),
        ("a3", "B1", "Smith bent-over row", "95", "3 x 10", False, "hrow"),
        ("a4", "B2", "Dead bug", "BW", "3 x 8/side", False, "antiext"),
        ("a5", "C1", "Incline T/Y", "2.5s", "3 x 12", True, "lowtrap"),
        ("a6", "C2", "Cable face pull", "30", "3 x 15", False, "facepull"),
        ("a9", "C3", "Shrug", "35s", "3 x 10", True, "shrug"),
        (
            "a10",
            "Finish",
            "Dead hang 2x30s, doorway stretch 5x30s, thoracic extension 2x8",
            "BW",
            "",
            False,
            "",
        ),
    ],
)
ex(
    "B",
    [
        (
            "b0",
            "Prep",
            "Chin tuck + head tilt 1x5, Band pull-apart 2x15",
            "BW",
            "",
            True,
            "",
        ),
        ("b1", "A1", "Smith squat", "135", "3 x 8", False, "squat"),
        ("b2", "B1", "Smith calf raise", "90", "3 x 12", False, "calf"),
        ("b3", "B2", "Smith RDL", "155", "3 x 8", False, "hinge"),
        ("b4", "C1", "Cable hip adduction", "25", "3 x 12/side", False, "adductor"),
        ("b6", "C2", "Standing cable leg curl", "20", "3 x 12/side", False, "hamcurl"),
        (
            "b9",
            "Finish",
            "Couch stretch 2x45s/side, Thoracic extension 2x8",
            "BW",
            "",
            False,
            "",
        ),
    ],
)
ex(
    "C",
    [
        (
            "c0",
            "Prep",
            "Chin tuck + head tilt 1x5, Band pull-apart 2x15",
            "BW",
            "",
            True,
            "",
        ),
        ("c1", "A1", "Speed Smith squat", "95", "5 x 3", False, "pwrsquat"),
        ("c2", "A2", "DB reverse lunge", "30s", "3 x 6/side", False, "pwrlunge"),
        ("c3", "B1", "Explosive cable row", "60", "4 x 5", False, "pwrrow"),
        ("c5", "B2", "Cable pull-through", "70", "3 x 10", False, "hipext"),
        ("c7", "C1", "Suitcase carry", "35", "3 x 40 yd/side", True, "carry"),
        (
            "c9",
            "Finish",
            "Couch stretch 2x45s/side, Calf stretch 2x30s/side",
            "BW",
            "",
            False,
            "",
        ),
    ],
)
ex(
    "D",
    [
        ("d1", "A1", "Incline DB press", "50s", "3 x 10", False, "hpress"),
        ("d2", "A2", "Seated cable row", "100", "3 x 12", False, "hrow"),
        ("d3", "B1", "Pull-up", "BW", "3 x 6", False, "vpull"),
        ("d5", "B2", "Reverse fly", "15s", "3 x 15", False, "reardelt"),
        ("d8", "C1", "DB curl", "25s", "3 x 12", False, "biceps"),
        ("d9", "C2", "Cable pushdown", "40", "3 x 12", False, "triceps"),
    ],
)
ex(
    "P",
    [
        ("p1", "A1", "Shrug", "35s", "3 x 10", True, "shrug"),
        ("p2", "A2", "Incline T/Y", "2.5s", "3 x 12", True, "lowtrap"),
        ("p3", "B1", "Banded wall slide", "Band", "3 x 12", True, "lowtrap"),
        ("p4", "B2", "Hi/low carry", "35/15", "5 x 20 yd/side", True, "carry"),
    ],
)

# ---- liftlog: one done session per past lift day in the last 4 weeks
loads_by_day = {}
for r in rows:
    if r["coll"] == "loads":
        loads_by_day.setdefault(r["data"]["day"], []).append(r)
for i in range(-28, 0):
    d = day(i)
    letter = {0: "A", 1: "B", 3: "D", 4: "C"}.get(d.weekday())
    if not letter:
        continue
    exercises = []
    for lr in loads_by_day[letter]:
        L = lr["data"]
        if L["block"] in ("Prep", "Finish"):
            continue
        sets_n = int(L["scheme"].split("x")[0]) if "x" in L["scheme"] else 3
        reps = (
            L["scheme"].split("x")[1].split("/")[0].strip()
            if "x" in L["scheme"]
            else "8"
        )
        exercises.append(
            {
                "id": lr["id"],
                "name": L["name"],
                "block": L["block"],
                "target": L["scheme"],
                "pt": L["pt"],
                "sets": [
                    {"load": L["load"], "reps": reps, "done": True}
                    for _ in range(sets_n)
                ],
            }
        )
    row(
        "liftlog",
        iso(d),
        {
            "date": iso(d),
            "day": letter,
            "status": "done",
            "startedAt": f"{iso(d)}T17:30:00.000Z",
            "notes": "",
            "exercises": exercises,
        },
    )

# ---- runs: every planned run before today, as watch imports
for r in [
    x
    for x in rows
    if x["coll"] == "plan" and "run" in x["data"] and x["data"]["date"] < iso(T)
]:
    d, mi, long = r["data"]["date"], r["data"]["run"]["miles"], r["data"]["run"]["long"]
    row(
        "runs",
        f"hae-{d}-0700",
        {
            "date": d,
            "miles": mi,
            "timeSec": int(mi * 600),
            "avgHR": 138,
            "maxHR": 152,
            "elevFt": 45,
            "long": long,
            "notes": "",
            "source": "watch",
        },
    )

# ---- daily: two weeks of check-ins
for i in range(-14, 0):
    d = iso(day(i))
    row(
        "daily",
        d,
        {
            "date": d,
            "energy": 4,
            "soreness": 2,
            "motivation": 4,
            "sleep": 7.3,
            "hrv": 48,
            "rhr": 58,
            "steps": 9200,
            "weight": 182.4,
        },
    )

# ---- settings and updates
row("settings", "main", {"maxHR": 188, "easyCap": 143, "ref5k": "24:30"})
row(
    "settings",
    "goals",
    {
        "items": [
            {
                "title": "Finish the marathon strong",
                "detail": "May 2027",
                "status": "on track",
            },
            {
                "title": "Run every planned run this month",
                "detail": "",
                "status": "watch",
            },
        ],
        "updated": iso(day(-3)),
    },
)
row(
    "settings",
    "ptDaily",
    {
        "items": [
            {
                "id": "doorway-am",
                "slot": "am",
                "name": "Doorway stretch",
                "dose": "5 x 30 s",
                "target": 1,
                "freq": "Round 1 of 2",
            },
            {
                "id": "pullapart-am",
                "slot": "am",
                "name": "Band pull-apart",
                "dose": "2 x 15",
                "target": 1,
                "freq": "Morning",
            },
            {
                "id": "chintuck-day",
                "slot": "day",
                "name": "Chin tuck and head tilt",
                "dose": "5 reps",
                "target": 5,
                "freq": "Through the day",
            },
            {
                "id": "doorway-pm",
                "slot": "pm",
                "name": "Doorway stretch",
                "dose": "5 x 30 s",
                "target": 1,
                "freq": "Round 2 of 2",
            },
        ],
        "updated": iso(day(-10)),
    },
)
row(
    "settings",
    "coach",
    {
        "reviewedAt": iso(day(-1)),
        "goalsSeen": iso(day(-3)),
        "milestonesSeen": iso(day(-20)),
    },
)
for n, (off, title, detail) in enumerate(
    [
        (
            -1,
            "Long run kept at plan",
            "Last week came in on target and nothing hurts, so the plan stands.",
        ),
        (-3, "Smith squat up 10 lb", "All sets met for two sessions."),
        (
            -8,
            "Watch runs imported",
            "Four runs from the watch export were added with heart rate and climb.",
        ),
    ],
    1,
):
    d = iso(day(off))
    row("updates", f"{d}-{n}", {"date": d, "title": title, "detail": detail})

# ---- program and an answered request
p1 = [("2026-11-02", 10, 4), ("2026-11-09", 11, 5), ("2026-11-16", 13, 6), ("2026-11-23", 12, 6), ("2026-11-30", 15, 7), ("2026-12-07", 18, 8), ("2026-12-14", 21, 9), ("2026-12-21", 25, 10)]
p2 = []
start2 = datetime.date(2026, 12, 28)
for n in range(1, 19):
    s = start2 + datetime.timedelta(days=7 * (n - 1))
    miles = [29, 33, 36, 38, 40, 43, 45, 47, 49, 51, 53, 55, 50, 54, 48, 42, 34, 20][n - 1]
    long = [11, 12, 13, 14, 15, 16, 16, 17, 18, 18, 20, 20, 16, 20, 17, 13, 10, 26][n - 1]
    p2.append({"n": n, "start": iso(s), "miles": miles, "long": long, "sessions": [
        {"day": "Tue", "type": "Lactate threshold", "miles": 8, "detail": "4 mi at threshold pace"},
        {"day": "Thu", "type": "Medium-long run", "miles": 11, "detail": "Steady"},
        {"day": "Sat", "type": "Long run", "miles": long, "detail": "Easy, last 2 mi steady"},
    ]})
row("settings", "program", {
    "phase1": {"start": "2026-10-24", "end": "2026-12-27", "weeks": [{"start": s, "miles": m, "long": l} for s, m, l in p1]},
    "phase2": {"start": "2026-12-28", "race": "2027-05-02", "weeks": p2},
    "tailoring": ["Long runs on Saturday", "Sunday soccer counts as a hard day", "Lifting on Days A, B (trimmed) and D", "Key runs before lifting"],
    "updated": iso(day(-1)),
})
row("requests", "r1", {"created": f"{iso(day(-2))}T18:10:00.000Z", "text": "Swap Smith bench for barbell bench going forward. Equipment: full gym.", "kind": "change",
                       "status": "applied", "reply": "Done. Day A now has barbell bench at 135 for 4 x 6; Smith bench history kept.", "resolvedAt": iso(day(-1)), "attachments": []})

row("settings", "import", {"lastAt": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)).isoformat(), "source": "hae", "runsAdded": 1, "runsUpdated": 0, "days": 1})

# ---- write
for r in rows:
    folder = OUT / r["coll"]
    folder.mkdir(parents=True, exist_ok=True)
    (folder / (r["id"] + ".json")).write_text(json.dumps(r["data"]))
if len(sys.argv) > 1:
    pathlib.Path(sys.argv[1]).write_text(json.dumps(rows))
print(f"wrote {len(rows)} synthetic fixtures to {OUT}")
