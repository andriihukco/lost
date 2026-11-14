#!/usr/bin/env bash
# Concurrency check: two players claim the same treasure at the same moment.
# Expect exactly one "won" and one "taken". Requires `supabase start` and a reset database.
set -euo pipefail
API="${API:-http://127.0.0.1:54321}"
ANON="$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
[ -n "$ANON" ] || { echo "could not read ANON_KEY" >&2; exit 2; }
WORK="$(mktemp -d)"

signup() { curl -sS -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'; }
field() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

ADMIN=$(signup); ADMIN_TOK=$(echo "$ADMIN" | field '["access_token"]'); ADMIN_ID=$(echo "$ADMIN" | field '["user"]["id"]')
supabase db query --local "insert into public.admins (user_id) values ('$ADMIN_ID');" >/dev/null 2>&1

TID=$(curl -sS -X POST "$API/rest/v1/treasures" -H "apikey: $ANON" -H "Authorization: Bearer $ADMIN_TOK" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"title":"race","lat":49.8419,"lng":24.0315}' | field '[0]["id"]')

for n in 1 2; do
  U=$(signup); TOK=$(echo "$U" | field '["access_token"]'); UID_=$(echo "$U" | field '["user"]["id"]')
  echo "$TOK" > "$WORK/tok$n"
  curl -sS -o /dev/null -w "player $n onboarding %{http_code}\n" -X POST "$API/rest/v1/players" -H "apikey: $ANON" \
    -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$UID_\",\"nickname\":\"p$n\",\"avatar\":\"fox\"}"
done

claim() { curl -sS -X POST "$API/rest/v1/rpc/mark_found" -H "apikey: $ANON" -H "Authorization: Bearer $(cat "$WORK/tok$1")" \
  -H "Content-Type: application/json" -d "{\"p_treasure_id\":\"$TID\"}" > "$WORK/p$1.json"; }
claim 1 & claim 2 & wait

cat "$WORK/p1.json"; echo; cat "$WORK/p2.json"; echo
python3 - "$WORK/p1.json" "$WORK/p2.json" <<'PY'
import json, sys
statuses = sorted(json.load(open(p))["status"] for p in sys.argv[1:])
assert statuses == ["taken", "won"], f"expected one won and one taken, got {statuses}"
print("RACE OK:", statuses)
PY
