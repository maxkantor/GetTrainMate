# What AI-Powered Matching Does & How Bedrock Chat Is Implemented

## What AI-powered matching does

GetTrainMate uses AI in four main ways:

1. **AI match insight** (2 credits)  
   For each suggested partner, you can unlock a short, AI-generated explanation of why you’re a good fit: shared sports, similar level, overlapping schedule, goals, and training style. It’s grounded on your and their profile data only.

2. **AI icebreakers** (1 credit)  
   In chat, “AI Icebreaker” suggests 3–5 short, sport-focused first messages based on both profiles (shared sports, level, goals). You pick one to send.

3. **AI workout plan** (3 credits)  
   You can generate a simple training plan (sport, level, days, duration). Output is generic guidance only, not medical advice.

4. **AI Coach chat** (no extra credit)  
   A streaming chat assistant helps with: improving your profile, understanding match quality, first-message ideas, simple workout/meetup ideas, and product/credits questions. It uses the same Bedrock chat stack as above.

The **Discover** feed itself is not “AI-sorted” by default; compatibility score is computed from profile overlap (sports, schedule, level, etc.). The **AI match insight** is the optional, paid explanation of that fit.

---

## How Bedrock chatting is implemented

- **Backend (`.NET`)**  
  - **`BedrockClientWrapper`**  
    Single wrapper around the AWS Bedrock Runtime client.  
    - Reads config from `Bedrock:ModelId`, `Bedrock:Region`, etc.  
    - If `ModelId` is not set, no AWS calls are made (stub mode).  
  - **`BedrockChatService`**  
    Implements `IBedrockChatService`:  
    - **Non-streaming:** builds a Converse request (system prompt + history + user message), calls `ConverseAsync`, returns the assistant text.  
    - **Streaming:** same but uses `ConverseStreamAsync` and yields token deltas from `ContentBlockDeltaEvent`.  
    - Optional **guardrails**: input/output can be passed through `IBedrockGuardrails` (stub by default).  
  - **AI feature services**  
    - **Match insight / icebreakers / profile optimizer / workout plan / help**  
      Each builds a dedicated system prompt and user payload, calls `BedrockChatService.SendAsync`, then parses the model response (e.g. JSON) into DTOs.  
  - **API**  
    - `POST /api/ai/chat` – single-turn coach.  
    - `POST /api/ai/chat/stream` – SSE streaming coach (same Bedrock ConverseStream path).  
    - Other AI endpoints (match-insight, icebreakers, profile-optimize, workout-plan, help) use the same Bedrock layer under the hood.

- **Frontend**  
  - **AI Coach**  
    `AICoachPage` sends the user message to `POST /api/ai/chat/stream`, reads SSE `data: {"text":"..."}` (and optional `{"error":"..."}`), and appends tokens to the UI for a live streaming effect.  
  - **Match insight / icebreakers / etc.**  
    Buttons and flows call the corresponding REST endpoints; responses are shown in the existing UI (e.g. insight in the match panel, icebreakers as chips in chat).

- **Config**  
  - Set `Bedrock:ModelId` (e.g. `anthropic.claude-3-haiku-20240307-v1:0`) and optionally `Bedrock:Region` so the app uses real Bedrock.  
  - If `ModelId` is empty, all AI responses use in-app fallbacks and no Bedrock calls are made.

So: “Bedrock chatting” is implemented as a shared .NET Bedrock layer (Converse + ConverseStream), used by both the streaming AI Coach and the one-shot AI features (match insight, icebreakers, workout plan, help).
