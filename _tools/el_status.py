"""Print the ElevenLabs subscription status (never prints the key)."""
import json
import os
import urllib.request

key = os.environ.get("ELEVENLABS_API_KEY")
if not key:
    raise SystemExit("ELEVENLABS_API_KEY is not set")
req = urllib.request.Request("https://api.elevenlabs.io/v1/user/subscription", headers={"xi-api-key": key})
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.loads(r.read().decode("utf-8"))
keep = {k: v for k, v in data.items() if not isinstance(v, (list, dict))}
print(json.dumps(keep, indent=2))
for k in ("next_invoice", "open_invoices", "billing_period", "character_refresh_period"):
    if k in data:
        print(k, json.dumps(data[k])[:600])
