# GetTrainMate permanent social creative standard

**Version:** `2026-09-15-journey-v1`  
**Code:** `scripts/growth/lib/social-creative-standard.mjs`  
**Approved baseline:** `docs/growth/owned-social/approved/journey-pickleball-after-match.jpg`

## Brand invariant

**TRAIN → VIBE → DATE**

Start with a shared activity. Build a real connection. See where it goes.

Canonical homepage language:

- TRAIN TOGETHER. SEE WHERE IT GOES.
- Start with fitness. Stay for the connection.
- FIND YOUR PEOPLE

## Approved reference (2026-09-15)

Pickleball man + woman walking together after playing.

Headline: **THE MATCH ENDS. THE CONNECTION DOESN'T HAVE TO.**

Copy the **logic and quality**, not the same sport/people every day.

## Future automation sequence

1. Load this standard  
2. Review recent published posts (sport / stage / headline)  
3. Select non-repetitive sport  
4. Select TRAIN → VIBE → DATE stage (prefer TRAIN→VIBE)  
5. Define connection moment  
6. Generate photo (people/activity/environment only)  
7. Reject irrelevant photography  
8. Generate sport-specific headline  
9. Apply deterministic branding  
10. Make TRAIN → VIBE → DATE readable  
11. Score ≥ 12/14 with no zero categories  
12. Publish max one post  
13. Record sport/scene/headline  
14. Send daily report email  

## Hard rejects

Restaurant crowds, cocktail/nightlife heroes, isolated athletes, generic dating glamour, unreadable type, missing journey strip, images that could advertise an unrelated gym/bar/dating app.

## Do not

- Reinterpret the brand each morning  
- Publish multiple candidates  
- Generate important marketing text inside the image model  

## Generated-image retention

Generated social assets under local `docs/growth/owned-social/generated/`
and S3 `social/generated/` are retained for **7 days**. Every production
publish run purges older generated assets. Approved baseline/reference
assets under `docs/growth/owned-social/approved/` are permanent and excluded.

## Photography quality (permanent)

Prefer curated real Unsplash stock when the selected sport has a match.
Use Bedrock only as fallback, with prompts that never say the brand word
"TRAIN" in a way that produces locomotives/railroads.

Hard-reject railroad tracks, railway scenes, locomotive imagery, and
camera-staring AI advertising compositions.
