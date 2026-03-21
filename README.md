# Lecture Transcriber - Production-Ready SaaS MVP

A full-stack web application for real-time lecture transcription and AI-powered summarization, deployed serverless on Vercel.

## 🌟 Features

- **🎙️ Live Audio Recording** - Record lectures directly in the browser
- **🗣️ Multi-Language Transcription** - Spanish & English support via Groq Whisper API
- **🤖 AI Summarization** - Automatic generation of:
  - Executive summaries
  - Key points extraction
  - Structured lecture notes
  - Actionable insights
- **📚 Session History** - Store and manage all recordings
- **🏷️ Tagging System** - Organize sessions with custom tags
- **📤 Export Options**:
  - Plain text (.txt)
  - Markdown (.md)
  - JSON (.json)
  - Notion-ready format (copy to clipboard)
- **📱 Responsive Design** - Works on desktop and mobile
- **⚡ Serverless Architecture** - Optimized for Vercel with no persistent connections

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Storage**: Vercel KV (Redis) or in-memory fallback
- **APIs**:
  - **Transcription**: Groq Whisper
  - **Summarization**: Groq LLM (Mixtral)
- **Deployment**: Vercel (serverless)

## 📋 Prerequisites

1. **Node.js** 18+ installed
2. **Git** for version control
3. **Vercel account** (free tier works)
4. **Groq API key** (free with credit)
   - Sign up: https://console.groq.com
   - Get free tier with ~90 requests/day

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd record-audio
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Groq API (for transcription)
GROQ_API_KEY=your_groq_api_key_here

# Groq API (for summarization - can be same key)
GROQ_LLM_API_KEY=your_groq_api_key_here

# Storage (optional for local testing)
USE_KV_DATABASE=false

# For production Vercel KV setup:
# KV_URL=your_kv_url
# KV_REST_API_URL=your_kv_rest_api_url
# KV_REST_API_TOKEN=your_kv_rest_api_token
```

### 4. Get a Groq API Key

1. Go to https://console.groq.com/keys
2. Create a new API key
3. Copy to `.env.local`

### 5. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

## 🎯 Usage Guide

### Recording a Lecture

1. Click "New Recording"
2. Select language (English or Spanish)
3. Click "Start Recording"
4. Speak your lecture
5. Click "Stop Recording"
6. Wait for transcription (auto-summarizes)
7. Session auto-saves

### Managing Sessions

- View all recordings in the sidebar
- Click any session to view details
- Add/remove tags for organization
- Search by title or content
- Delete sessions permanently

### Exporting

From any session:
- **Export as TXT** - Plain text transcript
- **Export as MD** - Markdown with formatting
- **Export as JSON** - Complete session data
- **Copy for Notion** - Copy summary to clipboard for pasting into Notion

## 🏗️ Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── transcribe/route.ts      # Audio transcription endpoint
│   │   ├── summarize/route.ts       # Summarization endpoint
│   │   └── sessions/                # Session CRUD endpoints
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Main page component
│   └── globals.css                  # Global styles
├── components/
│   ├── RecorderComponent.tsx        # Recording UI
│   ├── SessionHistory.tsx           # Session sidebar
│   └── SessionDetail.tsx            # Session view
├── hooks/
│   ├── useRecorder.ts              # Recording & session hooks
│   └── useTranscription.ts         # Transcription hooks
├── lib/
│   ├── types.ts                    # TypeScript types
│   ├── store.ts                    # Zustand store
│   ├── utils.ts                    # Utility functions
│   └── db.ts                       # Database utilities
├── public/                          # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 📡 API Endpoints

### POST `/api/transcribe`
Transcribe audio file

**Request:**
```
FormData:
- audio: Blob (audio/webm)
- language: "en" | "es"
```

**Response:**
```json
{
  "text": "transcribed text...",
  "language": "en",
  "duration": 12345
}
```

### POST `/api/summarize`
Generate summary from transcript

**Request:**
```json
{
  "transcript": "full transcript text..."
}
```

**Response:**
```json
{
  "summary": {
    "executiveSummary": "...",
    "keyPoints": ["...", "..."],
    "lectureNotes": "...",
    "actionableInsights": ["...", "..."]
  }
}
```

### GET `/api/sessions`
Get all sessions

**Response:**
```json
{
  "sessions": [
    {
      "id": "session_1234567890_abc123",
      "title": "Lecture on AI",
      "date": "2024-03-20T10:30:00Z",
      "duration": 1800,
      "language": "en",
      "transcript": "...",
      "summary": {...},
      "tags": ["AI", "ML"],
      "createdAt": "2024-03-20T10:30:00Z",
      "updatedAt": "2024-03-20T10:30:00Z"
    }
  ]
}
```

### POST `/api/sessions`
Create new session

### GET/PUT/DELETE `/api/sessions/:id`
Retrieve, update, or delete specific session

## 🚢 Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Select your repository
4. Skip "Create a Team" if personal
5. Go to Deployment

### 3. Configure Environment Variables

In Vercel Dashboard:
1. Project Settings → Environment Variables
2. Add `GROQ_API_KEY`
3. Add `GROQ_LLM_API_KEY`
4. Deploy

### 4. Optional: Add Vercel KV Storage

**For persistent storage across sessions:**

1. In Vercel Dashboard → Storage → Create Database
2. Select "KV" (Redis)
3. Copy connection environment variables
4. Add to project:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
5. Set `USE_KV_DATABASE=true`

### 5. Deploy

Vercel auto-deploys on every push. Or manually:

```bash
vercel deploy --prod
```

## 🧪 Testing the Full Flow

### Local Testing

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Test API
curl -X GET http://localhost:3000/api/sessions

# In browser: http://localhost:3000
# 1. Record a short 10-second test
# 2. Wait for transcription
# 3. View transcript in sidebar
# 4. Export as TXT
```

### Production Testing

After deployment to Vercel:

1. Visit your Vercel deployment URL
2. Record a test lecture (20-30 seconds works best)
3. Verify transcription appears
4. Check summary generation
5. Test export functionality
6. Verify sessions persist after refresh

## 🔒 Security & Best Practices

- API keys stored as environment secrets
- No sensitive data in client-side code
- CORS configured for Vercel deployment
- HTTPS enforced in production
- Session data validated server-side
- Error messages sanitized

## 📊 Performance Optimization

- Audio chunks compressed before upload
- Transcript chunked for summarization (prevents token limits)
- Lazy-loading of session history
- Optimized re-renders with Zustand
- TailwindCSS purges unused styles
- Next.js automatic code splitting

## 🐛 Troubleshooting

**Issue: "API key not configured"**
- Verify `GROQ_API_KEY` is set in `.env.local`
- For Vercel, check Environment Variables in dashboard

**Issue: Recording not working**
- Check browser microphone permissions
- Works best in Chrome, Firefox, Edge
- Some browsers require HTTPS

**Issue: Transcription timeout**
- Groq has rate limits (~90 requests/day free)
- Consider longer intervals between recordings
- Upgrade Groq plan if needed

**Issue: Vercel KV not working**
- Verify storage is enabled in Vercel dashboard
- Check all KV environment variables are set
- Set `USE_KV_DATABASE=true`

**Issue: Sessions not persisting**
- If KV not set up, data stored in-memory only
- Restarting clears sessions (expected for serverless)
- Set up Vercel KV for persistent storage

## 📈 Production Considerations

### Scaling

- Vercel auto-scales compute resources
- Database: Upgrade Redis plan for more storage
- API: Groq free tier sufficient for ~90 requests/day

### Monitoring

- Monitor Vercel Function logs: Vercel Dashboard → Functions
- Track API errors via Groq API dashboard
- Monitor Vercel KV storage usage

### Maintenance

- Keep Next.js updated: `npm update next`
- Regular backups of important sessions
- Monitor Groq API usage

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| GROQ_API_KEY | Yes | - | Groq Whisper API key |
| GROQ_LLM_API_KEY | Yes | - | Groq LLM API key (can be same) |
| USE_KV_DATABASE | No | false | Enable KV storage |
| KV_URL | Conditional | - | Redis connection URL |
| KV_REST_API_URL | Conditional | - | Redis REST API URL |
| KV_REST_API_TOKEN | Conditional | - | Redis REST API token |

## 🤝 Contributing

Improvements welcome! Areas for enhancement:

- [ ] Multiple user support with auth
- [ ] PDF export with formatting
- [ ] Direct Notion API integration
- [ ] Audio pre-processing (noise reduction)
- [ ] Advanced search with semantic analysis
- [ ] Real-time collaboration features

## 📄 License

MIT License - feel free to use for personal or commercial projects

## 🔗 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Groq API Docs](https://console.groq.com/docs)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## 💡 Tips & Tricks

- Use headphones for better audio quality
- Speak clearly and at normal pace
- Keep lectures under 30 minutes for best results
- Tag sessions consistently for easy filtering
- Export to Notion for collaborative review
- Use markdown export for blog posts

---

**Built with ❤️ using Next.js + Groq AI + Vercel**
