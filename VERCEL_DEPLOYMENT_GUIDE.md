# Vercel Deployment Guide

Quick setup guide for deploying the Tag Management Checker on Vercel.

## 🚀 Zero-Config Deployment

### Prerequisites
- GitHub repository with your code ✅
- Free Vercel account at [vercel.com](https://vercel.com)

### Step 1: Deploy from GitHub

1. **Go to [vercel.com](https://vercel.com)** and sign up/login
2. **Click "New Project"**
3. **Import from GitHub**: Select `tag-management-checker` repository  
4. **Deploy**: Click "Deploy" (auto-detects Node.js project)

That's it! Your app will be live at `https://tag-management-checker-xxx.vercel.app`

## ⚙️ Configuration

### Auto-Detection
Vercel automatically handles:
- ✅ **Runtime**: Detects Node.js from package.json
- ✅ **API Routes**: `/api/*.js` files become serverless functions
- ✅ **Static Files**: `public/` directory served as static assets
- ✅ **Dependencies**: Installs from package.json

### Environment Variables (Required)
**Must add in Vercel Dashboard** → Project → Settings → Environment Variables:
```
TARGET_ACCOUNT=adtaxi
NODE_ENV=production
```

## 🔄 Auto-Deploy

**Automatic deployment is enabled by default:**
- Push to `main` branch → Automatic deployment
- No configuration needed
- Zero downtime deployments

## 🌐 Custom Domain (Optional)

1. **In Vercel Dashboard**: Project → Settings → Domains
2. **Add Domain**: `checker.yourdomain.com`  
3. **Update DNS**: Add provided CNAME record

## 📊 Testing Your Deployment

### Health Check
```bash
curl https://your-app.vercel.app/health
```

### Web Interface
Open `https://your-app.vercel.app` in your browser

### API Test
```bash
curl -X POST https://your-app.vercel.app/api/check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://bubbles.tv/"}'
```

## 🎯 Key Features

- ⚡ **Serverless**: Automatic scaling, no server management
- 🔄 **Auto-Deploy**: Every push triggers deployment
- 🌍 **Global CDN**: Fast worldwide performance  
- 🆓 **Free Tier**: 100GB bandwidth, unlimited static requests
- 📊 **Analytics**: Built-in performance monitoring

## 💡 Advantages over Traditional Hosting

- **No Build Errors**: Vercel handles Node.js dependencies cleanly
- **Zero Configuration**: Works out-of-the-box with your existing code
- **Instant Rollback**: Easy deployment history management
- **Preview Deployments**: Every branch gets its own URL for testing

## 🔍 Monitoring

**Vercel Dashboard provides:**
- Real-time deployment logs
- Performance analytics
- Error tracking
- Function execution metrics

Your Tag Management Checker is now production-ready with enterprise-grade hosting! 🎉