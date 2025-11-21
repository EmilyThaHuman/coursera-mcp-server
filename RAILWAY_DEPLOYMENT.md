# Railway Deployment Guide - Coursera MCP Server

## Prerequisites
- Railway CLI installed: `npm install -g @railway/cli`
- Railway account connected: `railway login`

## Deployment Steps

1. **Initialize Railway Project**
```bash
cd /Users/reedvogt/Documents/GitHub/coursera-mcp-server
railway init
```

2. **Set Environment Variables**
```bash
railway variables set COURSERA_API_KEY="RRCWoVu9MoVQDFWEHGL0lTu5H0Wx2xjB2Gy4FvJbQcUDFHJu"
railway variables set COURSERA_API_SECRET="S6GK2ilLk9uxkv1qqcxOzn2am0w4NfuEdXwJhA4KhN3zGAqtgWgBXExAW2FsoUCl"
railway variables set COURSERA_API_BASE="https://api.coursera.org/api"
railway variables set BASE_URL="https://coursera-mcp-server-production.up.railway.app"
railway variables set PORT="8002"
```

3. **Deploy**
```bash
railway up
```

4. **Get Deployment URL**
```bash
railway status
```

## Environment Variables Required
- `COURSERA_API_KEY` - Coursera API key
- `COURSERA_API_SECRET` - Coursera API secret
- `COURSERA_API_BASE` - Coursera API base URL
- `BASE_URL` - Your Railway deployment URL
- `PORT` - Port to run on (default: 8002)

## Verification
Once deployed, test the server:
```bash
curl https://your-railway-url.up.railway.app/health
```

## Notes
- The server uses `server.ts` (Node.js) instead of `worker.ts` (Cloudflare Workers)
- Coursera API credentials are already configured
- Server runs on port 8002 by default

