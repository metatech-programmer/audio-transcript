# Testing Guide for Lecture Transcriber

## Manual Testing Checklist

### 1. Local Development Testing

#### Setup

```bash
npm install
npm run dev
# Open http://localhost:3000
```

#### Recording Feature

- [ ] Click "New Recording"
- [ ] Language selector shows English & Spanish
- [ ] "Start Recording" button is clickable
- [ ] Microphone permission prompt appears
- [ ] Timer starts counting
- [ ] Recording indicator shows "Recording..."

#### Audio Capture

- [ ] Record 10-15 seconds of clear speech
- [ ] Speak clearly in English
- [ ] Background noise is minimal
- [ ] Stop recording button becomes active after start

#### Transcription

- [ ] "Stop Recording" button works
- [ ] Processing indicator shows "Transcribing..."
- [ ] Transcript appears within 5-10 seconds
- [ ] Text matches spoken content
- [ ] No critical errors in console

#### Summarization

- [ ] Auto-summary triggers after transcription
- [ ] "Generating summary..." appears
- [ ] Summary includes all sections (executive, key points, notes, insights)
- [ ] Summary is accurate and concise

#### Session Save

- [ ] Session appears in sidebar immediately
- [ ] Session title defaults to current date
- [ ] Duration shows correct seconds
- [ ] Transcript and summary are preserved

### 2. Feature Testing

#### Session History

- [ ] Sidebar displays all recorded sessions
- [ ] Sessions sorted by date (newest first)
- [ ] Click on session loads it
- [ ] Current session highlighted in sidebar

#### Tagging System

- [ ] Click session to view details
- [ ] "Edit" tags button works
- [ ] Can add new tags
- [ ] Tags display with tag names
- [ ] Can remove tags
- [ ] Tags persist after save

#### Search & Filter

- [ ] Type in search box filters sessions
- [ ] Filter works on title and transcript
- [ ] Tag filter buttons appear
- [ ] Click tag filters sessions
- [ ] Multiple tags can be selected

#### Export Functionality

- [ ] Export as TXT downloads file
- [ ] Export as MD downloads markdown file
- [ ] Export as JSON downloads JSON
- [ ] "Copy for Notion" copies markdown to clipboard
- [ ] Exported files contain all session data

#### Responsive Design

- [ ] Desktop: Sidebar + content layout
- [ ] Tablet: Proper spacing
- [ ] Mobile: Single column, toggleable sidebar
- [ ] All buttons clickable on mobile
- [ ] No horizontal scroll needed

### 3. API Testing

#### Transcribe Endpoint

```bash
# Test local
curl -X POST http://localhost:3000/api/transcribe \
  -F "audio=@test_audio.webm" \
  -F "language=en"

# Expected response
{
  "text": "transcribed content...",
  "language": "en"
}
```

#### Summarize Endpoint

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"transcript":"your full transcript here..."}'

# Expected response
{
  "summary": {
    "executiveSummary": "...",
    "keyPoints": ["...", "..."],
    "lectureNotes": "...",
    "actionableInsights": ["...", "..."]
  }
}
```

#### Sessions Endpoints

```bash
# Get all sessions
curl http://localhost:3000/api/sessions

# Create session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{...}'

# Get specific session
curl http://localhost:3000/api/sessions/session_id

# Update session
curl -X PUT http://localhost:3000/api/sessions/session_id \
  -H "Content-Type: application/json" \
  -d '{...}'

# Delete session
curl -X DELETE http://localhost:3000/api/sessions/session_id
```

### 4. Edge Cases

- [ ] Record with no audio (should handle gracefully)
- [ ] Very long recording (>30 minutes)
- [ ] Rapid start/stop cycles
- [ ] No internet connection (show error)
- [ ] API key invalid (show error)
- [ ] Rate limit exceeded (show message)
- [ ] Very long transcript (>10 minutes of content)
- [ ] Special characters in transcript
- [ ] Empty tags input

### 5. Performance Testing

- [ ] Page loads in <2 seconds
- [ ] Transcription completes in <10 seconds
- [ ] Summarization completes in <15 seconds
- [ ] UI remains responsive during processing
- [ ] No memory leaks (check DevTools)
- [ ] No console errors
- [ ] Audio file size < 1MB per minute

### 6. Cross-Browser Testing

| Browser       | Recording | Transcribe | Summary | Export | Notes                  |
| ------------- | --------- | ---------- | ------- | ------ | ---------------------- |
| Chrome        | ✓         | ✓          | ✓       | ✓      | Primary testing target |
| Firefox       | ✓         | ✓          | ✓       | ✓      | Full support           |
| Safari        | ✓         | ✓          | ✓       | ✓      | 14.1+ required         |
| Edge          | ✓         | ✓          | ✓       | ✓      | Chromium-based         |
| Mobile Safari | ✓         | ✓          | ✓       | ✓      | iOS 14.5+              |
| Chrome Mobile | ✓         | ✓          | ✓       | ✓      | Android 6+             |

### 7. Deployment Testing (Vercel)

#### Pre-Deployment

- [ ] `npm run build` succeeds
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] All tests pass (if applicable)

#### Post-Deployment

- [ ] Site loads at Vercel URL
- [ ] HTTPS certificate valid
- [ ] Recording works
- [ ] Transcription works
- [ ] All API endpoints respond
- [ ] Sessions persist (if KV enabled)
- [ ] No 500 errors in logs
- [ ] < 3 second response times

### 8. Load Testing

```bash
# Simple load test (requires Apache Bench or similar)
ab -n 100 -c 10 https://your-deployment.vercel.app/

# Expected: All requests complete successfully
```

### 9. Security Testing

- [ ] API keys not exposed in browser console
- [ ] No sensitive data in localStorage
- [ ] HTTPS enforced
- [ ] CORS headers correct
- [ ] Environment variables not logged
- [ ] SQL injection not possible (using KV, not SQL)
- [ ] XSS protection in place (Next.js default)

### 10. Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Focus visible on all buttons
- [ ] Color contrast sufficient
- [ ] Screen reader compatible (basic)
- [ ] Form labels associated
- [ ] Error messages clear

**... (file continues with additional testing instructions)**
