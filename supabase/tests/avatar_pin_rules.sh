#!/usr/bin/env bash
# Rules for migration 0005: one animal per player; pin emoji set by admins. Needs a reset local stack.
set -euo pipefail
# Local test data only: start from a clean database (players may use one animal each).
supabase db reset >/dev/null 2>&1
API="${API:-http://127.0.0.1:54321}"
ANON="$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (got $2, want $3)"; fail=1; fi; }
signup() { curl -sS -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'; }
f() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
code() { curl -sS -o /dev/null -w "%{http_code}" -X "$1" "$API$2" -H "apikey: $ANON" -H "Authorization: Bearer $3" -H "Content-Type: application/json" -H "Prefer: return=representation" ${4:+-d "$4"}; }

A=$(signup); AT=$(echo "$A" | f '["access_token"]'); AI=$(echo "$A" | f '["user"]["id"]')
supabase db query --local "insert into public.admins (user_id) values ('$AI');" >/dev/null 2>&1
P1=$(signup); P1T=$(echo "$P1" | f '["access_token"]'); P1I=$(echo "$P1" | f '["user"]["id"]')
P2=$(signup); P2T=$(echo "$P2" | f '["access_token"]'); P2I=$(echo "$P2" | f '["user"]["id"]')

check "player takes an animal" "$(code POST /rest/v1/players "$P1T" "{\"user_id\":\"$P1I\",\"nickname\":\"a\",\"avatar\":\"owl\"}")" "201"
check "another player cannot take the same animal" "$(code POST /rest/v1/players "$P2T" "{\"user_id\":\"$P2I\",\"nickname\":\"b\",\"avatar\":\"owl\"}")" "409"
check "player keeps their own animal on re-save" "$(code POST /rest/v1/players "$P1T" "{\"user_id\":\"$P1I\",\"nickname\":\"a2\",\"avatar\":\"owl\"}")" "201"
check "a free animal is still available" "$(code POST /rest/v1/players "$P2T" "{\"user_id\":\"$P2I\",\"nickname\":\"b\",\"avatar\":\"bear\"}")" "201"

T=$(curl -sS -X POST "$API/rest/v1/treasures" -H "apikey: $ANON" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"title":"emoji","lat":49.8,"lng":24.0}' | f '[0]["id"]')
check "default pin emoji is the mushroom" "$(curl -s "$API/rest/v1/treasures?id=eq.$T&select=pin_emoji" -H "apikey: $ANON" -H "Authorization: Bearer $AT" | f '[0]["pin_emoji"]')" "🍄"
check "admin sets a pin emoji" "$(code PATCH "/rest/v1/treasures?id=eq.$T" "$AT" '{"pin_emoji":"🏰"}')" "200"
check "player cannot change the pin emoji" "$(curl -s -X PATCH "$API/rest/v1/treasures?id=eq.$T" -H "apikey: $ANON" -H "Authorization: Bearer $P1T" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"pin_emoji":"💀"}')" "[]"
check "empty pin emoji is rejected" "$(code PATCH "/rest/v1/treasures?id=eq.$T" "$AT" '{"pin_emoji":""}')" "400"

[ "$fail" -eq 0 ] && echo "AVATAR AND PIN RULES OK" || { echo "AVATAR AND PIN RULES FAILED"; exit 1; }
