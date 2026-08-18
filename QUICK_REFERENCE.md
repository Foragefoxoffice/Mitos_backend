# 🚀 Quick Reference - Backend Deployment

## 🆘 Emergency Commands

### Restart Backend (if crashing)
```bash
pm2 restart mitos-backend
```

### View Live Logs
```bash
pm2 logs mitos-backend
```

### Check Status
```bash
pm2 status
```

### Health Check
```bash
./health-check.sh
```

---

## 📋 Common Tasks

### Deploy Updates
```bash
./deploy.sh
```

### View Error Logs
```bash
tail -100 logs/error.log
```

### Monitor Performance
```bash
pm2 monit
```

### Restart All Instances
```bash
pm2 reload mitos-backend
```

---

## 🔧 Troubleshooting

### Backend Won't Start
```bash
# Check logs
pm2 logs mitos-backend --err

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1"

# Restart PM2
pm2 delete mitos-backend
pm2 start ecosystem.config.js
```

### High Memory Usage
```bash
# Check current usage
pm2 monit

# Restart to clear memory
pm2 reload mitos-backend
```

### Database Connection Errors
```bash
# Test connection
mysql -u maindb -p maindb

# Check .env DATABASE_URL
cat .env | grep DATABASE_URL
```

---

## 📁 Important Files

- `ecosystem.config.js` - PM2 configuration
- `deploy.sh` - Deployment script
- `health-check.sh` - Health check script
- `DEPLOYMENT.md` - Full deployment guide
- `logs/error.log` - Error logs
- `logs/out.log` - Output logs

---

## 🎯 Performance Targets

- **Uptime**: 99.9%
- **Response Time**: < 200ms
- **Memory per Instance**: < 500MB
- **Concurrent Users**: 5000+
- **Auto-restart**: Enabled
- **Zero-downtime Deploys**: Yes

---

## 📞 Support

For detailed documentation, see [`DEPLOYMENT.md`](file:///Users/arundurai/mitos/backend/DEPLOYMENT.md)
