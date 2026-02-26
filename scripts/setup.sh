#!/bin/bash

echo "🚀 NexusAgent Wallet Setup"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. You have $(node -v)"
    exit 1
fi

echo "✅ Node.js version OK: $(node -v)"

# Create directories
mkdir -p data logs
echo "✅ Created data and logs directories"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Turnkey credentials"
echo "2. Run: npm run dev"