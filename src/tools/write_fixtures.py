"""Write test fixtures from a Supabase query result.
Usage: python3 write_fixtures.py rows.json
rows.json is a JSON array of {"coll":..., "id":..., "data":{...}} from:
  select coll, id, data from public.docs where coll in ('plan','loads','liftlog','runs','updates','settings');
Files go to src/export/<coll>/<id>.json (git-ignored; never commit them)."""
import json, sys, pathlib
out = pathlib.Path(__file__).resolve().parent.parent / "export"
rows = json.load(open(sys.argv[1]))
for r in rows:
    d = out / r["coll"]; d.mkdir(parents=True, exist_ok=True)
    (d / (r["id"] + ".json")).write_text(json.dumps(r["data"]))
print("wrote", len(rows), "fixtures to", out)
