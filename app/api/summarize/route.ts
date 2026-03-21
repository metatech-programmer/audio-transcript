import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/summarize
 * Generate structured summary from transcript using LLM
 */
export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Invalid transcript' },
        { status: 400 }
      );
    }

    // Use Groq for fast LLM inference (free tier available)
    const groqApiKey =
      process.env.GROQ_LLM_API_KEY ||
      process.env.LLM_API_KEY ||
      process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'LLM API key not configured' },
        { status: 500 }
      );
    }

    // Chunk transcript if too long (prevent token limits)
    const maxChunkSize = 4000;
    const chunks = chunkTranscript(transcript, maxChunkSize);

    const chunkSummaries: string[] = [];
    for (const chunk of chunks) {
      const chunkPrompt = `Summarize this lecture chunk in concise bullet points:\n\n${chunk}`;
      const chunkResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: chunkPrompt }],
          temperature: 0.2,
          max_tokens: 600,
        }),
      });

      if (!chunkResponse.ok) {
        const error = await chunkResponse.text();
        console.error('Groq chunk summarize error:', error);
        continue;
      }

      const chunkResult = await chunkResponse.json();
      const chunkContent = chunkResult.choices[0]?.message?.content || '';
      if (chunkContent) {
        chunkSummaries.push(chunkContent);
      }
    }

    const consolidatedInput =
      chunkSummaries.length > 0 ? chunkSummaries.join('\n\n') : transcript;

    const prompt = `You are an expert lecture summarizer. Analyze the following lecture transcript and provide a structured summary in JSON format.

Transcript:
${consolidatedInput}

Respond ONLY with valid JSON (no markdown, no extra text) in this exact format:
{
  "executiveSummary": "A 2-3 sentence summary of the entire lecture",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "lectureNotes": "Detailed structured notes from the lecture",
  "actionableInsights": ["insight 1", "insight 2", "insight 3"]
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq LLM error:', error);
      return NextResponse.json(
        { error: 'Summarization failed', details: error },
        { status: response.status }
      );
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content || '';

    // Parse JSON from response
    let summary;
    try {
      summary = normalizeSummary(JSON.parse(content));
    } catch {
      // Fallback if parsing fails
      summary = normalizeSummary({
        executiveSummary: content,
        keyPoints: [],
        lectureNotes: '',
        actionableInsights: [],
      });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summarization error:', error);
    const message =
      error instanceof Error ? error.message : 'Summarization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeSummary(input: unknown) {
  const data =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  const executiveSummary = toText(data.executiveSummary);
  const lectureNotes = toText(data.lectureNotes);
  const keyPoints = toStringList(data.keyPoints);
  const actionableInsights = toStringList(data.actionableInsights);

  return {
    executiveSummary,
    keyPoints,
    lectureNotes,
    actionableInsights,
  };
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
      .filter(Boolean)
      .join('\n');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}`)
      .join('\n');
  }

  return value == null ? '' : String(value);
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item).trim())
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${toText(val)}`.trim())
      .filter(Boolean);
  }

  const text = toText(value).trim();
  return text ? [text] : [];
}

function chunkTranscript(transcript: string, chunkSize: number): string[] {
  const words = transcript.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const word of words) {
    if (currentSize + word.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentSize = word.length;
    } else {
      currentChunk.push(word);
      currentSize += word.length + 1;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.length === 0 ? [transcript] : chunks;
}
