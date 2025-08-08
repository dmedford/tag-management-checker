# 🚀 Tealium Checker - Server Management Guide

## ✅ **Your server is now running continuously in the background!**

The Tealium Checker web server is managed by **PM2** (Process Manager 2) and will:
- ✅ **Run continuously** even when you close terminal
- ✅ **Auto-restart** if it crashes
- ✅ **Persist through reboots** (if configured)
- ✅ **Monitor performance** and memory usage

## 🌐 **Access Your Web Interface**

Your Tealium Checker is now available at:
**http://localhost:8889**

## 📋 **Server Management Commands**

### **Status & Monitoring**
```bash
# Check if server is running
npm run web:status

# View real-time logs
npm run web:logs

# View all PM2 processes
pm2 list
```

### **Control Commands**
```bash
# Stop the server
npm run web:stop

# Start the server (if stopped)
npm run web:start

# Restart the server
npm run web:restart

# Start in background (what we just did)
npm run web:background
```

### **Quick Health Check**
```bash
# Test if server is responding
curl http://localhost:8889/health
```

## 🔄 **Current Server Status**

```
✅ Status: ONLINE
🌐 URL: http://localhost:8889  
🔧 Engine: Cheerio + Axios (Lightweight)
💾 Memory: ~80MB
⚡ Performance: 0% CPU usage
🔄 Auto-restart: Enabled
📊 Process ID: 81422
```

## 💡 **Working While Server Runs**

Now you can:
- ✅ **Close this terminal** - server keeps running
- ✅ **Open/close your browser** - server stays active  
- ✅ **Restart your computer** - server will auto-restart*
- ✅ **Work on other projects** - no interference
- ✅ **Share the URL** with team members on same network

*Auto-restart after reboot requires additional setup (see below)

## 🛠️ **Advanced Options**

### **Make Server Start on Boot (Optional)**
```bash
# Enable PM2 to start on system boot
pm2 startup
# Follow the instructions it provides
```

### **View Detailed Logs**
```bash
# Live log monitoring
pm2 logs tealium-checker --lines 50

# View error logs only
pm2 logs tealium-checker --err

# View output logs only  
pm2 logs tealium-checker --out
```

### **Performance Monitoring**
```bash
# Real-time monitoring dashboard
pm2 monit

# Memory and CPU stats
pm2 describe tealium-checker
```

## 🚨 **Troubleshooting**

### **If Server Stops Working**
```bash
# Check status
npm run web:status

# If offline, restart it
npm run web:restart

# If that doesn't work, stop and start fresh
npm run web:stop
npm run web:background
```

### **If Port 8889 is Busy**
```bash
# Kill anything using the port
lsof -ti:8889 | xargs kill -9

# Then restart
npm run web:background
```

### **Change Server Port (If Needed)**
Edit `ecosystem.config.cjs` and change:
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 9000  // Change to your desired port
}
```

Then restart:
```bash
npm run web:restart
```

## 📱 **Alternative Access Methods**

If the PM2 server has issues, you still have backups:

### **Direct Server (Temporary)**
```bash
npm run web
# Runs directly in terminal (stops when you close terminal)
```

### **Local Interface (No Server)**
```bash
open local-interface.html  
# Command generator that works offline
```

## 🔧 **Server Configuration**

Current PM2 configuration (`ecosystem.config.cjs`):
- **Process Name**: `tealium-checker`
- **Port**: `8889`
- **Auto-restart**: `true`
- **Memory Limit**: `100MB`
- **Log Files**: `./logs/` directory

## 🎯 **What This Means for Your Workflow**

You can now:
1. **Access http://localhost:8889 anytime** - it's always running
2. **Close terminal/IDE** - server continues in background
3. **Focus on other work** - Tealium checker is always available
4. **Share with teammates** - they can access the same URL
5. **Use it for daily Tealium checks** - no setup required

## 🎉 **Your Tealium Checker is Now Production-Ready!**

The server runs continuously and automatically, making it perfect for:
- Daily website Tealium verification
- Team collaboration and sharing
- Client onboarding verification  
- Regular implementation audits
- Troubleshooting Tealium issues

**Just bookmark http://localhost:8889 and you're all set! 🚀**