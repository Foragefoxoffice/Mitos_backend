#!/bin/bash

# ===============================================
# 🔍 Backend Health Check Script
# ===============================================

echo "🔍 Checking Backend Health..."
echo ""

# 1. Check if PM2 is running
echo "📊 PM2 Status:"
pm2 status mitos-backend 2>/dev/null || echo "❌ PM2 not running or app not found"
echo ""

# 2. Check server response
echo "🌐 Server Health Check:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/)
if [ "$RESPONSE" -eq 200 ]; then
  echo "✅ Server is responding (HTTP $RESPONSE)"
else
  echo "❌ Server not responding (HTTP $RESPONSE)"
fi
echo ""

# 3. Check database connection
echo "🗄️ Database Connection:"
if npx prisma db execute --stdin <<< "SELECT 1" &>/dev/null; then
  echo "✅ Database connected"
else
  echo "❌ Database connection failed"
fi
echo ""

# 4. Check memory usage
echo "💾 Memory Usage:"
pm2 describe mitos-backend 2>/dev/null | grep -E "memory|cpu" || echo "N/A"
echo ""

# 5. Check recent errors
echo "⚠️ Recent Errors (last 20 lines):"
if [ -f logs/error.log ]; then
  tail -20 logs/error.log
else
  echo "No error log found"
fi
echo ""

# 6. Check uptime
echo "⏱️ Uptime:"
pm2 describe mitos-backend 2>/dev/null | grep uptime || echo "N/A"
echo ""

echo "✅ Health check complete!"
