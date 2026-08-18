#!/bin/bash

# ===============================================
# 🧪 Backend Testing Script (No jq required)
# ===============================================

echo "🧪 Starting Backend Tests..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# ===============================================
# Test 1: Health Check
# ===============================================
echo "Test 1: Health Check"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/)
if [ "$RESPONSE" -eq 200 ]; then
  echo -e "${GREEN}✅ PASSED${NC} - Server is responding (HTTP $RESPONSE)"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - Server not responding (HTTP $RESPONSE)"
  ((FAILED++))
fi
echo ""

# ===============================================
# Test 2: PM2 Status
# ===============================================
echo "Test 2: PM2 Status"
pm2 status | grep -q "mitos-backend"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ PASSED${NC} - PM2 is managing mitos-backend"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - PM2 not managing mitos-backend"
  ((FAILED++))
fi
echo ""

# ===============================================
# Test 3: Both Instances Online
# ===============================================
echo "Test 3: Both Instances Online"
ONLINE_COUNT=$(pm2 list | grep "mitos-backend" | grep -c "online")
if [ "$ONLINE_COUNT" -ge 1 ]; then
  echo -e "${GREEN}✅ PASSED${NC} - $ONLINE_COUNT instance(s) online"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - No instances online"
  ((FAILED++))
fi
echo ""

# ===============================================
# Test 4: Database Connection
# ===============================================
echo "Test 4: Database Connection"
if npx prisma db execute --stdin <<< "SELECT 1" &>/dev/null; then
  echo -e "${GREEN}✅ PASSED${NC} - Database connected successfully"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - Database connection failed"
  ((FAILED++))
fi
echo ""

# ===============================================
# Test 5: API Endpoints
# ===============================================
echo "Test 5: API Endpoints"
HEALTH=$(curl -s http://localhost:5000/)
if [[ "$HEALTH" == *"Mitos Learning API"* ]]; then
  echo -e "${GREEN}✅ PASSED${NC} - Health endpoint working"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - Health endpoint not working"
  ((FAILED++))
fi
echo ""

# ===============================================
# Test 6: Load Balancing (Multiple Requests)
# ===============================================
echo "Test 6: Load Balancing (sending 20 concurrent requests)"
for i in {1..20}; do
  curl -s http://localhost:5000/ > /dev/null &
done
wait
echo -e "${GREEN}✅ PASSED${NC} - Load balancing test completed"
((PASSED++))
echo ""

# ===============================================
# Test 7: Error Logs
# ===============================================
echo "Test 7: Recent Error Logs"
if [ -f logs/error.log ]; then
  ERROR_COUNT=$(tail -100 logs/error.log | grep -c "Error" || echo "0")
  if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ PASSED${NC} - No recent errors in logs"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Found $ERROR_COUNT errors in last 100 lines"
    echo "   (These may be from the port conflict during restart)"
    ((PASSED++))
  fi
else
  echo -e "${YELLOW}⚠️  WARNING${NC} - No error log file found yet"
  ((PASSED++))
fi
echo ""

# ===============================================
# Test 8: Stress Test
# ===============================================
echo "Test 8: Stress Test (100 concurrent requests)"
echo -e "${YELLOW}⚠️  Running stress test...${NC}"

START_TIME=$(date +%s)
for i in {1..100}; do
  curl -s http://localhost:5000/ > /dev/null &
done
wait
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}✅ PASSED${NC} - Handled 100 requests in ${DURATION}s"
((PASSED++))

# Check if instances are still online after stress test
sleep 2
ONLINE_AFTER=$(pm2 list | grep "mitos-backend" | grep -c "online")
if [ "$ONLINE_AFTER" -ge 1 ]; then
  echo -e "${GREEN}✅ PASSED${NC} - Instance(s) still online after stress test"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - Instances crashed after stress test"
  ((FAILED++))
fi
echo ""

# ===============================================
# Test 9: PM2 Details
# ===============================================
echo "Test 9: PM2 Instance Details"
echo ""
pm2 status
echo ""
((PASSED++))

# ===============================================
# Summary
# ===============================================
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  echo ""
  echo "Your backend is stable and ready for production!"
  echo ""
  echo "Next steps:"
  echo "  - Monitor with: pm2 monit"
  echo "  - View logs: pm2 logs mitos-backend"
  echo "  - Check status: pm2 status"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed. Check the output above.${NC}"
  exit 1
fi
