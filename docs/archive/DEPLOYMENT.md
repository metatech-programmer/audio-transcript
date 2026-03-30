# DEPLOYMENT GUIDE - Lecture Transcriber to Vercel

## Complete Step-by-Step Deployment Instructions

### Phase 1: Local Setup (5 minutes)

#### 1.1 Clone & Install

```bash
git clone <your-repo-url>
cd record-audio
npm install
```

#### 1.2 Get Groq API Key

1. Visit: https://console.groq.com/keys
2. Sign in (or create free account)
3. Create a new API key
4. Copy the key

#### 1.3 Configure Local Environment

Create `.env.local` in project root:

```env
GROQ_API_KEY=gsk_your_key_here
GROQ_LLM_API_KEY=gsk_your_key_here
USE_KV_DATABASE=false
```

#### 1.4 Test Locally

```bash
npm run dev
```

Visit: http://localhost:3000

**Quick test:**

- Click "New Recording"
- Record 10 seconds of audio
- Verify transcription appears
- Stop and check summary

### Phase 2: GitHub Setup (5 minutes)

#### 2.1 Initialize Git

```bash
cd record-audio
git init
git add .
git commit -m "Initial commit: Lecture Transcriber MVP"
```

#### 2.2 Push to GitHub

1. Create repository on GitHub: https://github.com/new
2. Name: `lecture-transcriber`
3. Don't initialize with README (we have one)
4. Create repository

```bash
git remote add origin https://github.com/YOUR_USERNAME/lecture-transcriber.git
git branch -M main
git push -u origin main
```

### Phase 3: Vercel Deployment (5 minutes)

#### 3.1 Import Project

1. Go to: https://vercel.com/new
2. Click "Import Git Repository"
3. Paste your repo URL: `https://github.com/YOUR_USERNAME/lecture-transcriber`
4. Click "Import"

#### 3.2 Configure Project

**Project Name:** `lecture-transcriber`

**Framework Preset:** Next.js (should auto-detect)

**Root Directory:** `.` (default)

#### 3.3 Add Environment Variables

Click "Environment Variables" and add:

| Name             | Value          | Environments                     |
| ---------------- | -------------- | -------------------------------- |
| GROQ_API_KEY     | `gsk_your_key` | Production, Preview, Development |
| GROQ_LLM_API_KEY | `gsk_your_key` | Production, Preview, Development |
| USE_KV_DATABASE  | `false`        | Production, Preview, Development |

#### 3.4 Deploy

Click "Deploy"

Wait 2-3 minutes for deployment to complete.

### Phase 4: Verification (2 minutes)

#### 4.1 Test Deployment

1. Vercel will provide a deployment URL (usually `https://lecture-transcriber.vercel.app`)
2. Visit the URL
3. Record test audio
4. Verify all features work

#### 4.2 Set Production Domain (Optional)

If you have a custom domain:

1. Vercel Dashboard → Project Settings → Domains
2. Add your domain
3. Follow DNS configuration steps

### Phase 5: Optional - Add Persistent Storage (10 minutes)

For data to persist between function invocations:

#### 5.1 Create Vercel KV Database

1. Vercel Dashboard → Storage → Create Database
2. Select "KV" (Redis)
3. Name: `lecture-transcriber-db`
4. Select region
5. Click "Create"

#### 5.2 Add KV Environment Variables

Copy these from the KV database page:

1. Go back to your project Settings → Environment Variables
2. Add:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
3. Add `USE_KV_DATABASE=true`

#### 5.3 Redeploy

1. Make a small commit to trigger redeployment:
   ```bash
   git commit --allow-empty -m "Enable KV storage"
   git push
   ```
2. Or manually deploy through Vercel dashboard

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser                            │
│  (Recording UI, Session List, Export)                │
└────────────────┬──────────────────────────────────────┘
                 │ HTTP
                 │
┌────────────────▼──────────────────────────────────────┐
│           Vercel Edge/Functions (Next.js)             │
│  ┌────────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ /api/transcribe│ │/api/summarize│ │/api/sessions│ │
│  └────────┬───────┘ └───────┬──────┘ └──────┬──────┘ │
└───────────┼──────────────────┼───────────────┼────────┘
            │                  │               │
   ┌────────▼────────┐ ┌──────▼────────┐    │
   │   Groq API      │ │  Groq LLM     │    │
   │  (Whisper)      │ │  (Mixtral)    │    │
   │                 │ │               │    │
   └─────────────────┘ └───────────────┘    │
                                      ┌─────▼──────────┐
                                      │  Vercel KV     │
                                      │  (Optional)    │
                                      └────────────────┘
```

## Security Checklist

- [ ] API keys stored in Vercel environment variables (not in code)
- [ ] `.env.local` added to `.gitignore`
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] No sensitive data in component code
- [ ] API routes validate all inputs
- [ ] Error messages don't expose internal details

## Performance Checklist

- [ ] Audio compressed before upload (~50-500KB per minute)
- [ ] Transcripts chunked before summarization (prevents token limits)
- [ ] Database queries optimized
- [ ] TailwindCSS styles purged
- [ ] Functions execute under 10 seconds

## Monitoring & Logs

### Check Deployment Logs

Vercel Dashboard → Deployments → Click deployment → View Logs

### Monitor Function Execution

Vercel Dashboard → Functions → View logs for each endpoint

### Check API Usage

Groq Console → Usage Analytics

## Troubleshooting Deployment Issues

### Issue: Build Fails

**Error:** `ERR! Build failed`

**Solution:**

```bash
npm cache clean --force
npm install
npm run build
```

Then redeploy.

### Issue: 500 Error on /api/transcribe

**Check:**

1. Vercel logs for error details
2. Verify `GROQ_API_KEY` is set
3. Check Groq API status page
4. Verify rate limit not exceeded

**Common cause:** Groq free tier has ~90 requests/day limit

### Issue: Sessions Not Persisting

**Check:**

1. Is `USE_KV_DATABASE` set to `true`?
2. Are KV environment variables configured?
3. Check if KV database is active

**For testing:** Use `USE_KV_DATABASE=false` (data in-memory)

### Issue: Audio Not Recording

**Check:**

1. Browser supports MediaRecorder API (most modern browsers)
2. User granted microphone permission
3. HTTPS enabled (required for mic access)

**Test in:**

- Chrome ✅
- Firefox ✅
- Safari 14.1+ ✅
- Edge ✅

### Issue: Slow Transcription

**Causes:**

1. Network latency
2. Audio too long (process in chunks)
3. Groq API slow (depends on load)

**Solution:** Break long recordings into segments

## Deployment Checklist

Before going live:

- [ ] Test all features locally
- [ ] Push code to GitHub
- [ ] Create Vercel project
- [ ] Configure environment variables
- [ ] Initial deployment succeeds
- [ ] Test recording → transcription → summary flow
- [ ] Test export functionality
- [ ] Verify responsive design on mobile
- [ ] Check performance (< 5s transcription on typical hardware)
- [ ] Set up monitoring/alerts (optional)

## Next Steps After Deployment

1. **Share the link** with users
2. **Monitor logs** for errors
3. **Track API usage** (Groq console)
4. **Collect feedback**
5. **Plan improvements:**
   - User authentication
   - Additional language support
   - Advanced search
   - PDF export with formatting
   - Real-time collaboration

## Scaling Notes

**Free tier supports:**

- ~90 transcriptions/day (Groq limit)
- ~1000 sessions (depending on storage)
- ~100 concurrent users

**For production:**

1. Upgrade Groq plan
2. Set up Vercel KV (persistent storage)
3. Monitor function execution time
4. Consider CDN for large files
5. Implement rate limiting

## Cost Estimation

| Service         | Free Tier                          | Production           |
| --------------- | ---------------------------------- | -------------------- |
| Vercel          | ✅ (12 function invocations/month) | $2.50 +              |
| Groq            | ~$2 free credits (~90 requests)    | $0.005-$0.01/request |
| Vercel KV       | Up to 10MB                         | $0.20/GB storage     |
| **Total (MVP)** | **Free**                           | **$5-10/month**      |

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Groq API Docs:** https://console.groq.com/docs
- **Community:** [GitHub Discussions](https://github.com/yourname/lecture-transcriber/discussions)

---

**Deployment complete! 🎉**

Your app is now live and accessible worldwide on Vercel's serverless edge network.
