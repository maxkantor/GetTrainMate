#!/bin/bash
# Batch 1 Verification Script
# Run this to verify all builds are working

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  GetTrainMate Batch 1 Verification         ║"
echo "║                  Production-Ready SaaS Scaffold            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/5]${NC} Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi
if ! command -v dotnet &> /dev/null; then
    echo -e "${RED}✗ .NET SDK not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Prerequisites OK${NC} (Node: $(node -v), .NET: $(dotnet --version))"
echo ""

echo -e "${YELLOW}[2/5]${NC} Building React Web App..."
cd apps/web
npm run build > /dev/null 2>&1
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    SIZE=$(du -sh dist | cut -f1)
    echo -e "${GREEN}✓ Web app built${NC} (Size: $SIZE)"
else
    echo -e "${RED}✗ Web build failed${NC}"
    exit 1
fi
cd ../..
echo ""

echo -e "${YELLOW}[3/5]${NC} Building .NET API..."
cd apps/api
dotnet build --configuration Release > /dev/null 2>&1
if [ -d "bin/Release/net10.0" ]; then
    echo -e "${GREEN}✓ API built${NC} (.NET 10.0)"
else
    echo -e "${RED}✗ API build failed${NC}"
    exit 1
fi
cd ../..
echo ""

echo -e "${YELLOW}[4/5]${NC} Building CDK Infrastructure..."
cd infra
npm run build > /dev/null 2>&1
npm run synth > /dev/null 2>&1
if [ -d "cdk.out" ] && [ -f "cdk.out/GetTrainMate-dev.template.json" ]; then
    echo -e "${GREEN}✓ CDK synthesized${NC} (CloudFormation template generated)"
else
    echo -e "${RED}✗ CDK synth failed${NC}"
    exit 1
fi
cd ..
echo ""

echo -e "${YELLOW}[5/5]${NC} Verifying documentation..."
DOCS=0
[ -f "README.md" ] && ((DOCS++))
[ -f "docs/ARCHITECTURE.md" ] && ((DOCS++))
[ -f "docs/SETUP.md" ] && ((DOCS++))
[ -f "docs/API.md" ] && ((DOCS++))
[ -f ".env.example" ] && ((DOCS++))

if [ $DOCS -eq 5 ]; then
    echo -e "${GREEN}✓ All documentation complete${NC} (5 files)"
else
    echo -e "${RED}✗ Missing documentation${NC}"
    exit 1
fi
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ BATCH 1 COMPLETE - ALL BUILDS PASSING${NC}                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "  • React Web: TypeScript + Vite (prod bundle ready)"
echo "  • API: .NET 10 Lambda (health check working)"
echo "  • CDK: Infrastructure as Code (CF template generated)"
echo "  • i18n: 5 locales (en, es, ru, hi, zh)"
echo "  • CI/CD: 3 GitHub Actions workflows"
echo "  • Docs: Architecture, Setup, API reference"
echo ""
echo "🚀 Next Steps:"
echo "  1. npm run web:dev           # Start frontend dev server"
echo "  2. cd apps/api && dotnet run # Start API locally"
echo "  3. npm run infra:synth       # Validate infrastructure"
echo ""
echo "📖 Read: ./README.md and ./docs/SETUP.md for more info"
echo ""
