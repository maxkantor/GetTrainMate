# GetTrainMate permanent social creative standard

**Version:** `2026-09-18-journey-v2`  
**Code:** `scripts/growth/lib/social-creative-standard.mjs`  
**Quality reference (look only):** `docs/growth/owned-social/approved/journey-running-connection.jpg`  
**Quality reference (look only):** `docs/growth/owned-social/approved/journey-pickleball-after-match.jpg`

Approved files are **style samples**, not daily publish sources. Never republish them as today's post.

## Brand invariant

**TRAIN → VIBE → DATE**

Start with a shared activity. Build a real connection. See where it goes —
friendship, dating, maybe more. Never promise marriage or outcomes.

Canonical homepage language:

- TRAIN TOGETHER. SEE WHERE IT GOES.
- Start with fitness. Stay for the connection.
- FIND YOUR PEOPLE

## Visual quality bar

Young, attractive athletic **man + woman** after a shared workout,
looking at each other with real chemistry. Activity-first, then vibe/date energy.

Copy the **look and logic** of the approved samples — never the same photo, sport, or people every day.

## What “right approach” means

| Must have | Must not |
|-----------|----------|
| Beautiful / fit young adults | Clipboard coaching / “schoolteacher” poses |
| Clear sport or workout context | Restaurant / cocktail nightlife heroes |
| Natural chemistry (eye contact, laugh, talk) | Recycled preexisting / evergreen creatives |
| TRAIN → VIBE → DATE readable on image | Railroad / locomotive AI from brand word TRAIN |
| One man + one woman preferred for chemistry posts | Camera-staring twin AI clones / plastic CGI skin |

## Future automation sequence

1. Load this standard  
2. Review recent published posts (sport / stage / headline)  
3. Select non-repetitive sport  
4. Select TRAIN → VIBE → DATE stage (prefer TRAIN→VIBE)  
5. Define connection moment with beautiful people + chemistry  
6. **Bedrock generates a NEW photorealistic photograph** (fail closed if quality gate fails)  
7. Reject fake-AI look, irrelevant scenes, or unattractive coaching photography  
8. Generate sport-specific headline  
9. Apply deterministic branding  
10. Make TRAIN → VIBE → DATE readable  
11. Score ≥ 12/14 with no zero categories  
12. Publish max one post  
13. Record sport/scene/headline  
14. Send daily report email  

## Hard rejects

Restaurant crowds, cocktail/nightlife heroes, isolated athletes, generic dating glamour without activity, clipboard/coaching lesson vibes, unreadable type, missing journey strip, railroad tracks, recycled prior posts, images that could advertise an unrelated gym/bar/dating app.

## Do not

- Reinterpret the brand each morning  
- Publish multiple candidates  
- Generate important marketing text inside the image model  
- Treat TRAIN / VIBE / DATE as three unrelated campaign silos  
- Select preexisting Unsplash/approved/evergreen files as today's hero  

## Generated-image retention

Generated social assets under local `docs/growth/owned-social/generated/`
and S3 `social/generated/` are retained for **7 days**. Every production
publish run purges older generated assets. Approved baseline/reference
assets under `docs/growth/owned-social/approved/` are permanent and excluded.

## Photography quality (permanent)

**Default provider: Bedrock Stable Diffusion 3.5 Large** — generate a **new** photograph every day.
(`SOCIAL_IMAGE_BEDROCK_MODEL_ID` can override to Ultra / Core.)

The image must look like a real camera photo (natural skin, candid moment, documentary sports photography), not AI art, CGI, or plastic advertising renders.

- Do **not** recycle evergreen prior publishes when generation fails — fail closed instead  
- Do **not** use Unsplash stock rotation for daily production (`SOCIAL_IMAGE_PROVIDER=stock` is diagnostics only)  
- `--image-file` is manual recovery only, never the daily default  

Hard-reject railroad tracks, clipboard coaching, climbing AI heroes, near-duplicate waterfront couple scenes vs recent posts, and any creative that looks obviously AI-generated.
