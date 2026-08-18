#!/bin/bash

# ===============================================
# 🚀 Mitos Backend Deployment Script for aaPanel
# ===============================================

echo "🔄 Starting deployment..."

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# 3. Run Prisma migrations
echo "🗄️ Running database migrations..."
npx prisma generate
npx prisma migrate deploy

# 4. Create logs directory if not exists
mkdir -p logs

# 5. Restart PM2
echo "🔄 Restarting PM2..."
pm2 delete mitos-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# 6. Show status
echo "✅ Deployment complete!"
pm2 status
pm2 logs mitos-backend --lines 20
