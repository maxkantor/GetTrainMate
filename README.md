# GetTrainMate

Training-first partner matching for gym, CrossFit, HYROX, running, and more.

**3 Modes:** TRAIN / VIBE / DATE (dating optional)

## Stack

- **Frontend:** React + TypeScript + Vite + MUI
- **Backend:** AWS Lambda (.NET 10) + DynamoDB + API Gateway
- **Auth:** AWS Cognito User Pools
- **Payments:** Stripe
- **Infrastructure:** AWS CDK (TypeScript)
- **CI/CD:** GitHub Actions

**Production domain:** `https://gettrainmate.com` — see [docs/PRODUCTION_DOMAIN.md](docs/PRODUCTION_DOMAIN.md) for Amplify env vars, Cognito/Stripe callbacks, DNS, and a deploy verification checklist.

## Project Structure

```
/
├── apps/
│   ├── web/              # React + TypeScript + Vite frontend
│   └── api/              # .NET 10 Lambda functions
├── infra/                # AWS CDK infrastructure code
├── docs/                 # Architecture & setup documentation
├── scripts/              # Database seeding & utilities
└── .github/workflows/    # GitHub Actions CI/CD
```

## Local Setup

### Prerequisites

- Node.js 18+ and npm
- .NET 10 SDK
- AWS CLI v2 configured
- Git

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/maxkantor/GetTrainMate.git
   cd GetTrainMate
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

3. **Set up AWS credentials:**
   ```bash
   aws configure
   ```

### Running Locally

#### Web App

```bash
npm run web:dev
```

Opens at http://localhost:5173

#### API (Local .NET)

```bash
cd apps/api
dotnet run
```

Runs on http://localhost:3001

#### Infrastructure (CDK)

```bash
npm run infra:synth
```

Outputs CloudFormation template to `cdk.out/`.

### Building

```bash
# Build web app
npm run web:build

# Build .NET API
cd apps/api && dotnet build

# Synth CDK
npm run infra:synth
```

### SEO and analytics (production)

Canonical URL, Google Analytics 4, Search Console HTML verification, `robots.txt`, and `sitemap.xml` are covered in [docs/SEO-Analytics.md](docs/SEO-Analytics.md). For production builds, set `VITE_PUBLIC_SITE_URL` and `VITE_GA_MEASUREMENT_ID` in Amplify (or `apps/web/.env`).

### Testing

```bash
npm run web:lint
cd apps/api && dotnet test
```

## Supported Locales

- 🇬🇧 English (en)
- 🇪🇸 Spanish (es)
- 🇷🇺 Russian (ru)
- 🇮🇳 Hindi (hi)
- 🇨🇳 Chinese (zh)

Language selector available in header and mobile menu. Persisted to localStorage.

## Multi-Language

All UI strings are translation keys. Admin can edit translations at `/admin/translations`.

## Authentication

- **Public routes:** `/`, `/pricing`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`
- **Auth routes:** `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/verify`
- **App routes:** `/app/**` (requires login)
- **Admin routes:** `/admin/**` (requires Admin Cognito group membership)

## Admin CMS

Access at `/admin` with Admin group membership.

Features:
- Content editor (hero, features, FAQs, testimonials, pricing, footer)
- Translation editor (all locales)
- Media library upload to S3
- Leads inbox from contact form
- Audit log of all admin changes

## API Endpoints

### Public
- `GET /api/health` - Health check

### Authenticated
- `GET /api/me` - Current user profile
- `PUT /api/me` - Update profile
- `GET /api/matches` - Get match feed
- `POST /api/swipe` - Like or pass on match
- `GET /api/compatibility/{userId}` - Compatibility details
- `GET /api/events` - List events
- `POST /api/events/join` - Join event
- `POST /api/events/need-partner` - Toggle need partner
- `GET /api/chat/threads` - Chat thread list
- `GET /api/chat/{threadId}/messages` - Get messages
- `POST /api/chat/{threadId}/messages` - Send message

### Admin (Cognito group: Admin)
- `GET/PUT /api/admin/content` - Manage CMS content
- `GET/PUT /api/admin/translations` - Manage translations
- `POST /api/admin/media/upload-url` - Get S3 pre-signed URL
- `GET /api/admin/leads` - Get contact form leads
- `GET /api/admin/audit-log` - Get audit log

### Stripe
- `POST /api/stripe/create-checkout-session` - Create checkout
- `POST /api/stripe/webhook` - Webhook (signature verified)

## Entitlements

- **Free:** Limited likes/day, limited event partner finder
- **Premium:** Unlimited likes, full events, boosts

Store in DynamoDB with `plan`, `status`, `expiresAt`.

## Deployment

### CDK Deployment

```bash
npm run infra:deploy
```

Will prompt for approval before deploying (not automatic in CI/CD yet).

### GitHub Actions

Workflows:
- **PR Build:** Runs on pull requests for web and API
- **CDK Synth:** Validates CDK can synthesize
- **Deploy:** Manual trigger to production (after approval)

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests and lint
4. Push and create PR
5. Merge after review and CI passes

## Security

- Never commit `.env` or secrets
- Use AWS Secrets Manager for production secrets
- JWT validated from Cognito
- Admin endpoints require Admin group membership
- Input validation on all API endpoints
- CORS properly configured

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Setup Guide](docs/SETUP.md)
- [API Docs](docs/API.md)
- [Admin portal](docs/ADMIN_PORTAL_IMPLEMENTATION.md)
- [Quick start](QUICK_START.md) · [User guide](USER_GUIDE.md)

## License

MIT
