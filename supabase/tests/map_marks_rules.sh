#!/usr/bin/env bash
# Rules check for migration 0007: admins write map marks, every player reads them. Needs a reset local stack.
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

A=$(signup); ATOK=$(echo "$A" | f '["access_token"]'); AID=$(echo "$A" | f '["user"]["id"]')
supabase db query --local "insert into public.admins (user_id) values ('$AID');" >/dev/null 2>&1
P1=$(signup); P1TOK=$(echo "$P1" | f '["access_token"]'); P1ID=$(echo "$P1" | f '["user"]["id"]')

R=$(req POST /rest/v1/map_marks "$ATOK" '{"title":"Небезпечна собака","note":"Біля паркану","emoji":"🐕","lat":49.8,"lng":24.0}'); check "admin adds a map mark" "$(code "$R")" "201"
MID=$(body "$R" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())[0]["id"])')
R=$(req POST /rest/v1/map_marks "$P1TOK" '{"title":"x","emoji":"⚠️","lat":49.8,"lng":24.0}'); check "player cannot add a mark" "$(code "$R")" "403"
R=$(req GET "/rest/v1/map_marks?select=title" "$P1TOK"); check "player reads the marks" "$(body "$R" | python3 -c 'import json,sys; print([m["title"] for m in json.loads(sys.stdin.read())])')" "['Небезпечна собака']"
R=$(req PATCH "/rest/v1/map_marks?id=eq.$MID" "$ATOK" '{"title":"Зачинений вхід"}'); check "admin edits a mark" "$(body "$R" | python3 -c 'import json,sys; print([m["title"] for m in json.loads(sys.stdin.read())])')" "['Зачинений вхід']"
R=$(req PATCH "/rest/v1/map_marks?id=eq.$MID" "$P1TOK" '{"title":"хакер"}'); R2=$(req GET "/rest/v1/map_marks?select=title" "$ATOK"); check "player cannot edit a mark" "$(body "$R2" | python3 -c 'import json,sys; print([m["title"] for m in json.loads(sys.stdin.read())])')" "['Зачинений вхід']"
R=$(req DELETE "/rest/v1/map_marks?id=eq.$MID" "$P1TOK"); R2=$(req GET "/rest/v1/map_marks?select=id" "$ATOK"); check "player cannot delete a mark" "$(body "$R2" | python3 -c 'import json,sys; print(len(json.loads(sys.stdin.read())))')" "1"
R=$(req DELETE "/rest/v1/map_marks?id=eq.$MID" "$ATOK"); R2=$(req GET "/rest/v1/map_marks?select=id" "$ATOK"); check "admin deletes a mark" "$(body "$R2" | python3 -c 'import json,sys; print(len(json.loads(sys.stdin.read())))')" "0"

if [ "$fail" -eq 0 ]; then echo "ALL OK"; else echo "SOME FAILED"; exit 1; fi
