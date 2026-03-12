# SignDesk AI — Intelligent E-Signature Portal

AI-powered document signing. Claude Vision detects signature fields automatically.

## Deploy to Vercel (no local Node.js needed)

### Option A — GitHub (recommended, zero setup)
1. Upload this folder to a new GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. Vercel auto-detects Vite. Click **Deploy**
4. After deploy, go to **Settings → Environment Variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from [console.anthropic.com](https://console.anthropic.com)
5. Go to **Deployments → Redeploy** (so the env var takes effect)

### Option B — Vercel CLI (needs Node.js locally)
```bash
npm install
npm run build       # test the build locally first
npx vercel          # follow prompts
vercel env add ANTHROPIC_API_KEY   # paste your API key
vercel --prod
```

## Local Development
```bash
npm install
# create .env.local and add:  ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

## Project Structure
```
signdesk/
├── api/
│   └── analyze.js       ← Vercel serverless function (secure API proxy)
├── src/
│   ├── main.jsx         ← React entry point
│   └── App.jsx          ← Full application
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## How it works
1. User uploads a signature image
2. User uploads PDF documents
3. PDF pages are rendered to canvas images in the browser
4. Last 3 pages are sent to Claude Vision via `/api/analyze` (serverless proxy)
5. Claude returns exact coordinates of the signature field
6. Green overlay shows detected location on the preview
7. Click Sign → signature is embedded at AI-detected position
8. Download the signed PDF
