# GetTrainMate API Documentation

## Base URL

- **Development:** `http://localhost:3001/api`
- **Staging:** `https://api-staging.gettrainmate.com/api`
- **Production:** `https://api.gettrainmate.com/api`

## Authentication

All endpoints except `/health` and `/stripe/webhook` require:

```
Authorization: Bearer <JWT_TOKEN>
```

JWT token obtained from AWS Cognito after login.

## Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "timestamp": "2026-01-22T10:30:00Z",
  "requestId": "req-12345"
}
```

## Error Codes

- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (missing/invalid JWT)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `500`: Internal server error

## Endpoints

### Health

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T10:30:00Z"
}
```

---

### User Profile

#### GET /me

Get current user profile.

**Headers:**
```
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "userId": "user-123",
  "email": "john@example.com",
  "profile": {
    "name": "John Doe",
    "avatarUrl": "https://s3.../avatar.jpg",
    "city": "New York",
    "sportTags": ["gym", "crossfit"],
    "level": "pro",
    "goals": ["gain muscle", "build endurance"],
    "scheduleSlots": [
      {
        "day": "monday",
        "startTime": "06:00",
        "endTime": "07:00"
      }
    ],
    "mode": "TRAIN"
  },
  "entitlement": {
    "plan": "premium",
    "status": "active",
    "expiresAt": "2026-02-22T00:00:00Z"
  }
}
```

#### PUT /me

Update user profile.

**Headers:**
```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Request:**
```json
{
  "profile": {
    "name": "John Doe",
    "city": "New York",
    "sportTags": ["gym", "crossfit"],
    "level": "pro",
    "goals": ["gain muscle"],
    "scheduleSlots": [
      {
        "day": "monday",
        "startTime": "06:00",
        "endTime": "07:00"
      }
    ],
    "mode": "TRAIN"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": { "updatedAt": "2026-01-22T10:30:00Z" }
}
```

---

### Matching

#### GET /matches

Get paginated match feed.

**Query Parameters:**
- `page`: number (default: 0)
- `limit`: number (default: 10)
- `sport`: string (optional, filter by sport tag)

**Response:**
```json
{
  "matches": [
    {
      "userId": "user-456",
      "name": "Jane Smith",
      "avatarUrl": "...",
      "city": "New York",
      "sportTags": ["gym", "running"],
      "level": "open",
      "compatibility": 85,
      "compatibilityDetails": {
        "scheduleMatch": 90,
        "distanceMatch": 95,
        "sportMatch": 85,
        "levelMatch": 75,
        "goalsMatch": 80,
        "explanation": "Great schedule overlap and same interests"
      }
    }
  ],
  "totalCount": 42,
  "pageCount": 5
}
```

#### POST /swipe

Like or pass on a match.

**Request:**
```json
{
  "targetUserId": "user-456",
  "action": "like"  // or "pass"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isMutualMatch": false,
    "message": "You liked Jane Smith"
  }
}
```

#### GET /compatibility/{userId}

Get detailed compatibility with specific user.

**Response:**
```json
{
  "userId": "user-456",
  "compatibilityScore": 85,
  "breakdown": {
    "schedule": { "score": 90, "details": "3 overlapping time slots" },
    "distance": { "score": 95, "details": "Same city" },
    "sports": { "score": 85, "details": "2 matching sports" },
    "level": { "score": 75, "details": "Both intermediate" },
    "goals": { "score": 80, "details": "Similar fitness goals" }
  },
  "whyWeMatch": "Great schedule overlap, same city, and shared fitness interests"
}
```

---

### Events

#### GET /events

Get paginated events list.

**Query Parameters:**
- `page`: number (default: 0)
- `limit`: number (default: 20)
- `sport`: string (optional)
- `city`: string (optional)

**Response:**
```json
{
  "events": [
    {
      "eventId": "evt-123",
      "title": "CrossFit Competition",
      "description": "Regional CrossFit competition",
      "startDate": "2026-02-15T09:00:00Z",
      "endDate": "2026-02-15T17:00:00Z",
      "location": "New York, NY",
      "sport": "crossfit",
      "partnersNeeded": 2,
      "participantsCount": 25,
      "joinedByMe": false,
      "needPartnerMe": false
    }
  ],
  "totalCount": 150,
  "pageCount": 8
}
```

#### POST /events/{eventId}/join

Join an event.

**Request:**
```json
{
  "needPartner": false
}
```

**Response:**
```json
{
  "success": true,
  "data": { "joinedAt": "2026-01-22T10:30:00Z" }
}
```

#### POST /events/{eventId}/need-partner

Toggle "looking for partner" flag on event.

**Request:**
```json
{
  "needPartner": true
}
```

**Response:**
```json
{
  "success": true,
  "data": { "updatedAt": "2026-01-22T10:30:00Z" }
}
```

---

### Chat

#### GET /chat/threads

Get user's chat threads.

**Query Parameters:**
- `page`: number (default: 0)
- `limit`: number (default: 20)

**Response:**
```json
{
  "threads": [
    {
      "threadId": "thread-123",
      "otherUserId": "user-456",
      "otherUserName": "Jane Smith",
      "lastMessage": "See you tomorrow!",
      "lastMessageTime": "2026-01-22T09:15:00Z",
      "unreadCount": 2
    }
  ],
  "totalCount": 5
}
```

#### GET /chat/{threadId}/messages

Get messages in thread.

**Query Parameters:**
- `page`: number (default: 0)
- `limit`: number (default: 50)

**Response:**
```json
{
  "threadId": "thread-123",
  "otherUserId": "user-456",
  "messages": [
    {
      "messageId": "msg-123",
      "senderId": "user-456",
      "content": "Hey, how are you?",
      "createdAt": "2026-01-22T08:00:00Z",
      "isRead": true
    }
  ],
  "totalCount": 25
}
```

#### POST /chat/{threadId}/messages

Send message in thread.

**Request:**
```json
{
  "content": "Let's train tomorrow!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-456",
    "createdAt": "2026-01-22T10:30:00Z"
  }
}
```

---

### Admin Endpoints

All admin endpoints require:
- JWT token with `cognito:groups` claim containing `Admin`

#### GET /admin/content

Get all CMS content.

**Response:**
```json
{
  "content": [
    {
      "contentId": "hero-home",
      "type": "hero",
      "locale": "en",
      "data": {
        "title": "Find Your Training Partner",
        "subtitle": "Match with partners based on goals",
        "cta": "Get Started"
      },
      "updatedAt": "2026-01-22T10:30:00Z",
      "updatedBy": "admin-123"
    }
  ]
}
```

#### PUT /admin/content/{contentId}

Update CMS content.

**Request:**
```json
{
  "data": {
    "title": "Updated Title",
    "subtitle": "Updated Subtitle"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": { "updatedAt": "2026-01-22T10:30:00Z" }
}
```

#### GET /admin/translations

Get all translation keys across all locales.

**Query Parameters:**
- `locale`: string (optional, filter by specific locale)

**Response:**
```json
{
  "translations": [
    {
      "key": "common.appName",
      "locale": "en",
      "value": "GetTrainMate",
      "updatedAt": "2026-01-22T10:30:00Z"
    }
  ]
}
```

#### PUT /admin/translations/{key}

Update translation value for all or specific locale.

**Request:**
```json
{
  "locale": "es",
  "value": "Empareja con Compañeros"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "updatedAt": "2026-01-22T10:30:00Z" }
}
```

#### POST /admin/media/upload-url

Get S3 pre-signed URL for file upload.

**Request:**
```json
{
  "filename": "profile-pic.jpg",
  "contentType": "image/jpeg",
  "altText": "User profile picture"
}
```

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/gettrainmate-media/.../...",
  "fileUrl": "https://s3.amazonaws.com/gettrainmate-media/...",
  "expiresIn": 900
}
```

#### GET /admin/leads

Get contact form leads.

**Query Parameters:**
- `status`: string (new, contacted, converted)
- `page`: number
- `limit`: number

**Response:**
```json
{
  "leads": [
    {
      "leadId": "lead-123",
      "email": "prospect@example.com",
      "name": "John Prospect",
      "message": "Interested in GetTrainMate",
      "status": "new",
      "createdAt": "2026-01-22T10:30:00Z"
    }
  ],
  "totalCount": 42
}
```

#### GET /admin/audit-log

Get audit log of admin changes.

**Query Parameters:**
- `page`: number
- `limit`: number
- `userId`: string (optional)

**Response:**
```json
{
  "logs": [
    {
      "logId": "log-123",
      "userId": "admin-123",
      "action": "UPDATE_CONTENT",
      "resource": "hero-home",
      "timestamp": "2026-01-22T10:30:00Z",
      "changes": {
        "title": { "before": "Old", "after": "New" }
      }
    }
  ],
  "totalCount": 256
}
```

---

### Stripe

#### POST /stripe/create-checkout-session

Create Stripe checkout session for subscription.

**Request:**
```json
{
  "plan": "premium",  // or "free"
  "returnUrl": "https://gettrainmate.com/app/settings"
}
```

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_...",
  "sessionId": "cs_..."
}
```

#### POST /stripe/webhook

Handle Stripe webhook events.

**Headers:**
```
Stripe-Signature: t=...,v1=...
```

**Events Handled:**
- `checkout.session.completed` - Create entitlement
- `customer.subscription.updated` - Update entitlement
- `customer.subscription.deleted` - Cancel entitlement

---

## Rate Limiting

(Future enhancement)

- 100 requests per minute per user
- 1000 requests per minute per IP

## Pagination

All list endpoints support:
- `page`: 0-indexed page number
- `limit`: items per page (max 100)

Response includes:
- `totalCount`: Total items available
- `pageCount`: Total pages

## Localization

All admin content respects the `Accept-Language` header.

---

For setup instructions, see [SETUP.md](SETUP.md)
For architecture, see [ARCHITECTURE.md](ARCHITECTURE.md)
