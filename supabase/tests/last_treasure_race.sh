#!/usr/bin/env bash
# Review finding F3: two players claim the last two DIFFERENT treasures at once.
# The room must end 'finished'. Repeats N times (default 20); any run that stays 'active' fails.
set -euo pipefail

API="${API:-http://127.0.0.1:54321}"
N="${N:-20}"
ANON="$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
[ -n "$ANON" ] || { echo "could not read ANON_KEY" >&2; exit 2; }

anon_user() {
  curl -sS -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["user"]["id"], d["access_token"])'
}
auth() { echo "Authorization: Bearer $1"; }
# First id from a PostgREST array response; prints the body on failure so the cause is visible.
first_id() { python3 -c 'import json,sys
b=sys.stdin.read()
try:
  print(json.loads(b)[0]["id"])
except Exception:
  sys.stderr.write("unexpected response: "+b[:300]+"\n"); sys.exit(1)'; }

failures=0
for i in $(seq 1 "$N"); do
  read -r HOST_ID HOST_TOK < <(anon_user)
  read -r P1_ID P1_TOK < <(anon_user)
  read -r P2_ID P2_TOK < <(anon_user)
  CODE=$(python3 -c "import random; print(''.join(random.choice('abcdefghjkmnpqrstuvwxyz23456789') for _ in range(6)))")
  ROOM_ID=$(curl -sS -X POST "$API/rest/v1/rooms" -H "apikey: $ANON" -H "$(auth "$HOST_TOK")" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d "{\"code\":\"$CODE\",\"host_id\":\"$HOST_ID\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')
  # Everyone joins as a participant, as the app does (the host joins by link too).
  for pair in "$HOST_TOK:$HOST_ID" "$P1_TOK:$P1_ID" "$P2_TOK:$P2_ID"; do
    tok=${pair%%:*}; uid=${pair##*:}
    curl -sS -o /dev/null -X POST "$API/rest/v1/rpc/join_room_as" -H "apikey: $ANON" -H "$(auth "$tok")" \
      -H "Content-Type: application/json" -d "{\"p_code\":\"$CODE\",\"p_nickname\":\"p\",\"p_color\":\"#ff8800\"}"
  done
  T=()
  for title in a b; do
    BODY=$(python3 -c 'import json,sys; print(json.dumps({"room_id": sys.argv[1], "title": sys.argv[2], "lat": 49.8, "lng": 24.0}))' "$ROOM_ID" "$title")
    T+=("$(curl -sS -X POST "$API/rest/v1/treasures" -H "apikey: $ANON" -H "$(auth "$HOST_TOK")" \
      -H "Content-Type: application/json" -H "Prefer: return=representation" \
      -d "$BODY" | first_id)")
  done
  curl -sS -o /dev/null -X POST "$API/rest/v1/rpc/mark_found" -H "apikey: $ANON" -H "$(auth "$P1_TOK")" \
    -H "Content-Type: application/json" -d "{\"p_treasure_id\":\"${T[0]}\"}" &
  curl -sS -o /dev/null -X POST "$API/rest/v1/rpc/mark_found" -H "apikey: $ANON" -H "$(auth "$P2_TOK")" \
    -H "Content-Type: application/json" -d "{\"p_treasure_id\":\"${T[1]}\"}" &
  wait
  STATUS=$(curl -sS "$API/rest/v1/rooms?id=eq.$ROOM_ID&select=status" -H "apikey: $ANON" -H "$(auth "$HOST_TOK")" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["status"])')
  if [ "$STATUS" != "finished" ]; then failures=$((failures + 1)); echo "run $i: room status $STATUS (expected finished)"; fi
done
echo "last-treasure race: $((N - failures))/$N runs finished"
[ "$failures" -eq 0 ]
