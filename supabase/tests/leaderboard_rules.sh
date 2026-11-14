#!/usr/bin/env bash
# Rules check for migration 0006: place events, leaderboard, admin player list and removal. Needs a reset local stack.
set -euo pipefail
supabase db reset >/dev/null 2>&1
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
jq1() { echo "$1" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print($2)"; }

A=$(signup); ATOK=$(echo "$A" | f '["access_token"]'); AID=$(echo "$A" | f '["user"]["id"]')
supabase db query --local "insert into public.admins (user_id) values ('$AID');" >/dev/null 2>&1
P1=$(signup); P1TOK=$(echo "$P1" | f '["access_token"]'); P1ID=$(echo "$P1" | f '["user"]["id"]')
P2=$(signup); P2TOK=$(echo "$P2" | f '["access_token"]'); P2ID=$(echo "$P2" | f '["user"]["id"]')
req POST /rest/v1/players "$P1TOK" "{\"user_id\":\"$P1ID\",\"nickname\":\"Хитра Лисиця\",\"avatar\":\"fox\"}" >/dev/null
req POST /rest/v1/players "$P2TOK" "{\"user_id\":\"$P2ID\",\"nickname\":\"Сильний Ведмідь\",\"avatar\":\"bear\"}" >/dev/null
R=$(req POST /rest/v1/treasures "$ATOK" '{"title":"Гриб","lat":49.8,"lng":24.0}'); TID=$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["id"])')

R=$(req POST /rest/v1/rpc/mark_place "$P1TOK" "{\"p_treasure_id\":\"$TID\"}"); check "first player marks the place" "$(jq1 "$(body "$R")" 'd["status"]')" "placed"
R=$(req POST /rest/v1/rpc/mark_place "$P1TOK" "{\"p_treasure_id\":\"$TID\"}"); check "marking the place twice is harmless" "$(jq1 "$(body "$R")" 'd["status"]')" "placed"
R=$(req POST /rest/v1/rpc/mark_place "$P2TOK" "{\"p_treasure_id\":\"$TID\"}"); check "second player also marks the place" "$(jq1 "$(body "$R")" 'd["status"]')" "placed"
R=$(req GET "/rest/v1/found_events?select=user_id&treasure_id=eq.$TID&action=eq.place" "$ATOK"); check "one place event per player per treasure" "$(jq1 "$(body "$R")" 'len(d)')" "2"

R=$(req POST /rest/v1/rpc/leaderboard "$P1TOK" "{}")
check "leaderboard lists every player" "$(jq1 "$(body "$R")" 'len(d)')" "2"
check "first to the place gets the first-place point" "$(jq1 "$(body "$R")" 'sorted([(r["nickname"], r["first_places"]) for r in d])')" "[('Сильний Ведмідь', 0), ('Хитра Лисиця', 1)]"

R=$(req POST /rest/v1/rpc/mark_found "$P2TOK" "{\"p_treasure_id\":\"$TID\"}"); check "player claims the treasure" "$(jq1 "$(body "$R")" 'd["status"]')" "won"
R=$(req POST /rest/v1/rpc/leaderboard "$P1TOK" "{}")
check "first to the treasure gets the first-find point" "$(jq1 "$(body "$R")" 'sorted([(r["nickname"], r["first_finds"], r["finds"]) for r in d])')" "[('Сильний Ведмідь', 1, 1), ('Хитра Лисиця', 0, 0)]"
R=$(req POST /rest/v1/rpc/mark_place "$P1TOK" "{\"p_treasure_id\":\"$TID\"}"); check "no place marking after the treasure is found" "$(jq1 "$(body "$R")" 'd["status"]')" "not_found"

R=$(req POST /rest/v1/rpc/admin_players "$P1TOK" "{}"); check "player cannot list all players' locations" "$(code "$R")" "403"
R=$(req POST /rest/v1/location_log "$P1TOK" "{\"user_id\":\"$P1ID\",\"lat\":49.81,\"lng\":24.01,\"accuracy\":5}"); check "player logs a position" "$(code "$R")" "201"
R=$(req POST /rest/v1/rpc/admin_players "$ATOK" "{}"); check "admin sees both players" "$(jq1 "$(body "$R")" 'len(d)')" "2"
check "admin sees the last position of a player" "$(jq1 "$(body "$R")" 'sorted([(r["nickname"], r["lat"] is not None) for r in d])')" "[('Сильний Ведмідь', False), ('Хитра Лисиця', True)]"

R=$(req POST /rest/v1/rpc/admin_remove_player "$P1TOK" "{\"p_user_id\":\"$P2ID\"}"); check "player cannot remove another player" "$(code "$R")" "403"
R=$(req POST /rest/v1/rpc/admin_remove_player "$ATOK" "{\"p_user_id\":\"$P2ID\"}"); check "admin removes a player" "$(body "$R")" "true"
R=$(req GET "/rest/v1/players?select=user_id" "$ATOK"); check "removed player is gone" "$(jq1 "$(body "$R")" 'len(d)')" "1"
R=$(req POST /rest/v1/rpc/leaderboard "$P1TOK" "{}"); check "leaderboard no longer lists the removed player" "$(jq1 "$(body "$R")" 'len(d)')" "1"

if [ "$fail" -eq 0 ]; then echo "ALL OK"; else echo "SOME FAILED"; exit 1; fi
