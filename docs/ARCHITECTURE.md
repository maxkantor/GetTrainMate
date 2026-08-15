# GetTrainMate Architecture

## Overview

GetTrainMate is a training-first partner matching SaaS built with a modern serverless architecture on AWS.

## Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** Material UI (MUI)
- **Styling:** CSS Modules + MUI theming
- **Routing:** React Router v6
- **i18n:** Custom i18n system with 5 locales (en, es, ru, hi, zh)
- **State Management:** React Context (can extend to Redux if needed)

### Backend
- **Runtime:** AWS Lambda (.NET 10)
- **API Gateway:** HTTP API with OpenAPI integration
- **Database:** DynamoDB (NoSQL)
- **Authentication:** AWS Cognito User Pools
- **Object Storage:** Amazon S3
- **Email:** Amazon SES
- **Secrets:** AWS Secrets Manager

### Infrastructure
- **IaC:** AWS CDK (TypeScript)
- **CI/CD:** GitHub Actions
- **Monitoring:** CloudWatch Logs (extensible to X-Ray)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                                                                   │
│  React App (Vite)   ─────────> Language Selector (5 locales)    │
│  - Landing                      - LocalStorage persistence       │
│  - Auth                          - RTL/LTR support               │
│  - App (Matches, Chat, Events)                                   │
│  - Admin CMS                                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CloudFront (CDN)                             │
│  - Caches static assets                                          │
│  - Handles SSL/TLS termination                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌────────────────────────┐  ┌──────────────────────────┐
│   API Gateway HTTP     │  │   S3 Static Hosting      │
│   (REST + WebSocket)   │  │   (Web app distribution) │
└────────┬───────────────┘  └──────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                  AWS Lambda (.NET 10)                            │
│                                                                  │
│  /api/health              /api/matches              /admin/*    │
│  /api/me                  /api/swipe                (auth)      │
│  /api/profile             /api/events                           │
│  /api/chat                /api/stripe                           │
│                           /api/email                            │
└────────┬──────────────────────────────────────────────────────┘
         │
    ┌────┼────┬────────┬──────────┬────────────┐
    ▼    ▼    ▼        ▼          ▼            ▼
 ┌──┐ ┌──┐ ┌──────┐ ┌─────┐  ┌──────┐   ┌──────────┐
 │DB│ │DB│ │Cognito       │  │SES   │   │Secrets   │
 │  │ │  │ │(Auth)        │  │(Email)   │Manager   │
 └──┘ └──┘ └──────┘ └─────┘  └──────┘   └──────────┘
 Dyn  Dyn  User         S3
 oMD  oMD  Pools      (Media)
 B    B    &
 (10  (9   Groups
  T)  T)
```

## Database Schema (DynamoDB)

### Tables

1. **users**
   - PK: `userId` (string)
   - Fields: email, status, createdAt, lastLogin

2. **profiles**
   - PK: `userId` (string)
   - Fields: name, avatarUrl, city, sportTags[], level, goals, scheduleSlots[], mode, bio

3. **matches**
   - PK: `matchId` (string)
   - GSI: userId1, userId2
   - Fields: userId1, userId2, compatibility (0-100), status (pending/mutual/expired), createdAt

4. **messages**
   - PK: `threadId` (string)
   - SK: `createdAt` (timestamp)
   - Fields: senderId, content, isRead, attachments[]

5. **events**
   - PK: `eventId` (string)
   - Fields: title, description, startDate, location, sport, partnersNeeded[], status

6. **content**
   - PK: `contentId` (string)
   - Fields: type (hero, feature, faq, etc.), locale, data (JSON)

7. **translations**
   - PK: `key` (string)
   - GSI: locale
   - Fields: locale, value, lastUpdated, updatedBy

8. **entitlements**
   - PK: `userId` (string)
   - Fields: plan (free, premium), status, expiresAt, stripeCustomerId

9. **leads**
   - PK: `leadId` (string)
   - Fields: email, name, message, status (new, contacted, converted), createdAt

10. **audit_log**
    - PK: `logId` (string)
    - Fields: userId, action, resource, timestamp, changes

### Event Hub tables (reusable across World Cup, Olympics, etc.)

11. **event-configs** — event settings + homepage/CRM toggles (PK: `eventId`)
12. **event-groups** — PK: `eventId`, SK: `groupId`
13. **event-teams** — PK: `eventId`, SK: `teamId` (standings fields)
14. **event-matches** — PK: `eventId`, SK: `matchId` (status, scores)
15. **event-predictions** — PK: `eventId`, SK: `predictionKey` (`matchId#userId`)
16. **event-comments** — PK: `eventId`, SK: `commentKey`
17. **event-bans** — PK: `eventId`, SK: `userId`

Public routes: `/api/events/{eventId}/hub`, `/groups`, `/teams`, `/matches`, `/predictions`, `/comments`, `/leaderboard`. Admin: `/api/admin/sports-events/{eventId}/*`.

## API Routes

### Public
- `GET /api/health` - Health check

### Authenticated (JWT from Cognito)
- `GET /api/me` - Current user profile
- `PUT /api/me` - Update profile
- `GET /api/matches` - Paginated match feed
- `POST /api/swipe` - Like/Pass on match
- `GET /api/compatibility/{userId}` - Compatibility details
- `GET /api/events` - List events (paginated)
- `POST /api/events/{eventId}/join` - Join event
- `POST /api/events/{eventId}/need-partner` - Toggle need partner
- `GET /api/chat/threads` - Chat threads
- `GET /api/chat/{threadId}/messages` - Messages
- `POST /api/chat/{threadId}/messages` - Send message

### Admin (Cognito group: Admin + JWT)
- `GET /api/admin/content` - Get CMS content
- `PUT /api/admin/content/{contentId}` - Update content
- `GET /api/admin/translations` - All translations
- `PUT /api/admin/translations/{key}` - Update translation key
- `POST /api/admin/media/upload-url` - Get S3 pre-signed URL
- `GET /api/admin/leads` - Get contact form leads
- `PUT /api/admin/leads/{leadId}` - Update lead status
- `GET /api/admin/audit-log` - Audit log (paginated)

### Stripe (Webhook signature verified)
- `POST /api/stripe/create-checkout-session` - Create checkout
- `POST /api/stripe/webhook` - Handle Stripe events

## Security

- **Authentication:** AWS Cognito User Pools with JWT tokens
- **Authorization:** Group-based (Admin group) + JWT claims
- **Secrets:** AWS Secrets Manager (API keys, webhook secrets)
- **S3 Buckets:** Private with pre-signed URLs for temporary access
- **API Gateway:** CORS configured, input validation, rate limiting (future)
- **DynamoDB:** Encryption at rest, point-in-time recovery

## Deployment

### Environments
- **dev:** Development environment
- **staging:** Pre-production
- **prod:** Production

### CDK Deployment
```bash
npm run infra:deploy
```

### CI/CD Pipeline
- PR: Web lint/test, API build, CDK synth validation
- Main merge: Auto-deploy to staging (after approval)
- Production: Manual deployment trigger

## Monitoring & Logging

- **Application Logs:** CloudWatch Logs via Serilog (.NET)
- **Request Tracing:** Correlation IDs on all Lambda invocations
- **Metrics:** CloudWatch metrics (extensible to custom dashboards)
- **Alerts:** SNS notifications for errors (future)

## Cost Optimization

- **DynamoDB:** On-demand billing
- **Lambda:** No minimum cost, pay per invocation
- **S3:** Lifecycle policies to delete old versions
- **CloudFront:** CDN for static assets
- **Data Transfer:** Minimize cross-region traffic

## Future Enhancements

- Real-time chat with WebSockets
- Notifications service (SNS + SQS)
- Video integration (Amazon Chime / Kinesis)
- ML-based matching (SageMaker)
- Advanced analytics (Athena + QuickSight)
- Multi-region deployment
- Caching layer (ElastiCache)
