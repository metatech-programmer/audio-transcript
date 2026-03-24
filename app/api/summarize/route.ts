import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/summarize
 * Generate structured summary from transcript using LLM
 * Supports Spanish and English transcripts with language-specific prompts
 */
export async function POST(request: NextRequest) {
  try {
    const { transcript, language = 'en' } = await request.json();

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
    const maxChunkSize = 5000;
    const chunks = chunkTranscript(transcript, maxChunkSize);

    const chunkSummaries: string[] = [];
    for (const chunk of chunks) {
      const chunkPrompt = getChunkPrompt(chunk, language);
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
          max_tokens: 800,
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

    const prompt = getFinalPrompt(consolidatedInput, language);

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
        temperature: 0.4,
        max_tokens: 2500,
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

function getChunkPrompt(chunk: string, language: string): string {
  if (language === 'es') {
    return `Eres un experto en tomar notas universitarias. Analiza este fragmento de clase y extrae:\n- Conceptos clave\n- Definiciones\n- Ejemplos\n- Explicaciones\n- Conexiones entre temas\nResponde solo con puntos clave, sin texto adicional.\n\n${chunk}`;
  }
  return `You are an expert university note-taker. Analyze this lecture fragment and extract:\n- Key concepts\n- Definitions\n- Examples\n- Explanations\n- Connections between topics\nRespond only with key point bullets, no extra text.\n\n${chunk}`;
}

function getFinalPrompt(consolidatedInput: string, language: string): string {
  if (language === 'es') {
    return `Eres un experto en resumir clases universitarias. Tu objetivo es generar notas profundas, claras y bien estructuradas, como si fueras el mejor estudiante de la clase.

Analiza la siguiente transcripción de una clase completa (puede durar varias horas) y responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional) en este formato exacto:
{
  "executiveSummary": "Resumen ejecutivo de 2-4 oraciones que capture la esencia completa de la clase, incluyendo contexto, propósito y conclusiones principales.",
  "keyPoints": [
    "Punto 1: Concepto u idea principal con detalles y ejemplos",
    "Punto 2: Concepto u idea principal con detalles y ejemplos",
    "Punto 3: Concepto u idea principal con detalles y ejemplos",
    "Punto 4: Concepto u idea principal con detalles y ejemplos",
    "Punto 5: Concepto u idea principal con detalles y ejemplos"
  ],
  "lectureNotes": "Notas detalladas y estructuradas como un cuaderno bien organizado. Incluye:\n- TEMAS PRINCIPALES: Títulos y subtemas\n- DEFINICIONES: Conceptos clave y sus definiciones\n- EJEMPLOS: Ejemplos específicos\n- EXPLICACIONES: Detalles técnicos y explicaciones profundas\n- ESTRUCTURA LÓGICA: Cómo conectan los conceptos\n- CONEXIONES: Relaciones entre temas\n- RESUMENES PARCIALES: Si la clase es larga, incluye resúmenes por sección\n\nFormato como texto estructurado con saltos de línea, sin viñetas. Sé lo más detallado y claro posible.",
  "actionableInsights": [
    "Insight 1: Aplicación práctica, consejo o concepto clave para recordar",
    "Insight 2: Aplicación práctica, consejo o concepto clave para recordar",
    "Insight 3: Aplicación práctica, consejo o concepto clave para recordar"
  ]
}

TRANSCRIPCIÓN:
${consolidatedInput}`;
  }

  return `You are an expert in summarizing university lectures. Your goal is to generate deep, clear and well-structured notes, as if you were the best student in the class.

Analyze the following transcript of a complete lecture (may last several hours) and respond ONLY with valid JSON (no markdown, no extra text) in this exact format:
{
  "executiveSummary": "Executive summary of 2-4 sentences that captures the complete essence of the lecture, including context, purpose and main conclusions.",
  "keyPoints": [
    "Point 1: Main concept or idea with details and examples",
    "Point 2: Main concept or idea with details and examples",
    "Point 3: Main concept or idea with details and examples",
    "Point 4: Main concept or idea with details and examples",
    "Point 5: Main concept or idea with details and examples"
  ],
  "lectureNotes": "Detailed and structured notes like a well-organized notebook. Include:\n- MAIN TOPICS: Main titles and subtopics\n- DEFINITIONS: Key concepts and their definitions\n- EXAMPLES: Specific examples\n- EXPLANATIONS: Technical details and deep explanations\n- LOGICAL STRUCTURE: How concepts connect\n- CONNECTIONS: Relationships between topics\n- PARTIAL SUMMARIES: If the lecture is long, include summaries by section\n\nFormat as structured text with line breaks, without bullet points. Be as detailed and clear as possible.",
  "actionableInsights": [
    "Insight 1: Practical application, advice or key concept to remember",
    "Insight 2: Practical application, advice or key concept to remember",
    "Insight 3: Practical application, advice or key concept to remember"
  ]
}

TRANSCRIPT:
${consolidatedInput}`;
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
