#!/bin/bash
# ============================================================
# Magena Pilates — API Test Script
# Usage: bash test_api.sh
# ============================================================

BASE="http://localhost:3000"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  $label (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC}  $label — expected HTTP $expected, got HTTP $actual"
    [ -n "$body" ] && echo "       Body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Magena Pilates — API Test Suite${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 1. Health ─────────────────────────────────────────────
echo -e "\n${YELLOW}[1] Health${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
check "GET /" 200 "$STATUS"

# ── 2. Public Endpoints ───────────────────────────────────
echo -e "\n${YELLOW}[2] Public Endpoints${NC}"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/products")
check "GET /api/products" 200 "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/settings")
check "GET /api/settings" 200 "$STATUS"

BODY=$(curl -s "$BASE/api/products")
COUNT=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ -n "$COUNT" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}  products is JSON array ($COUNT items)"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}❌ FAIL${NC}  products response is not a JSON array"
  FAIL=$((FAIL+1))
fi

# ── 3. RLS — Anon Direct DB Access ───────────────────────
echo -e "\n${YELLOW}[3] RLS — Anon Cannot Access Protected Tables${NC}"
echo    "    (These should all be blocked — confirms RLS is working)"

SUPABASE_URL=$(grep "^SUPABASE_URL=" .env | cut -d= -f2-)
ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d= -f2-)

if [ -n "$SUPABASE_URL" ] && [ -n "$ANON_KEY" ]; then
  # Test: anon INSERT into products (should be blocked)
  STATUS=$(curl -s -o /tmp/rls_test.json -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/rest/v1/products" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"name":"HACKED"}')
  RBODY=$(cat /tmp/rls_test.json)
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || echo "$RBODY" | grep -qiE "violates|permission denied|check option"; then
    echo -e "  ${GREEN}✅ PASS${NC}  Anon INSERT into products blocked by RLS"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC}  Anon INSERT into products was NOT blocked (HTTP $STATUS)"
    FAIL=$((FAIL+1))
  fi

  # Test: anon SELECT pre_orders (should return empty — USING false)
  STATUS=$(curl -s -o /tmp/rls_test.json -w "%{http_code}" \
    -X GET "${SUPABASE_URL}/rest/v1/pre_orders?select=*" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}")
  RBODY=$(cat /tmp/rls_test.json)
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$RBODY" = "[]" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  Anon SELECT on pre_orders blocked by RLS (empty)"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC}  Anon can read pre_orders! (HTTP $STATUS)"
    FAIL=$((FAIL+1))
  fi

  # Test: anon SELECT payments (should return empty)
  STATUS=$(curl -s -o /tmp/rls_test.json -w "%{http_code}" \
    -X GET "${SUPABASE_URL}/rest/v1/payments?select=*" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}")
  RBODY=$(cat /tmp/rls_test.json)
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$RBODY" = "[]" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  Anon SELECT on payments blocked by RLS (empty)"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC}  Anon can read payments! (HTTP $STATUS)"
    FAIL=$((FAIL+1))
  fi

  # Test: anon can still read products (public catalog)
  STATUS=$(curl -s -o /tmp/rls_test.json -w "%{http_code}" \
    -X GET "${SUPABASE_URL}/rest/v1/products?select=*" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}")
  if [ "$STATUS" = "200" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  Anon CAN read products (public catalog — expected)"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC}  Anon cannot read products (should be public) HTTP $STATUS"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${YELLOW}⚠  SKIP${NC}  No Supabase keys found — skipping direct RLS tests"
fi

# ── 4. Admin Auth ─────────────────────────────────────────
echo -e "\n${YELLOW}[4] Admin Authentication${NC}"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}')
check "Wrong password → 401" 401 "$STATUS"

LOGIN_RESP=$(curl -s -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"magena2025"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}  Correct password → JWT issued"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}❌ FAIL${NC}  No JWT returned. Response: $LOGIN_RESP"
  FAIL=$((FAIL+1))
fi

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/orders")
check "No token → 401" 401 "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer fake.jwt.token" "$BASE/api/admin/orders")
check "Fake token → 401" 401 "$STATUS"

# ── 5. Admin Orders CRUD ──────────────────────────────────
echo -e "\n${YELLOW}[5] Admin Orders${NC}"

if [ -n "$TOKEN" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/orders")
  check "GET /api/admin/orders (valid JWT) → 200" 200 "$STATUS"

  # Get first real product ID for the test order
  PROD_ID=$(curl -s "$BASE/api/products" | \
    python3 -c "import sys,json; p=json.load(sys.stdin); print(p[0]['id'] if p else '')" 2>/dev/null)

  # Create M-PESA test order (no payment gateway needed)
  ORDER_JSON=$(python3 -c "
import json
print(json.dumps({
  'product_id': '$PROD_ID',
  'product_name': 'TEST PRODUCT',
  'order_type': 'purchase',
  'quantity': 1,
  'wants_engraving': False,
  'customer_name': 'Test Customer',
  'customer_email': 'test@example.com',
  'customer_phone': '0712345678',
  'customer_address': 'Nairobi, Kenya',
  'total_amount': 45000,
  'deposit_amount': 0,
  'payment_method': 'mpesa'
}))
")

  ORDER_RESP=$(curl -s -X POST "$BASE/api/orders" \
    -H "Content-Type: application/json" \
    -d "$ORDER_JSON")
  ORDER_ID=$(echo "$ORDER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('order_id',''))" 2>/dev/null)

  if [ -n "$ORDER_ID" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  POST /api/orders (M-PESA) → created $ORDER_ID"
    PASS=$((PASS+1))

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/orders/$ORDER_ID")
    check "GET /api/orders/:id → 200" 200 "$STATUS"

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PATCH "$BASE/api/admin/orders/$ORDER_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"status":"confirmed"}')
    check "PATCH /api/admin/orders/:id (status→confirmed) → 200" 200 "$STATUS"

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X DELETE "$BASE/api/admin/orders/$ORDER_ID" \
      -H "Authorization: Bearer $TOKEN")
    check "DELETE /api/admin/orders/:id (cleanup) → 200" 200 "$STATUS"
  else
    echo -e "  ${RED}❌ FAIL${NC}  POST /api/orders failed. Response: $ORDER_RESP"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${YELLOW}⚠  SKIP${NC}  No token — skipping"
fi

# ── 6. Admin Products CRUD ────────────────────────────────
echo -e "\n${YELLOW}[6] Admin Products${NC}"

if [ -n "$TOKEN" ]; then
  PROD_JSON='{"name":"TEST ITEM","status":"available","purchase_price":1000}'
  PROD_RESP=$(curl -s -X POST "$BASE/api/admin/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$PROD_JSON")
  NEW_PROD_ID=$(echo "$PROD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

  if [ -n "$NEW_PROD_ID" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  POST /api/admin/products → $NEW_PROD_ID"
    PASS=$((PASS+1))

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PUT "$BASE/api/admin/products/$NEW_PROD_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"name":"TEST ITEM UPDATED","status":"coming-soon"}')
    check "PUT /api/admin/products/:id → 200" 200 "$STATUS"

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X DELETE "$BASE/api/admin/products/$NEW_PROD_ID" \
      -H "Authorization: Bearer $TOKEN")
    check "DELETE /api/admin/products/:id (cleanup) → 200" 200 "$STATUS"
  else
    echo -e "  ${RED}❌ FAIL${NC}  POST /api/admin/products failed. Response: $PROD_RESP"
    FAIL=$((FAIL+1))
  fi
fi

# ── 7. Admin Settings ─────────────────────────────────────
echo -e "\n${YELLOW}[7] Admin Settings${NC}"

if [ -n "$TOKEN" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/settings")
  check "GET /api/admin/settings → 200" 200 "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "$BASE/api/admin/settings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"terms":["Test term"],"engraving_price":3500,"rental_fixed_months":5}')
  check "PUT /api/admin/settings → 200" 200 "$STATUS"
fi

# ── Summary ───────────────────────────────────────────────
TOTAL=$((PASS+FAIL))
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
[ $FAIL -eq 0 ] && exit 0 || exit 1
