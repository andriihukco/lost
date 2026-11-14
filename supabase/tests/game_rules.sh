#!/usr/bin/env bash
# Rules check against a running local stack (after `supabase db reset`).
# Covers: players onboard, only admins place treasures, only players claim, first claim wins.
set -euo pipefail
API="${API:-http://127.0.0.1:54321}"
ANON="$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (got $2, want $3)"; fail=1; fi; }

signup() { curl -sS -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'; }
tok_of() { python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'; }
uid_of() { python3 -c 'import json,sys; print(json.load(sys.stdin)["user"]["id"])'; }
req() { # method path token body -> "HTTP_CODE BODY"
  curl -sS -X "$1" "$API$2" -H "apikey: $ANON" -H "Authorization: Bearer $3" -H "Content-Type: application/json" \
    -H "Prefer: return=representation" -w "\n%{http_code}" ${4:+-d "$4"} | python3 -c 'import sys; b=sys.stdin.read().rsplit("\n",1); print(b[1], b[0])'
}
code_of() { echo "$1" | cut -d' ' -f1; }

ADMIN_JSON=$(signup); ADMIN_TOK=$(echo "$ADMIN_JSON" | tok_of); ADMIN_ID=$(echo "$ADMIN_JSON" | uid_of)
P1_JSON=$(signup); P1_TOK=$(echo "$P1_JSON" | tok_of); P1_ID=$(echo "$P1_JSON" | uid_of)
P2_JSON=$(signup); P2_TOK=$(echo "$P2_JSON" | tok_of); P2_ID=$(echo "$P2_JSON" | uid_of)
GUEST_JSON=$(signup); GUEST_TOK=$(echo "$GUEST_JSON" | tok_of)

supabase db query --local "insert into public.admins (user_id) values ('$ADMIN_ID');" >/dev/null 2>&1

check "guest (no player row) cannot claim" "$(code_of "$(req POST /rest/v1/rpc/mark_found "$GUEST_TOK" '{"p_treasure_id":"00000000-0000-0000-0000-000000000000"}')")" "200"
R=$(req POST /rest/v1/players "$P1_TOK" "{\"user_id\":\"$P1_ID\",\"nickname\":\"Лис\",\"avatar\":\"fox\"}"); check "player saves onboarding" "$(code_of "$R")" "201"
R=$(req POST /rest/v1/players "$P2_TOK" "{\"user_id\":\"$P2_ID\",\"nickname\":\"Ведмідь\",\"avatar\":\"bear\"}"); check "second player saves onboarding" "$(code_of "$R")" "201"
R=$(req POST /rest/v1/players "$P1_TOK" "{\"user_id\":\"$P1_ID\",\"nickname\":\"x\",\"avatar\":\"dragon\"}"); check "unknown avatar rejected" "$(code_of "$R")" "400"
R=$(req POST /rest/v1/players "$P1_TOK" "{\"user_id\":\"$P2_ID\",\"nickname\":\"x\",\"avatar\":\"fox\"}"); check "cannot write another player's row" "$(code_of "$R")" "403"

R=$(req POST /rest/v1/treasures "$P1_TOK" '{"title":"x","lat":49.8,"lng":24.0}'); check "player cannot place a treasure" "$(code_of "$R")" "403"
R=$(req POST /rest/v1/treasures "$ADMIN_TOK" '{"title":"Скарб 1","lat":49.8421,"lng":24.0318}'); check "admin places a treasure" "$(code_of "$R")" "201"
TID=$(echo "$R" | cut -d' ' -f2- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["id"])')

R=$(req GET "/rest/v1/treasures?select=id,title" "$P1_TOK"); check "player sees treasures" "$(code_of "$R")" "200"
R=$(req GET "/rest/v1/players?select=nickname" "$P2_TOK"); check "player sees other players" "$(code_of "$R")" "200"

R=$(req POST /rest/v1/rpc/mark_found "$P1_TOK" "{\"p_treasure_id\":\"$TID\"}"); check "first claim wins" "$(echo "$R" | cut -d' ' -f2- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "won"
R=$(req POST /rest/v1/rpc/mark_found "$P2_TOK" "{\"p_treasure_id\":\"$TID\"}"); check "second claim is taken" "$(echo "$R" | cut -d' ' -f2- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "taken"
R=$(req POST /rest/v1/rpc/mark_found "$GUEST_TOK" "{\"p_treasure_id\":\"$TID\"}"); check "guest claim is not_player" "$(echo "$R" | cut -d' ' -f2- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["status"])')" "not_player"

R=$(req POST /rest/v1/treasures "$ADMIN_TOK" '{"title":"Скарб 2","lat":49.8405,"lng":24.0340}'); T2=$(echo "$R" | cut -d' ' -f2- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["id"])')
R=$(req PATCH "/rest/v1/treasures?id=eq.$T2" "$P1_TOK" '{"title":"hack"}'); check "player cannot edit a treasure" "$(code_of "$R")" "200"
R=$(req GET "/rest/v1/treasures?id=eq.$T2&select=title" "$P1_TOK"); check "player edit was a no-op" "$(echo "$R" | cut -d' ' -f2- | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["title"])')" "Скарб 2"

[ "$fail" -eq 0 ] && echo "ALL RULES OK" || { echo "RULES FAILED"; exit 1; }
