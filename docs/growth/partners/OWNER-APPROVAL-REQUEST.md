# Blocking owner approval — owned Instagram post

**Status:** BLOCKING. Not posted. No posting authorization exists.  
**Date prepared:** 2026-08-17  
**Approval id:** `IG-2026-08-17`  
**Channel:** Instagram `@gettrainmate` (owned account linked from the site footer: https://www.instagram.com/gettrainmate/)  
**Audience:** Existing Instagram followers plus anyone who sees the public post (Atlanta TRAIN positioning)  
**Landing (attributed):** https://gettrainmate.com/atlanta-training-partners?utm_source=instagram&utm_medium=organic&utm_campaign=owned-ig-2026-08-17  

This is **one** distribution action. Do not treat deploy, drafts, or this file as distribution.

Cursor **must not** log into Instagram, automate comments/DMs, or post without Max’s explicit reply-approval below.

Partner email remains paused. Do not invent inboxes. Do not enable `PARTNER_OUTREACH_SEND_ENABLED`.

---

## Exact caption to post (copy verbatim)

Looking for a consistent training partner in Atlanta?

GetTrainMate is TRAIN-first (not dating-first). Create a profile, pick TRAIN, and find people who want to run, lift, or race with you.

Atlanta: https://gettrainmate.com/atlanta-training-partners?utm_source=instagram&utm_medium=organic&utm_campaign=owned-ig-2026-08-17

No guaranteed matches. You control your profile.

---

## How to approve

Reply to the Admin growth email, or commit a one-line note here, with:

`APPROVED IG-2026-08-17` + date/time (America/New_York) + the Instagram username that will post.

After approval, **Max posts** the caption above (Cursor has no Instagram credentials). Optional same caption on Facebook https://www.facebook.com/gettrainmate is a second action — do not do it in the same run unless this Instagram post is already live.

---

## How this run will count results

| Line | Rule |
|------|------|
| Attributed visits | GA4 `landing_page_view` on `/atlanta-training-partners` with `utm_source=instagram` and `utm_campaign=owned-ig-2026-08-17` after the post goes live |
| Activations | `signup_completed` with the same UTM (or session attribution) |
| Checkout starts | `checkout_started` with that attribution |
| Newly attributed external customers | Verified GetTrainMate-attributed live Stripe payers whose first attributed paid conversion is this campaign — **not** anyone who merely paid during the date window |
| New customers acquired by this run | Same as newly attributed, and only if the post actually went live during the run |
| Existing customers | Prior verified attributed payers (baseline; currently 0 until allowlist reconciliation) |
| Customers observed during experiment window | Anyone who paid in the window, including unattributed — **do not** call these new customers |

Until the post is live: all of visits / activations / checkouts / new customers for **this action** are 0.
