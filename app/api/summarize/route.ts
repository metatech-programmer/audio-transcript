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
    return `Analiza este fragmento de una clase y genera un resumen en puntos clave, manteniendo todos los conceptos, definiciones y ejemplos importantes:\n\n${chunk}`;
  }
  return `Analyze this lecture fragment and create a summary with key point bullets, keeping all important concepts, definitions and examples:\n\n${chunk}`;
}

function getFinalPrompt(consolidatedInput: string, language: string): string {
  if (language === 'es') {
    return `Eres un experto en resumir clases universitarias. Tu objetivo es generar notas detalladas y bien estructuradas, como si fueras un estudiante excelente tomando notas en un cuaderno.

Analiza la siguiente transcripción de una clase completa (que puede durar 1-3 horas) y proporciona un resumen estructurado en formato JSON.

TRANSCRIPCIÓN:
${consolidatedInput}

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional) en este formato exacto:
{
  "executiveSummary": "Resumen ejecutivo de 2-3 oraciones que capture la esencia completa de la clase",
  "keyPoints": [
    "Punto 1: Concepto u idea principal con detalles",
    "Punto 2: Concepto u idea principal con detalles",
    "Punto 3: Concepto u idea principal con detalles",
    "Punto 4: Concepto u idea principal con detalles",
    "Punto 5: Concepto u idea principal con detalles"
  ],
  "lectureNotes": "Notas detalladas y estructuradas como un cuaderno bien organizado. Incluye:\n- TEMAS PRINCIPALES: Títulos y subtemas principales\n- DEFINICIONES: Conceptos clave y sus definiciones\n- EJEMPLOS: Ejemplos específicos mencionados\n- EXPLICACIONES: Detalles técnicos y explicaciones profundas\n- ESTRUCTURA LÓGICA: Cómo conectan los conceptos\n- CONEXIONES: Relaciones entre temas\n\nFormat como texto estruturado con saltos de línea, sin viñetas. Sé lo más detallado posible.",
  "actionableInsights": [
    "Insight 1: Aplicación práctica o concepto a recordar",
    "Insight 2: Aplicación práctica o concepto a recordar",
    "Insight 3: Aplicación práctica o concepto a recordar"
  ]
}`;
  }

  return `You are an expert in summarizing university lectures. Your goal is to generate detailed and well-structured notes, as if you were an excellent student taking notes in a notebook.

Analyze the following transcript of a complete lecture (which can last 1-3 hours) and provide a structured summary in JSON format.

TRANSCRIPT:
${consolidatedInput}

Respond ONLY with valid JSON (no markdown, no extra text) in this exact format:
{
  "executiveSummary": "Executive summary of 2-3 sentences that captures the complete essence of the lecture",
  "keyPoints": [
    "Point 1: Main concept or idea with details",
    "Point 2: Main concept or idea with details",
    "Point 3: Main concept or idea with details",
    "Point 4: Main concept or idea with details",
    "Point 5: Main concept or idea with details"
  ],
  "lectureNotes": "Detailed and structured notes like a well-organized notebook. Include:\n- MAIN TOPICS: Main titles and subtopics mentioned\n- DEFINITIONS: Key concepts and their definitions\n- EXAMPLES: Specific examples provided\n- EXPLANATIONS: Technical details and deep explanations\n- LOGICAL STRUCTURE: How concepts connect\n- CONNECTIONS: Relationships between topics\n\nFormat as structured text with line breaks, without bullet points. Be as detailed as possible.",
  "actionableInsights": [
    "Insight 1: Practical application or key concept to remember",
    "Insight 2: Practical application or key concept to remember",
    "Insight 3: Practical application or key concept to remember"
  ]
}`;
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
