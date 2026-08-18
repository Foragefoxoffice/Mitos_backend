# 🧪 Backend Testing Guide

## Quick Tests (Run on Server)

### 1. Automated Test Suite
```bash
chmod +x test-backend.sh
./test-backend.sh
```

This will test:
- ✅ Health check
- ✅ PM2 cluster mode (2 instances)
- ✅ Both instances online
- ✅ Memory usage < 500MB
- ✅ Database connection
- ✅ API endpoints
- ✅ Load balancing
- ✅ Error logs
- ✅ Uptime
- ✅ Stress test (100 requests)

---

## Manual Tests

### Test 1: Basic Health Check
```bash
# Should return: "🚀 Mitos Learning API is running successfully!"
curl http://localhost:5000/

# Or from outside server (replace with your domain)
curl https://your-domain.com/
```

**Expected**: HTTP 200 with success message

---

### Test 2: PM2 Status
```bash
pm2 status
```

**Expected**:
```
┌────┬───────────────┬─────────┬──────┬──────────┬──────────┬──────────┐
│ id │ name          │ mode    │ ↺    │ status   │ cpu      │ memory   │
├────┼───────────────┼─────────┼──────┼──────────┼──────────┼──────────┤
│ 0  │ mitos-backend │ cluster │ 0-3  │ online   │ 0%       │ 60-80mb  │
│ 1  │ mitos-backend │ cluster │ 0-3  │ online   │ 0%       │ 60-80mb  │
└────┴───────────────┴─────────┴──────┴──────────┴──────────┴──────────┘
```

**Key Points**:
- Both instances should be **online**
- Restart count (↺) should be low (0-3 is normal during deployment)
- Memory should be < 500MB

---

### Test 3: Load Balancing Test
```bash
# Send 20 requests and see both instances handle them
for i in {1..20}; do
  curl -s http://localhost:5000/ > /dev/null
  echo "Request $i sent"
done

# Check logs to see both instances working
pm2 logs mitos-backend --lines 50
```

**Expected**: You should see logs from both instance 0 and instance 1

---

### Test 4: Crash Recovery Test
```bash
# Kill one instance to test auto-restart
pm2 stop 0

# Wait 5 seconds
sleep 5

# Check status - instance 0 should auto-restart
pm2 status
```

**Expected**: Instance 0 should automatically restart and show "online" status

---

### Test 5: Memory Leak Test
```bash
# Monitor memory over time
pm2 monit

# Or check memory usage
pm2 jlist | jq '.[] | select(.name=="mitos-backend") | {id: .pm_id, memory: (.monit.memory / 1024 / 1024 | floor)}'
```

**Expected**: Memory should stay below 500MB. If it exceeds, PM2 will auto-restart.

---

### Test 6: Database Connection Test
```bash
# Test Prisma connection
npx prisma db execute --stdin <<< "SELECT 1"
```

**Expected**: No errors, connection successful

---

### Test 7: API Endpoint Tests

Test your actual API endpoints:

```bash
# Test auth endpoint (example)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test users endpoint (example)
curl http://localhost:5000/api/users

# Test questions endpoint (example)
curl http://localhost:5000/api/questions
```

---

### Test 8: Stress Test (Load Testing)

#### Option A: Using Apache Bench (ab)
```bash
# Install if needed
apt-get install apache2-utils

# Send 1000 requests with 100 concurrent
ab -n 1000 -c 100 http://localhost:5000/

# Check if instances are still healthy
pm2 status
```

#### Option B: Using curl loop
```bash
# Send 500 concurrent requests
for i in {1..500}; do
  curl -s http://localhost:5000/ > /dev/null &
done
wait

# Check status
pm2 status
pm2 logs mitos-backend --lines 20
```

**Expected**: 
- Both instances should remain online
- No crashes
- Response time should be reasonable

---

### Test 9: Error Handling Test

#### Test Unhandled Rejection
Create a test endpoint that throws an error:

```bash
# Add this to server.js temporarily
app.get('/test-error', (req, res) => {
  Promise.reject(new Error('Test unhandled rejection'));
});

# Restart PM2
pm2 restart mitos-backend

# Trigger the error
curl http://localhost:5000/test-error

# Check logs - should see error logged but server still running
pm2 logs mitos-backend --err --lines 10
```

**Expected**: Error is logged, but backend doesn't crash

---

### Test 10: Deployment Test
```bash
# Test the deployment script
./deploy.sh

# Verify:
# 1. Code pulled from git
# 2. Dependencies installed
# 3. Migrations ran
# 4. PM2 restarted
# 5. Both instances online

pm2 status
```

---

## Production Monitoring

### Daily Health Checks
```bash
# Run this daily
./health-check.sh
```

### Real-time Monitoring
```bash
# Monitor CPU/Memory in real-time
pm2 monit

# View live logs
pm2 logs mitos-backend

# View only errors
pm2 logs mitos-backend --err
```

### Weekly Checks
```bash
# Check restart count (should be low)
pm2 jlist | jq '.[] | select(.name=="mitos-backend") | {id: .pm_id, restarts: .pm2_env.restart_time}'

# Check uptime
pm2 jlist | jq '.[] | select(.name=="mitos-backend") | {id: .pm_id, uptime: (.pm2_env.pm_uptime / 1000 / 60 / 60 | floor)}'

# Check error logs
tail -100 logs/error.log
```

---

## Performance Benchmarks

### Expected Performance (5000+ Users)

| Metric | Target | Command to Check |
|--------|--------|------------------|
| Response Time | < 200ms | `ab -n 100 -c 10 http://localhost:5000/` |
| Uptime | > 99.9% | `pm2 jlist \| jq '.[].pm2_env.pm_uptime'` |
| Memory per Instance | < 500MB | `pm2 monit` |
| CPU Usage | < 50% | `pm2 monit` |
| Restart Count | < 5/day | `pm2 status` |
| Database Connections | 20 total | Check MySQL: `SHOW PROCESSLIST;` |

---

## Troubleshooting Tests

### If Backend is Slow
```bash
# Check CPU usage
pm2 monit

# Check database queries
# Login to MySQL and run:
SHOW FULL PROCESSLIST;

# Check for slow queries
tail -100 logs/out.log | grep -i "slow"
```

### If Memory is High
```bash
# Check current memory
pm2 jlist | jq '.[] | select(.name=="mitos-backend") | .monit.memory'

# Restart to clear memory
pm2 reload mitos-backend

# Monitor memory growth
watch -n 5 'pm2 jlist | jq ".[] | select(.name==\"mitos-backend\") | .monit.memory"'
```

### If Instances Keep Restarting
```bash
# Check error logs
pm2 logs mitos-backend --err --lines 100

# Check system resources
free -h
df -h

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1"
```

---

## Success Criteria

✅ **All tests pass** when running `./test-backend.sh`
✅ **Both instances online** with low restart count
✅ **Memory < 500MB** per instance
✅ **Response time < 200ms** under normal load
✅ **No errors** in recent logs
✅ **Database connected** successfully
✅ **Handles 100+ concurrent requests** without crashing

---

## Next Steps

1. Run `./test-backend.sh` daily
2. Monitor with `pm2 monit`
3. Check logs weekly: `tail -100 logs/error.log`
4. Set up external monitoring (optional):
   - UptimeRobot
   - Pingdom
   - New Relic
   - Datadog
