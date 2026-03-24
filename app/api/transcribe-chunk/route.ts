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
    const audio = formData.get('audio') as Blob | File | null;
    const sessionId = (formData.get('sessionId') as string) || null;
    const chunkIndex = formData.get('chunkIndex') as string | null;
    const final = formData.get('final') === '1';
    const language = (formData.get('language') as string) || 'es';

    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    const mime = audio.type || 'audio/webm';
    const groqApiKey = process.env.GROQ_API_KEY || process.env.TRANSCRIPTION_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());

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
      return NextResponse.json({ error: 'Transcription failed', details: errText }, { status: resp.status });
    }

    const data = await resp.json();

    return NextResponse.json({ text: data.text || '', sessionId, chunkIndex, final });
  } catch (error) {
    console.error('Transcribe-chunk error:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
