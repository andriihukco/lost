#!/usr/bin/env bash
# Race check (spec §12, plan Task 6 step 4): two players call mark_found on the same
# treasure at the same moment. Expect exactly one "won" and one "taken".
# Requires `supabase start`. Uses the real REST/Auth endpoints with JWTs, not SQL shortcuts.
set -euo pipefail

API="${API:-http://127.0.0.1:54321}"
ANON="$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
[ -n "$ANON" ] || { echo "could not read ANON_KEY from supabase status" >&2; exit 2; }
WORK="$(mktemp -d)"

anon_user() {  # prints "<user_id> <access_token>"
  curl -sS -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["user"]["id"], d["access_token"])'
}
read -r HOST_ID HOST_TOK < <(anon_user)
read -r P1_ID P1_TOK < <(anon_user)
read -r P2_ID P2_TOK < <(anon_user)

auth() { echo "Authorization: Bearer $1"; }

CODE=$(python3 -c "import random; print(''.join(random.choice('abcdefghjkmnpqrstuvwxyz23456789') for _ in range(6)))")
ROOM_ID=$(curl -sS -X POST "$API/rest/v1/rooms" -H "apikey: $ANON" -H "$(auth "$HOST_TOK")" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"code\":\"$CODE\",\"host_id\":\"$HOST_ID\",\"name\":\"race\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')

for pair in "$HOST_TOK:$HOST_ID" "$P1_TOK:$P1_ID" "$P2_TOK:$P2_ID"; do
  tok=${pair%%:*}; uid=${pair##*:}
  curl -sS -o /dev/null -w "participant %{http_code}\n" -X POST "$API/rest/v1/participants" \
    -H "apikey: $ANON" -H "$(auth "$tok")" -H "Content-Type: application/json" \
    -d "{\"room_id\":\"$ROOM_ID\",\"user_id\":\"$uid\",\"nickname\":\"p\",\"color\":\"#ff8800\"}"
done

TREASURE_ID=$(curl -sS -X POST "$API/rest/v1/treasures" -H "apikey: $ANON" -H "$(auth "$HOST_TOK")" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"room_id\":\"$ROOM_ID\",\"title\":\"race\",\"lat\":49.8419,\"lng\":24.0315}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')

call() {  # $1 = token, $2 = output file
  curl -sS -X POST "$API/rest/v1/rpc/mark_found" -H "apikey: $ANON" -H "$(auth "$1")" \
    -H "Content-Type: application/json" -d "{\"p_treasure_id\":\"$TREASURE_ID\"}" > "$2" &
}
call "$P1_TOK" "$WORK/p1.json"
call "$P2_TOK" "$WORK/p2.json"
wait

cat "$WORK/p1.json"; echo
cat "$WORK/p2.json"; echo
python3 - "$WORK/p1.json" "$WORK/p2.json" <<'PY'
import json, sys
statuses = sorted(json.load(open(p))["status"] for p in sys.argv[1:])
assert statuses == ["taken", "won"], f"expected one won and one taken, got {statuses}"
print("RACE OK:", statuses)
PY
