# Render Deployment Guide

Complete setup guide for deploying the Tag Management Checker on Render.com with support for future static site additions.

## 🚀 Current Tool Deployment (Tag Management Checker)

### Prerequisites
- GitHub repository with your code
- Free Render account at [render.com](https://render.com)

### Step 1: Prepare Repository

Your repository is already configured with:
- ✅ `render.yaml` - Deployment configuration
- ✅ `.renderignore` - Excludes unnecessary files
- ✅ `package.json` - Dependencies and scripts
- ✅ `cheerio-web-server.js` - Production server

### Step 2: Deploy to Render

#### Option A: Auto-Deploy from GitHub (Recommended)
1. **Connect GitHub**: 
   - Go to [render.com](https://render.com) → Sign up/Login
   - Connect your GitHub account

2. **Create Web Service**:
   - Click "New" → "Web Service"
   - Select your GitHub repository: `tealium-checker`
   - Choose deployment method: "Deploy from Git"

3. **Configure Service**:
   ```
   Name: tag-management-checker
   Environment: Node
   Build Command: npm install
   Start Command: npm run web
   ```

4. **Environment Variables**:
   ```
   PORT=10000
   NODE_ENV=production
   TARGET_ACCOUNT=adtaxi
   ```

5. **Deploy**: Click "Create Web Service"

#### Option B: Blueprint Deployment
1. **Using render.yaml**:
   - Place `render.yaml` in repository root (already done)
   - Go to Render Dashboard → "New" → "Blueprint"
   - Connect repository and deploy

### Step 3: Verify Deployment

Your app will be available at: `https://tag-management-checker-xxx.onrender.com`

**Test endpoints**:
- Health check: `GET /health`
- Web interface: `GET /`
- API check: `POST /api/check`

### Step 4: Custom Domain (Optional)

1. **Purchase domain** (if not already owned)
2. **In Render Dashboard**:
   - Go to your service → "Settings" → "Custom Domains"
   - Add your domain (e.g., `checker.yourdomain.com`)
3. **Update DNS** with provided CNAME record

## 🌐 Future Static Sites Configuration

Render supports multiple services in one repository for mixed deployments.

### Multi-Service render.yaml

Update your `render.yaml` to support both dynamic and static sites:

```yaml
services:
  # Main Tag Management Checker (Node.js)
  - type: web
    name: tag-management-checker
    env: node
    buildCommand: npm install
    startCommand: npm run web
    envVars:
      - key: PORT
        value: 10000
      - key: NODE_ENV
        value: production
      - key: TARGET_ACCOUNT
        value: adtaxi
    autoDeploy: true

  # Static Documentation Site
  - type: static
    name: docs-site
    buildCommand: |
      # Create docs directory if it doesn't exist
      mkdir -p docs
      # Copy README as main page
      cp README.md docs/index.md
      # Convert markdown to HTML (if needed)
      npx marked -i docs/index.md -o docs/index.html
    staticPublishPath: ./docs
    domains:
      - docs.yourdomain.com
    autoDeploy: true

  # Future React/Vue App
  - type: static  
    name: dashboard
    buildCommand: |
      cd dashboard
      npm install
      npm run build
    staticPublishPath: ./dashboard/dist
    domains:
      - dashboard.yourdomain.com
    autoDeploy: true
```

### Static Site Examples

#### 1. Documentation Site
```bash
# Create docs directory
mkdir docs
echo "# Documentation" > docs/index.html

# Add to render.yaml
- type: static
  name: documentation
  staticPublishPath: ./docs
```

#### 2. React Dashboard
```bash
# Create React app
npx create-react-app dashboard
cd dashboard
npm run build

# Add to render.yaml  
- type: static
  name: react-dashboard
  buildCommand: |
    cd dashboard
    npm install
    npm run build
  staticPublishPath: ./dashboard/build
```

#### 3. Vue.js Frontend
```bash
# Create Vue app
npm create vue@latest frontend
cd frontend
npm run build

# Add to render.yaml
- type: static
  name: vue-frontend
  buildCommand: |
    cd frontend
    npm install
    npm run build
  staticPublishPath: ./frontend/dist
```

## 🔧 Advanced Configuration

### Environment-Specific Deployments

**Production + Staging:**
```yaml
services:
  # Production
  - type: web
    name: tag-checker-prod
    env: node
    branch: main
    buildCommand: npm install
    startCommand: npm run web
    envVars:
      - key: NODE_ENV
        value: production
      - key: TARGET_ACCOUNT
        value: adtaxi

  # Staging
  - type: web
    name: tag-checker-staging
    env: node
    branch: develop
    buildCommand: npm install
    startCommand: npm run web
    envVars:
      - key: NODE_ENV
        value: staging
      - key: TARGET_ACCOUNT
        value: adtaxi-test
```

### Custom Build Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "build": "echo 'No build needed for Node.js'",
    "start": "node cheerio-web-server.js",
    "web": "node cheerio-web-server.js",
    "docs:build": "mkdir -p docs && cp README.md docs/index.md"
  }
}
```

### Database Integration (Future)

For apps needing databases:
```yaml
databases:
  - name: tag-checker-db
    databaseName: tagchecker
    user: admin

services:
  - type: web
    name: tag-management-checker
    env: node
    buildCommand: npm install
    startCommand: npm run web
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: tag-checker-db
          property: connectionString
```

## 💰 Cost Optimization

### Free Tier Limits
- **Web Services**: 750 hours/month (1 service can run 24/7)
- **Static Sites**: Unlimited with 100GB bandwidth
- **Databases**: 1 free PostgreSQL database

### Optimization Strategies

1. **Spin Down Unused Services**:
   ```yaml
   - type: web
     name: dev-service
     autoDeploy: false  # Manual deploy only
   ```

2. **Combine Static Sites**:
   ```bash
   # Single static service for multiple sites
   mkdir public
   cp -r docs/* public/docs/
   cp -r dashboard/build/* public/app/
   ```

3. **Use Environment Variables**:
   ```yaml
   envVars:
     - key: FEATURE_ENABLED
       value: false  # Disable expensive features in free tier
   ```

## 🚀 Deployment Commands

### Initial Setup
```bash
# 1. Ensure your code is pushed to GitHub
git add .
git commit -m "Add Render deployment configuration"
git push origin main

# 2. Go to Render.com and connect repository
# 3. Service will auto-deploy on every push to main
```

### Manual Deployments
```bash
# Trigger deployment
git push origin main

# Deploy specific branch
git push origin feature-branch
# (Configure service to track that branch)
```

### Local Testing
```bash
# Test production build locally
NODE_ENV=production npm run web

# Test with production port
PORT=10000 npm run web
```

## 🔍 Monitoring & Debugging

### View Logs
1. **Render Dashboard** → Your Service → "Logs"
2. **Real-time logs** during deployment and runtime
3. **Build logs** for troubleshooting build failures

### Health Checks
```bash
# Test health endpoint
curl https://your-app.onrender.com/health

# Expected response:
{
  "status": "ok",
  "account": "adtaxi", 
  "server": "cheerio-powered",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Common Issues

**Build Failures:**
- Check Node.js version in `package.json`:
  ```json
  {
    "engines": {
      "node": ">=18.0.0"
    }
  }
  ```

**Service Won't Start:**
- Ensure `PORT` environment variable is used:
  ```javascript
  const port = process.env.PORT || 8889;
  ```

**Static Site 404s:**
- Verify `staticPublishPath` points to correct directory
- Check build command produces files in expected location

## 📚 Next Steps

1. **Deploy Current Tool**: Follow Steps 1-3 above
2. **Add Custom Domain**: Configure DNS for professional URL
3. **Set Up Monitoring**: Enable Render health checks
4. **Plan Static Sites**: Design your additional sites
5. **Configure Multi-Service**: Update render.yaml when ready

## 🆘 Support

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Community**: [community.render.com](https://community.render.com)
- **Support**: Available through Render dashboard

Your Tag Management Checker is now ready for production deployment with seamless GitHub integration and room for future expansion!