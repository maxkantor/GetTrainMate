# GetTrainMate Setup Guide

## Local Development Setup

### Prerequisites

- **Node.js:** 18.x or 20.x
- **.NET 8 SDK:** https://dotnet.microsoft.com/download
- **AWS CLI v2:** https://aws.amazon.com/cli/
- **AWS Account:** With IAM credentials configured
- **Git:** For version control

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/maxkantor/GetTrainMate.git
cd GetTrainMate
```

#### 2. Run Setup Script

**macOS / Linux:**
```bash
bash scripts/setup-local.sh
```

**Windows:**
```bash
scripts\setup-local.bat
```

Or manually:
```bash
# Install root and web dependencies
npm install
cd apps/web && npm install
```

#### 3. Configure Environment Variables

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
# - AWS Account ID, Region
# - Cognito User Pool ID / Client ID
# - Stripe API keys
# - API URL (local dev: http://localhost:3001)
```

#### 4. Configure AWS Credentials

```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Default Region (us-east-1)
```

Verify:
```bash
aws sts get-caller-identity
```

### Running Locally

#### Frontend (Vite Dev Server)

```bash
npm run web:dev
```

- Opens: http://localhost:5173
- Auto-reload on file changes
- API proxy to http://localhost:3001/api

#### Backend (.NET Lambda Local)

```bash
cd apps/api
dotnet run
```

- Runs on: http://localhost:3001
- Endpoints: http://localhost:3001/api/health (health check)

#### Infrastructure (CDK)

```bash
npm run infra:synth
```

- Generates CloudFormation template: `cdk.out/`
- No deployment, just validation

### Building

#### Web App

```bash
npm run web:build
```

- Output: `apps/web/dist/`
- Production bundle, minified & optimized

#### .NET API

```bash
cd apps/api
dotnet build
```

- Output: `apps/api/bin/Release/net8.0/`

#### CDK Deployment Ready (Manual Approval)

```bash
npm run infra:synth  # Validate
npm run infra:deploy # Deploy with approval prompt
```

### Testing & Validation

```bash
# Lint web code
npm run web:lint

# TypeScript type check
cd apps/web && npm run type-check

# Build all (CI validation)
npm run web:build
cd ../api && dotnet build
cd ../../ && npm run infra:synth
```

### File Structure

```
GetTrainMate/
├── apps/
│   ├── web/              # React + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── components/  # Reusable React components
│   │   │   ├── pages/       # Page components
│   │   │   ├── hooks/       # Custom hooks (useI18n)
│   │   │   ├── i18n/        # Translation system
│   │   │   ├── contexts/    # React Context (I18nContext)
│   │   │   ├── styles/      # CSS Modules
│   │   │   ├── types/       # TypeScript interfaces
│   │   │   ├── App.tsx      # Root component
│   │   │   ├── Router.tsx   # Route definitions
│   │   │   └── main.tsx     # Entry point
│   │   ├── index.html       # HTML template
│   │   ├── vite.config.ts   # Vite configuration
│   │   └── package.json
│   │
│   └── api/              # .NET 8 Lambda
│       ├── Controllers/     # API endpoints
│       ├── Program.cs       # Lambda host setup
│       ├── appsettings.json # Configuration
│       └── GetTrainMate.Api.csproj
│
├── infra/               # AWS CDK (TypeScript)
│   ├── bin/
│   │   └── index.ts     # CDK App entry point
│   ├── lib/
│   │   └── stacks/
│   │       └── main-stack.ts # Infrastructure definitions
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md   # System design
│   ├── SETUP.md          # This file
│   └── API.md            # API documentation
│
├── scripts/
│   ├── setup-local.sh    # Linux/macOS setup
│   ├── setup-local.bat   # Windows setup
│   └── seed.js           # Database seeding (Batch 2)
│
├── .github/
│   └── workflows/
│       ├── web.yml       # Frontend CI/CD
│       ├── api.yml       # Backend CI/CD
│       └── cdk.yml       # Infrastructure CI/CD
│
├── README.md             # Project overview
├── package.json          # Root package.json (workspaces)
├── .env.example          # Environment template
└── .gitignore            # Git ignore rules
```

### Troubleshooting

#### Port Already in Use

```bash
# Find process on port
lsof -i :5173  # Frontend
lsof -i :3001  # Backend

# Kill process
kill -9 <PID>
```

#### DynamoDB Tables Not Found

- Make sure you've run `npm run infra:synth` to validate CDK
- Actual DynamoDB tables created on AWS deployment only
- Local dev uses mock tables from Lambda environment variables

#### Cognito Not Configured

```bash
# Get your Cognito details
aws cognito-idp list-user-pools --max-results 10

# Update .env.local with real values
```

#### .NET Build Errors

```bash
# Clean build
cd apps/api
dotnet clean
dotnet restore
dotnet build
```

#### Node Modules Issues

```bash
# Clear npm cache and reinstall
npm cache clean --force
npm install
```

### Performance Tips

- Use `npm run web:dev` for hot-reload during development
- Use VS Code Extensions: Pylance (Python), C# extensions for .NET
- Browser DevTools for React debugging (React DevTools extension)
- Use `.env.local` to override production settings

### Next Steps

1. Implement auth flows (Batch 2)
2. Implement match logic (Batch 2)
3. Set up Stripe integration (Batch 2)
4. Add real-time features (Batch 3)
5. Deploy to AWS (Batch 3)

---

For API documentation, see [API.md](API.md)
For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md)
