#!/bin/bash
set -e

echo "🚀 Lecture Transcriber - Vercel Deployment Setup"
echo "================================================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📋 Prerequisites Check:"
echo "✓ Node.js version:"
node --version

echo ""
echo "🔑 Setting up environment variables..."
echo ""
echo "You'll need a Groq API key. Get one here:"
echo "  👉 https://console.groq.com/keys"
echo ""

# Read environment variables
read -p "Enter your GROQ_API_KEY: " GROQ_API_KEY
read -p "Enter your GROQ_LLM_API_KEY (or press Enter to use same as above): " GROQ_LLM_API_KEY

if [ -z "$GROQ_LLM_API_KEY" ]; then
    GROQ_LLM_API_KEY=$GROQ_API_KEY
fi

# Create .env.local
cat > .env.local << EOF
GROQ_API_KEY=$GROQ_API_KEY
GROQ_LLM_API_KEY=$GROQ_LLM_API_KEY
USE_KV_DATABASE=false
EOF

echo "✅ Created .env.local"

echo ""
echo "🧪 Testing local build..."
npm run build

echo ""
echo "✅ Build successful!"
echo ""
echo "🚀 Ready to deploy to Vercel!"
echo ""
echo "Next steps:"
echo "  1. Make sure all changes are committed to Git"
echo "  2. Run: vercel deploy --prod"
echo "  3. Add environment variables in Vercel dashboard:"
echo "     - GROQ_API_KEY=$GROQ_API_KEY"
echo "     - GROQ_LLM_API_KEY=$GROQ_LLM_API_KEY"
echo ""
echo "For persistent storage, set up Vercel KV:"
echo "  1. Visit: https://vercel.com/dashboard"
echo "  2. Go to your project's Storage tab"
echo "  3. Create a new KV database"
echo "  4. Add the KV environment variables to your project"
