import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/summarize
 * Generate structured summary from transcript using LLM
 * Supports Spanish and English transcripts with language-specific prompts
 */
export async function POST(request: NextRequest) {
  try {
    const { transcript, language = "en" } = await request.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Invalid transcript" }, { status: 400 });
    }

    // Use Groq for fast LLM inference (free tier available)
    const groqApiKey =
      process.env.GROQ_LLM_API_KEY || process.env.LLM_API_KEY || process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json({ error: "LLM API key not configured" }, { status: 500 });
    }

    // Chunk transcript if too long (prevent token limits)
    const maxChunkSize = 5000;
    const chunks = chunkTranscript(transcript, maxChunkSize);

    const chunkSummaries: string[] = [];
    for (const chunk of chunks) {
      const chunkPrompt = getChunkPrompt(chunk, language);
      const chunkResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: chunkPrompt }],
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (!chunkResponse.ok) {
        const error = await chunkResponse.text();
        console.error("Groq chunk summarize error:", error);
        continue;
      }

      const chunkResult = await chunkResponse.json();
      const chunkContent = chunkResult.choices[0]?.message?.content || "";
      if (chunkContent) {
        chunkSummaries.push(chunkContent);
      }
    }

    const consolidatedInput = chunkSummaries.length > 0 ? chunkSummaries.join("\n\n") : transcript;

    const prompt = getFinalPrompt(consolidatedInput, language);

    let content = "";
    let summary;
    let groqFailed = false;
    // --- PRIMER INTENTO: GROQ ---
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2500,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      content = result.choices[0]?.message?.content || "";
      try {
        summary = normalizeSummary(JSON.parse(content));
      } catch {
        summary = normalizeSummary({
          executiveSummary: content,
          keyPoints: [],
          lectureNotes: "",
          actionableInsights: [],
        });
      }
      return NextResponse.json({ summary });
    } else {
      groqFailed = true;
    }

    // --- SEGUNDO INTENTO: GEMINI 2.5 FLASH ---
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Summarization failed (Groq and Gemini not available)", details: error },
        { status: 500 }
      );
    }
    // Gemini API expects a different payload
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        geminiApiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2500 },
        }),
      }
    );
    if (!geminiRes.ok) {
      const error = await geminiRes.text();
      return NextResponse.json(
        { error: "Summarization failed (Groq and Gemini)", details: error },
        { status: geminiRes.status }
      );
    }
    const geminiData = await geminiRes.json();
    // Gemini response parsing
    let geminiText = "";
    try {
      geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch {}
    if (!geminiText) {
      geminiText = JSON.stringify(geminiData);
    }
    try {
      summary = normalizeSummary(JSON.parse(geminiText));
    } catch {
      summary = normalizeSummary({
        executiveSummary: geminiText,
        keyPoints: [],
        lectureNotes: "",
        actionableInsights: [],
      });
    }
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error);
    const message = error instanceof Error ? error.message : "Summarization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getChunkPrompt(chunk: string, language: string): string {
  if (language === "es") {
    return `Eres un experto en tomar notas universitarias. Analiza este fragmento de clase y extrae:\n- Conceptos clave\n- Definiciones\n- Ejemplos\n- Explicaciones\n- Conexiones entre temas\nResponde solo con puntos clave, sin texto adicional.\n\n${chunk}`;
  }
  return `You are an expert university note-taker. Analyze this lecture fragment and extract:\n- Key concepts\n- Definitions\n- Examples\n- Explanations\n- Connections between topics\nRespond only with key point bullets, no extra text.\n\n${chunk}`;
}

function getFinalPrompt(consolidatedInput: string, language: string): string {
  if (language === "es") {
    return `Eres un experto en resumir clases de maestría. Genera un resumen académico de ALTA COMPLEJIDAD y FORMATO ESTRICTO.

Analiza la siguiente transcripción completa (puede durar varias horas) y responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Debe respetar exactamente la siguiente estructura de objetos (incluye campos opcionales cuando no haya información explícita):

{
  "metadata": {
    "subject": "Nombre de la asignatura",
    "unit": "Unidad / módulo",
    "sessionNumber": "Número de sesión",
    "thematicAxis": "Eje temático (ej. Arquitectura de Software)",
    "keywords": ["keyword1", "keyword2"]
  },
  "learningOutcomes": {
    "competencies": ["Competencia 1", "Competencia 2"],
    "mainProblem": "Problema principal que aborda la sesión"
  },
  "theoreticalCore": {
    "concepts": "Conceptos fundamentales y definiciones técnicas (detallado)",
    "modelsStandards": "Modelos, estándares o frameworks citados",
    "referencedAuthors": ["Autor A", "Paper B"]
  },
  "comparativeAnalysis": {
    "prosCons": "Ventajas y desventajas",
    "comparisons": "Comparación con alternativas",
    "contextOfUse": "Contexto de uso"
  },
  "examples": {
    "academicExample": "Ejemplo académico detallado",
    "caseStudy": "Caso de estudio real",
    "antipatterns": "Anti-patrones"
  },
  "technicalComponent": {
    "codeSnippets": "Fragmentos de código o pseudocódigo",
    "tools": ["herramienta1", "libreríaX"],
    "diagrams": "Descripción de diagramas/arquitectura"
  },
  "debate": {
    "controversies": "Puntos polémicos",
    "participantContributions": "Aportes relevantes de estudiantes"
  },
  "interdisciplinary": {
    "relations": "Relación con otras materias",
    "workplaceApplications": "Aplicaciones en entornos laborales"
  },
  "executiveSummary": "Resumen ejecutivo (2-4 oraciones)",
  "keyPoints": ["Punto clave 1", "Punto clave 2"],
  "lectureNotes": "Notas estructuradas, con secciones y resúmenes parciales cuando aplique",
  "keyTakeaways": ["Takeaway 1","Takeaway 2","Takeaway 3"],
  "actionableInsights": ["Insight 1","Insight 2"],
  "references": {
    "readings": ["Referencia 1", "Referencia 2"],
    "questionsForStudy": ["Pregunta 1", "Pregunta 2"]
  }
}

TRANSCRIPCIÓN:
${consolidatedInput}`;
  }

  return `You are an expert summarizer for graduate-level lectures. Produce a HIGH-COMPLEXITY academic summary in STRICT JSON ONLY (no markdown, no extra text).

Analyze the following full transcript (may last several hours) and return JSON matching exactly this structure (use empty strings/arrays when info is missing):

{
  "metadata": {
    "subject": "Course name",
    "unit": "Unit/module",
    "sessionNumber": "Session number",
    "thematicAxis": "Thematic axis (e.g., Software Architecture)",
    "keywords": ["keyword1", "keyword2"]
  },
  "learningOutcomes": {
    "competencies": ["Competency 1", "Competency 2"],
    "mainProblem": "Main problem the session addresses"
  },
  "theoreticalCore": {
    "concepts": "Fundamental concepts and technical definitions",
    "modelsStandards": "Models, standards or frameworks cited",
    "referencedAuthors": ["Author A", "Paper B"]
  },
  "comparativeAnalysis": {
    "prosCons": "Advantages and disadvantages",
    "comparisons": "Comparison with alternatives",
    "contextOfUse": "Best-fit contexts"
  },
  "examples": {
    "academicExample": "Academic example",
    "caseStudy": "Real-world case study",
    "antipatterns": "Anti-patterns"
  },
  "technicalComponent": {
    "codeSnippets": "Code or pseudocode snippets",
    "tools": ["tool1", "libX"],
    "diagrams": "Architecture/diagram descriptions"
  },
  "debate": {
    "controversies": "Controversial points discussed",
    "participantContributions": "Key student contributions"
  },
  "interdisciplinary": {
    "relations": "Relations to other subjects",
    "workplaceApplications": "Potential workplace applications"
  },
  "executiveSummary": "Executive summary (2-4 sentences)",
  "keyPoints": ["Key point 1", "Key point 2"],
  "lectureNotes": "Structured lecture notes, include partial summaries by section",
  "keyTakeaways": ["Takeaway 1","Takeaway 2","Takeaway 3"],
  "actionableInsights": ["Insight 1","Insight 2"],
  "references": {
    "readings": ["Reference 1", "Reference 2"],
    "questionsForStudy": ["Question 1", "Question 2"]
  }
}

TRANSCRIPT:
${consolidatedInput}`;
}

function normalizeSummary(input: unknown) {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  // Backwards-compatible fields
  const executiveSummary = toText(data.executiveSummary || data.summary || "");
  const lectureNotes = toText(data.lectureNotes || data.notas || "");
  const keyPoints = toStringList(data.keyPoints || data.puntosClave || []);
  const actionableInsights = toStringList(data.actionableInsights || data.insights || []);

  // High-complexity structured fields
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {
          subject: toText((data as any).subject || ""),
          unit: toText((data as any).unit || ""),
          sessionNumber: toText((data as any).sessionNumber || ""),
          thematicAxis: toText((data as any).thematicAxis || (data as any).ejeTematico || ""),
          keywords: toStringList((data as any).keywords || (data as any).palabrasClave || []),
        };

  const learningOutcomes = {
    competencies: toStringList(
      (data.learningOutcomes && (data.learningOutcomes as any).competencies) ||
        (data as any).competencies ||
        []
    ),
    mainProblem: toText(
      (data.learningOutcomes && (data.learningOutcomes as any).mainProblem) ||
        (data as any).mainProblem ||
        ""
    ),
  };

  const theoreticalCore = {
    concepts: toText(
      (data.theoreticalCore && (data.theoreticalCore as any).concepts) ||
        (data as any).concepts ||
        ""
    ),
    modelsStandards: toText(
      (data.theoreticalCore && (data.theoreticalCore as any).modelsStandards) ||
        (data as any).modelsStandards ||
        ""
    ),
    referencedAuthors: toStringList(
      (data.theoreticalCore && (data.theoreticalCore as any).referencedAuthors) ||
        (data as any).referencedAuthors ||
        []
    ),
  };

  const comparativeAnalysis = {
    prosCons: toText(
      (data.comparativeAnalysis && (data.comparativeAnalysis as any).prosCons) ||
        (data as any).prosCons ||
        ""
    ),
    comparisons: toText(
      (data.comparativeAnalysis && (data.comparativeAnalysis as any).comparisons) ||
        (data as any).comparisons ||
        ""
    ),
    contextOfUse: toText(
      (data.comparativeAnalysis && (data.comparativeAnalysis as any).contextOfUse) ||
        (data as any).contextOfUse ||
        ""
    ),
  };

  const examples = {
    academicExample: toText(
      (data.examples && (data.examples as any).academicExample) ||
        (data as any).academicExample ||
        ""
    ),
    caseStudy: toText(
      (data.examples && (data.examples as any).caseStudy) || (data as any).caseStudy || ""
    ),
    antipatterns: toText(
      (data.examples && (data.examples as any).antipatterns) || (data as any).antipatterns || ""
    ),
  };

  const technicalComponent = {
    codeSnippets: toText(
      (data.technicalComponent && (data.technicalComponent as any).codeSnippets) ||
        (data as any).codeSnippets ||
        ""
    ),
    tools: toStringList(
      (data.technicalComponent && (data.technicalComponent as any).tools) ||
        (data as any).tools ||
        []
    ),
    diagrams: toText(
      (data.technicalComponent && (data.technicalComponent as any).diagrams) ||
        (data as any).diagrams ||
        ""
    ),
  };

  const debate = {
    controversies: toText(
      (data.debate && (data.debate as any).controversies) || (data as any).controversies || ""
    ),
    participantContributions: toText(
      (data.debate && (data.debate as any).participantContributions) ||
        (data as any).participantContributions ||
        ""
    ),
  };

  const interdisciplinary = {
    relations: toText(
      (data.interdisciplinary && (data.interdisciplinary as any).relations) ||
        (data as any).relations ||
        ""
    ),
    workplaceApplications: toText(
      (data.interdisciplinary && (data.interdisciplinary as any).workplaceApplications) ||
        (data as any).workplaceApplications ||
        ""
    ),
  };

  const keyTakeaways = toStringList(data.keyTakeaways || (data as any).keyTakeaways || []);

  const references = {
    readings: toStringList(
      (data.references && (data.references as any).readings) || (data as any).readings || []
    ),
    questionsForStudy: toStringList(
      (data.references && (data.references as any).questionsForStudy) ||
        (data as any).questionsForStudy ||
        []
    ),
  };

  return {
    executiveSummary,
    keyPoints,
    lectureNotes,
    actionableInsights,
    metadata,
    learningOutcomes,
    theoreticalCore,
    comparativeAnalysis,
    examples,
    technicalComponent,
    debate,
    interdisciplinary,
    keyTakeaways,
    references,
  };
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${typeof val === "string" ? val : JSON.stringify(val)}`)
      .join("\n");
  }

  return value == null ? "" : String(value);
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item).trim()).filter(Boolean);
  }

  if (value && typeof value === "object") {
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
      chunks.push(currentChunk.join(" "));
      currentChunk = [word];
      currentSize = word.length;
    } else {
      currentChunk.push(word);
      currentSize += word.length + 1;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks.length === 0 ? [transcript] : chunks;
}
