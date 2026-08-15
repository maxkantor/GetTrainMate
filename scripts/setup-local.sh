#!/bin/bash
set -e

echo "🏗️  GetTrainMate Local Setup"
echo ""

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v dotnet &> /dev/null; then
    echo "❌ .NET SDK is not installed (need .NET 10)"
    exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install
echo ""

# Setup environment
if [ ! -f .env.local ]; then
    echo "📄 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Update .env.local with your AWS credentials and Cognito details"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your configuration"
echo "  2. Run 'npm run web:dev' to start the frontend"
echo "  3. Run 'cd apps/api && dotnet run' to start the backend"
echo "  4. Run 'npm run infra:synth' to preview CDK deployment"
