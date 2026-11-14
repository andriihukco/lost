#!/usr/bin/env bash
# Rules check for migration 0004: location log, found history, undo. Needs a reset local stack.
set -euo pipefail
API="${API:-http://127.0.0.1:54321}"
ANON="$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (got $2, want $3)"; fail=1; fi; }
signup() { curl -sS -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'; }
f() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
req() { # method path token body -> "CODE BODY"
  curl -sS -X "$1" "$API$2" -H "apikey: $ANON" -H "Authorization: Bearer $3" -H "Content-Type: application/json" \
    -H "Prefer: return=representation" -w "\n%{http_code}" ${4:+-d "$4"} | python3 -c 'import sys; b=sys.stdin.read().rsplit("\n",1); print(b[1], b[0])'; }
code() { echo "$1" | cut -d' ' -f1; }
body() { echo "$1" | cut -d' ' -f2-; }

A=$(signup); ATOK=$(echo "$A" | f '["access_token"]'); AID=$(echo "$A" | f '["user"]["id"]')
supabase db query --local "insert into public.admins (user_id) values ('$AID');" >/dev/null 2>&1
P1=$(signup); P1TOK=$(echo "$P1" | f '["access_token"]'); P1ID=$(echo "$P1" | f '["user"]["id"]')
P2=$(signup); P2TOK=$(echo "$P2" | f '["access_token"]'); P2ID=$(echo "$P2" | f '["user"]["id"]')
req POST /rest/v1/players "$P1TOK" "{\"user_id\":\"$P1ID\",\"nickname\":\"a\",\"avatar\":\"fox\"}" >/dev/null
req POST /rest/v1/players "$P2TOK" "{\"user_id\":\"$P2ID\",\"nickname\":\"b\",\"avatar\":\"bear\"}" >/dev/null

R=$(req POST /rest/v1/treasures "$ATOK" '{"title":"Гриб","lat":49.8,"lng":24.0}'); TID=$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["id"])')

R=$(req POST /rest/v1/location_log "$P1TOK" "{\"user_id\":\"$P1ID\",\"lat\":49.8,\"lng\":24.0,\"accuracy\":5}"); check "player logs own location" "$(code "$R")" "201"
R=$(req POST /rest/v1/location_log "$P1TOK" "{\"user_id\":\"$P2ID\",\"lat\":49.8,\"lng\":24.0}"); check "player cannot log for someone else" "$(code "$R")" "403"
R=$(req GET "/rest/v1/location_log?select=user_id" "$P2TOK"); check "player cannot read others' trails" "$(body "$R")" "[]"
R=$(req GET "/rest/v1/location_log?select=user_id" "$P1TOK"); check "player reads own trail" "$(body "$R" | python3 -c 'import json,sys; print(len(json.loads(sys.stdin.read())))')" "1"

R=$(req POST /rest/v1/rpc/mark_found "$P1TOK" "{\"p_treasure_id\":\"$TID\"}"); check "finder marks found" "$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "won"
R=$(req GET "/rest/v1/found_events?select=action,user_id&treasure_id=eq.$TID" "$P2TOK"); check "history records the found event for everyone" "$(body "$R" | python3 -c 'import json,sys; print([e["action"] for e in json.loads(sys.stdin.read())])')" "['found']"

R=$(req POST /rest/v1/rpc/unmark_found "$P2TOK" "{\"p_treasure_id\":\"$TID\"}"); check "other player cannot send it back" "$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "not_yours"
R=$(req POST /rest/v1/rpc/unmark_found "$P1TOK" "{\"p_treasure_id\":\"$TID\"}"); check "finder sends it back" "$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "unfound"
R=$(req GET "/rest/v1/treasures?select=is_found,found_by&id=eq.$TID" "$P2TOK"); check "treasure is back on the map" "$(body "$R" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read())[0]; print(d["is_found"], d["found_by"])')" "False None"
R=$(req GET "/rest/v1/found_events?select=action&treasure_id=eq.$TID" "$P2TOK"); check "history keeps both actions" "$(body "$R" | python3 -c 'import json,sys; print(sorted(e["action"] for e in json.loads(sys.stdin.read())))')" "['found', 'unfound']"
R=$(req POST /rest/v1/rpc/mark_found "$P2TOK" "{\"p_treasure_id\":\"$TID\"}"); check "another player can claim it again" "$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "won"

[ "$fail" -eq 0 ] && echo "HISTORY RULES OK" || { echo "HISTORY RULES FAILED"; exit 1; }
