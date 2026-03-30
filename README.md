# Audio Transcript — Lecture Transcriber (Portfolio)

Proyecto de portafolio: transcripción de audio y generación de resúmenes
con una UI reactiva. Construido con Next.js (App Router), TypeScript y
TailwindCSS. Ideal para demostraciones de ingeniería full‑stack.

---

## 🚀 Resumen (es / en)

- Español: transcribe grabaciones de clase y genera resúmenes
  ejecutivos y notas estructuradas usando APIs Whisper/LLM.
- English: records audio, transcribes with Whisper-compatible APIs
  and produces AI summaries for quick reading.

---

## 🧩 Características principales

- Grabación en el navegador (micrófono / pestaña / sistema)
- Transcripción (Groq Whisper compatible)
- Resúmenes automáticos (Groq LLM / otros proveedores configurables)
- Historial de sesiones y exportación (TXT / MD / JSON)
- Preparado para despliegue en Vercel (serverless)

---

## 🛠️ Tech Stack

- Frontend: Next.js 14 (App Router), React 18, TypeScript
- Estilos: TailwindCSS
- Estado: Zustand
- Almacenamiento: Vercel KV (opcional) o en memoria para desarrollo

---

## 🧰 Quick Start

1. Clona el repositorio:

```bash
git clone https://github.com/metatech-programmer/audio-transcript.git
cd record-audio
```

2. Instala dependencias:

```bash
npm install
```

3. Copia las variables de entorno de ejemplo y rellena tus claves:

```bash
# macOS / Linux
cp .env.example .env.local

# Windows (PowerShell)
Copy-Item .env.example .env.local
```

4. Ejecuta en modo desarrollo:

```bash
npm run dev
```

Abre http://localhost:3000

---

## ✅ Preparado para portafolio

Este repositorio está preparado para su presentación en un portafolio público. El código y las configuraciones necesarias para el despliegue y desarrollo están incluidas; consulta la carpeta `docs/` para instrucciones detalladas de despliegue, pruebas y uso.

---

## 📝 Deployment

Recomendado: desplegar en Vercel e inyectar variables de entorno
en el panel de proyecto. Añade `GROQ_API_KEY` y `GROQ_LLM_API_KEY`.

---

## 📚 Más recursos

- Docs Next.js: https://nextjs.org/docs
- Groq API: https://console.groq.com/docs
- Vercel KV: https://vercel.com/docs/storage/vercel-kv

---

## Licencia

MIT — ver `LICENSE`.
