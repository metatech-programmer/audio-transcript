# System Architecture & Technical Design

## Overview

Lecture Transcriber is a **serverless, web-native SaaS application** designed for instant deployment on Vercel's edge network without any backend maintenance.

## Architecture Diagram

```
┌─────────────────────────────────────┐
│         Client (Browser)             │
│  ┌──────────────────────────────────┐│
│  │ React Components (Typescript)    ││
│  │ - RecorderComponent              ││
│  │ - SessionHistory                 ││
│  │ - SessionDetail                  ││
│  │ - Export functionality           ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ State Management (Zustand)       ││
│  │ - Global app state               ││
│  │ - UI state                       ││
│  │ - Session cache                  ││
│  └──────────────────────────────────┘│
└────────┬─────────────────────────────┘
         │ HTTP/HTTPS (REST)
         │
┌────────▼──────────────────────────────────────┐
│    Vercel Serverless Functions (Next.js)      │
│  - No persistent connections                  │
│  - Short-lived execution (≤600s)              │
│  - Stateless by design                        │
│  ┌─────────────┐ ┌──────────────┐ ┌────────┐ │
│  │ /transcribe │ │ /summarize   │ │/sessions│ │
│  └──────┬──────┘ └────────┬─────┘ └───┬────┘ │
└─────────┼──────────────────┼──────────┼──────┘
          │                  │          │
    ┌─────▼─────┐    ┌──────▼──────┐  │
    │ Groq API  │    │ Groq LLM    │  │
    │ (Whisper) │    │ (Mixtral)   │  │
    └───────────┘    └─────────────┘  │
                          ┌────────────▼──────────┐
                          │  Vercel KV (Redis)    │
                          │  (Optional - for      │
                          │   persistent storage) │
                          └───────────────────────┘
```

## Data Flow

### 1. Recording → Transcription

```
User Records Audio
    ↓
MediaRecorder API (browser)
    ↓ (chunks every 1 second)
Send to /api/transcribe
    ↓
Groq Whisper API
    ↓
Return JSON {text, language}
    ↓
Display in UI + Store in Zustand
```

### 2. Transcription → Summarization

```
User stops recording (auto triggers)
    ↓
Send full transcript to /api/summarize
    ↓
Format prompt for LLM
    ↓
Groq Mixtral LLM
    ↓
Parse JSON response
    ↓
Return structured summary
    ↓
Save to session + Display in UI
```

### 3. Session Management

```
Save Session
    ↓
POST /api/sessions
    ↓
Generate ID + Timestamp
    ↓
Save to Vercel KV (if enabled)
    ↓
Return session object
    ↓
Add to Zustand store
    ↓
Sync UI
```

## Technology Decisions

### Why Next.js?

✅ Built-in API routes (no separate backend needed)
✅ Serverless deployment to Vercel (1-click)
✅ TypeScript support out-of-box
✅ Server/Client components (zero JS overhead)
✅ Automatic code splitting
✅ Image optimization
✅ ISR (Incremental Static Regeneration) ready

### Why Zustand for State?

✅ Minimal (~2KB gzipped)
✅ No boilerplate (no actions, reducers)
✅ Easy to test
✅ TypeScript friendly
✅ Integrates with DevTools

vs. Redux: Overkill for single-user app
vs. Context: Triggers unnecessary re-renders
vs. MobX: Complex dependency tracking

### Why MediaRecorder API?

✅ Native browser API
✅ No external libraries needed
✅ Supports all modern browsers
✅ Can record in WebM (small files)
✅ Real-time data available

### Why Groq for Transcription?

✅ Fast inference (⚡ specializes in speed)
✅ Free tier available (~90 requests/day)
✅ Whisper model (industry standard)
✅ Multi-language support
✅ Lower cost than OpenAI Whisper

### Why Groq LLM for Summarization?

✅ Free tier with decent limits
✅ Mixtral 8x7B (fast & accurate)
✅ Good context window (32k tokens)
✅ Structured output support (JSON)
✅ Competitive pricing

### Why Vercel KV (Redis)?

✅ Integrated with Vercel (1-click setup)
✅ No maintenance required
✅ Free tier for MVP
✅ Durable & fast
✅ Rest API access (no WebSockets)
✅ Backup & replication included

## Component Hierarchy

```
app/page.tsx (Root)
│
├── SessionHistory (Sidebar)
│   ├── Search input
│   ├── Tag filters
│   └── Session list
│       └── Session item (click to select)
│
└── Main Content
    ├── RecorderComponent (view: recorder)
    │   ├── Language selector
    │   ├── Timer
    │   ├── Start/Stop buttons
    │   └── Transcript preview
    │
    └── SessionDetail (view: session)
        ├── Session title & metadata
        ├── Tag manager
        ├── Summary display
        ├── Full transcript
        └── Export buttons
```

## State Management Structure

```typescript
AppStore (Zustand)
│
├── Recorder State
│   ├── isRecording: boolean
│   ├── isPaused: boolean
│   ├── duration: number
│   ├── transcript: string
│   ├── language: 'en' | 'es'
│   ├── isSummarizing: boolean
│   └── error: string | null
│
├── Sessions
│   ├── sessions: Session[]
│   ├── currentSession: Session | null
│
└── UI
    ├── selectedTags: string[]
    └── searchQuery: string
```

## API Endpoint Design

### POST /api/transcribe

**Serverless Function:**
- Receives: FormData (audio blob + language)
- Process: Call Groq Whisper API
- Return: {text, language}
- Timeout: 30s
- Replicas: Auto-scaled by Vercel

**Error Handling:**
```
Missing audio → 400
API key invalid → 500
Groq timeout → 504
Audio too large → 413
```

### POST /api/summarize

**Serverless Function:**
- Receives: JSON {transcript}
- Process: Chunk transcript, call LLM
- Return: {summary: {executiveSummary, keyPoints, lectureNotes, actionableInsights}}
- Timeout: 60s
- Chunk strategy: Split if > 4000 words

**Stream handling:**
Groq returns complete response (no streaming needed for MVP)

### GET/POST/PUT/DELETE /api/sessions[/:id]

**CRUD Operations:**
- GET /api/sessions: List all (sorted by date)
- POST /api/sessions: Create new
- GET /api/sessions/:id: Get specific
- PUT /api/sessions/:id: Update
- DELETE /api/sessions/:id: Delete

**Error Handling:**
```
Missing ID → 400
Not found → 404
Invalid data → 422
Rate limited → 429
```

## Database Schema (KV/Redis)

```
// Session storage
Key: session:{id}
Value: {
  id: string
  title: string
  date: ISO8601
  duration: number
  language: 'en' | 'es'
  transcript: string
  summary: {...}
  tags: string[]
  createdAt: ISO8601
  updatedAt: ISO8601
}

// Session index
Key: sessions:list
Value: [id1, id2, id3, ...] (sorted by date)
```

## Performance Characteristics

### Transcription
- Audio chunk processing: 100-500ms per request
- Groq API latency: 500ms - 2s
- Client rendering: <100ms
- **Total: 1-3 seconds**

### Summarization
- Groq LLM inference: 2-5 seconds
- JSON parsing: <100ms
- **Total: 2-6 seconds**

### Session Save
- Database write: <100ms
- Zustand update: <10ms
- **Total: <200ms**

## Error Handling Strategy

### Client-side
```
Try/catch around API calls
↓
Set error state in Zustand
↓
Display error message
↓
User can retry
```

### Server-side
```
Validate input
↓
Try external API call
↓
Catch specific errors
↓
Return appropriate HTTP status
↓
Log to Vercel Functions logs
```

## Security Measures

### API Security
- API keys stored as environment secrets (never in code)
- HTTPS enforced (Vercel automatic)
- CORS headers configured
- No authentication required (single-user)
- Input validation on all endpoints

### Data Security
- No PII stored
- Session data client-side encrypted optional
- HTTPS for all communication
- No third-party tracking

### Deployment Security
- Environment variables isolated per deployment
- No logs contain sensitive data
- Credentials never committed to git

## Optimization Techniques

### Frontend
1. **Code Splitting**: Next.js automatic
2. **Tree Shaking**: TailwindCSS PurgeCSS
3. **Lazy Loading**: React.lazy components
4. **Image Optimization**: Next.js Image component
5. **Caching**: Zustand for local state

### Backend
1. **Connection Pooling**: Vercel Functions managed
2. **Request Batching**: Not needed (stateless)
3. **Compression**: Gzip automatic
4. **Caching**: KV cache for frequent queries
5. **Chunking**: Large transcripts split before LLM

### Network
1. **HTTP/2**: Vercel provides
2. **Preload Links**: Next.js prefetch
3. **Minification**: Automatic
4. **Compression**: Brotli (Vercel default)

## Scalability

### Current Limits
- **Groq free tier**: ~90 requests/day
- **Vercel functions**: 12/month free, unlimited pro
- **KV storage**: 10GB free, more available
- **Execution time**: 60s max per function

### Scaling Strategy
1. **Groq**: Upgrade plan for more daily limits
2. **Functions**: Vercel auto-scales horizontally
3. **Storage**: Start with free KV, upgrade tier
4. **Concurrency**: Vercel handles automatic

## Monitoring & Observability

### Logs
- Vercel Functions dashboard → View logs
- Errors exported to stderr
- Timestamps & request IDs included

### Metrics
- Response time per function
- Error rate & types
- API usage (Groq dashboard)
- Storage usage (Vercel KV)

### Health Checks
```bash
# Check deployment status
curl https://your-deployment.vercel.app/api/sessions

# Monitor logs
vercel logs your-project-name

# Check API usage
# Groq: https://console.groq.com
```

---

This architecture is **production-ready** for single to low-concurrency users and can scale to thousands with minimal configuration changes.
