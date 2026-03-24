import { NextRequest, NextResponse } from 'next/server';

function normalizeFilenameByMimeType(mimeType: string): string {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('m4a') || mimeType.includes('mp4')) return 'audio.m4a';
  return 'audio.webm';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Debug: log incoming form fields and audio metadata to help diagnose 400s
    try {
      const entries: Array<any> = [];
      for (const [k, v] of formData.entries()) {
        if (v instanceof Blob) {
          entries.push({ key: k, kind: 'Blob', size: v.size, type: v.type });
        } else {
          entries.push({ key: k, kind: typeof v, value: String(v).slice(0, 200) });
        }
      }
      console.debug('transcribe-chunk: received form entries ->', entries);
    } catch (e) {
      console.debug('transcribe-chunk: failed to inspect formData', e);
    }

    const audio = formData.get('audio') as Blob | File | null;
    const sessionId = (formData.get('sessionId') as string) || null;
    const chunkIndex = formData.get('chunkIndex') as string | null;
    const final = formData.get('final') === '1';
    const language = (formData.get('language') as string) || 'es';

    if (!audio) {
      // Provide received fields for debugging
      return NextResponse.json({ error: 'No audio provided', received: 'no-audio' }, { status: 400 });
    }

    const mime = audio.type || 'audio/webm';
    const groqApiKey = process.env.GROQ_API_KEY || process.env.TRANSCRIPTION_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());

    // In dev, log a short base64 snippet (first 1KB) to help debug malformed uploads
    let snippet: string | undefined = undefined;
    try {
      if (process.env.NODE_ENV !== 'production') {
        const max = Math.min(buffer.length, 1024);
        snippet = buffer.slice(0, max).toString('base64');
        console.debug('transcribe-chunk: audio size=', buffer.length, 'snippet_base64_len=', snippet.length);
      }
    } catch (e) {
      console.debug('transcribe-chunk: failed to generate audio snippet', e);
    }

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mime }), normalizeFilenameByMimeType(mime));
    form.append('model', 'whisper-large-v3');
    form.append('language', language === 'es' ? 'es' : 'en');

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: form,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Groq chunk error:', errText);
      const payload: any = { error: 'Transcription failed', details: errText };
      if (process.env.NODE_ENV !== 'production' && snippet) payload.snippet_base64 = snippet;
      return NextResponse.json(payload, { status: resp.status });
    }

    const data = await resp.json();

    return NextResponse.json({ text: data.text || '', sessionId, chunkIndex, final });
  } catch (error) {
    console.error('Transcribe-chunk error:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
