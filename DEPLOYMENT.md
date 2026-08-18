# ===============================================
# 🚀 PRODUCTION DEPLOYMENT GUIDE FOR aaPanel
# ===============================================

## Prerequisites
- Node.js 16+ installed
- PM2 installed globally: `npm install -g pm2`
- MySQL database running
- Git repository access

## Initial Setup on aaPanel

### 1. Install PM2 (if not installed)
```bash
npm install -g pm2
pm2 startup
# Follow the instructions to enable PM2 on system boot
```

### 2. Clone Repository
```bash
cd /www/wwwroot/mitos
git clone <your-repo-url> Mitos_backend
cd Mitos_backend
```

### 3. Configure Environment
```bash
# Copy and edit .env file
cp .env.example .env
nano .env

# Update these critical values:
# - DATABASE_URL (use your production database)
# - JWT_SECRET (use strong secret)
# - NODE_ENV=production
# - GOOGLE_PLAY_KEY_PATH=/www/wwwroot/mitos/Mitos_backend/google-play-api.json
```

### 4. Install Dependencies
```bash
npm install --production
```

### 5. Run Database Migrations
```bash
npx prisma generate
npx prisma migrate deploy
```

### 6. Create Logs Directory
```bash
mkdir -p logs
```

### 7. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

## Deployment Commands

### Deploy Updates
```bash
chmod +x deploy.sh
./deploy.sh
```

### Monitor Application
```bash
# View status
pm2 status

# View logs
pm2 logs mitos-backend

# View real-time logs
pm2 logs mitos-backend --lines 100

# Monitor CPU/Memory
pm2 monit
```

### Restart Application
```bash
# Graceful restart (zero downtime)
pm2 reload mitos-backend

# Hard restart
pm2 restart mitos-backend

# Stop
pm2 stop mitos-backend

# Delete from PM2
pm2 delete mitos-backend
```

## Performance Optimization for 5000+ Users

### Current Configuration
- **Cluster Mode**: 2 instances (adjust based on CPU cores)
- **Memory Limit**: 500MB per instance (auto-restart on exceed)
- **Connection Pool**: 10 connections per instance
- **Max Restarts**: 10 attempts with 4s delay

### Recommended Server Specs
- **CPU**: 2+ cores (4 recommended)
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 20GB SSD

### Scaling Up
Edit `ecosystem.config.js`:
```javascript
instances: 4, // Increase for more CPU cores
max_memory_restart: "1G", // Increase if needed
```

## Troubleshooting

### Check Logs
```bash
# Application logs
pm2 logs mitos-backend --lines 200

# Error logs only
cat logs/error.log

# Output logs
cat logs/out.log
```

### Common Issues

**1. Port Already in Use**
```bash
# Find process using port 5000
lsof -i :5000
# Kill process
kill -9 <PID>
```

**2. Database Connection Failed**
- Check DATABASE_URL in .env
- Verify MySQL is running
- Check firewall rules

**3. Memory Issues**
```bash
# Check memory usage
pm2 monit
# Increase memory limit in ecosystem.config.js
```

**4. High CPU Usage**
- Reduce instances in ecosystem.config.js
- Check for infinite loops in code
- Review slow database queries

### Health Check
```bash
curl http://localhost:5000/
# Should return: "🚀 Mitos Learning API is running successfully!"
```

## Security Checklist
- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure firewall rules
- [ ] Limit database user permissions
- [ ] Regular backups enabled
- [ ] Keep dependencies updated

## Monitoring
```bash
# Set up PM2 monitoring (optional)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Backup Strategy
```bash
# Database backup (run daily via cron)
mysqldump -u maindb -p maindb > backup_$(date +%Y%m%d).sql

# Code backup
git push origin main
```
