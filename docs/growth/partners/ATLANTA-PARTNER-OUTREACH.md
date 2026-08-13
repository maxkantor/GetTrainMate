# Atlanta TRAIN partner acquisition package (EXP-002)

**Status:** Draft for Max approval — **outreach NOT sent**  
**Date:** 2026-08-13  
**Product:** GetTrainMate · Metro: Atlanta · Mode: TRAIN  
**Hub:** https://gettrainmate.com/partners/atlanta  
**Tracking:** `partner` / `partner_code` + `experiment_id=EXP-002` · GA4 `landing_page_view` / `signup_started` with `partner_code` · Stripe metadata `partner_code` when checkout occurs  

**Success threshold (14 days per partner after first shared link):** ≥3 completed Atlanta TRAIN profiles attributed to that partner code **or** ≥10 partner-landing sessions with ≥1 signup start. Guardrail: no fake profiles; no outreach without approval.

**Partner-code format:** `atl-{slug}` (lowercase, hyphenated). Landing URL: `https://gettrainmate.com/partners/atlanta/{code}`

**Proposed member benefit (for approval — not activated):** Free Founding Atlanta membership for an initial period + partner-specific landing + invite link + aggregated signup/activation reporting. No sale/sharing of private member data. No guaranteed matches or attendance.

---

## Prospects (public org info only)

| # | Organization | Public URL | Type | Why relevant | Partner code | Landing URL |
|---|--------------|------------|------|--------------|--------------|-------------|
| 1 | Atlanta Track Club | https://www.atlantatrackclub.org/ | Run club | Large Atlanta running community; TRAINING partners fit ATC culture | `atl-track-club` | /partners/atlanta/atl-track-club |
| 2 | Fleet Feet Atlanta | https://www.fleetfeet.com/s/atlanta | Run / retail community | Race training groups and weekly runners | `atl-fleet-feet` | /partners/atlanta/atl-fleet-feet |
| 3 | F3 Atlanta | https://f3atlanta.com/ | Outdoor fitness | Free workouts; partner-finding is a natural need | `atl-f3` | /partners/atlanta/atl-f3 |
| 4 | Atlanta Pickball (community label) | _(confirm local club URL before send)_ | Pickleball | High social training demand; TRAIN mode | `atl-pickleball` | /partners/atlanta/atl-pickleball |
| 5 | Atlanta Hyrox / CrossFit community | _(confirm box/org URL before send)_ | Gym / Hyrox | Partner workouts and class consistency | `atl-hyrox-crossfit` | /partners/atlanta/atl-hyrox-crossfit |
| 6 | Atlanta Tri Club (community label) | _(confirm URL before send)_ | Rec sports / triathlon | Multi-sport training partners | `atl-tri-club` | /partners/atlanta/atl-tri-club |
| 7 | Midtown Atlanta trainers | _(confirm studio/trainer directories)_ | Trainer | Clients need accountability partners | `atl-midtown-trainers` | /partners/atlanta/atl-midtown-trainers |
| 8 | Atlanta recreational sports leagues | _(confirm league operator)_ | Rec sports | Soft schedule + partner seeking | `atl-softball-rec` | /partners/atlanta/atl-softball-rec |
| 9 | Atlanta outdoor fitness groups | _(confirm meetup/org)_ | Outdoor club | Park/trail partners | `atl-outdoor-club` | /partners/atlanta/atl-outdoor-club |
| 10 | Generic Atlanta TRAIN (internal) | https://gettrainmate.com/partners/atlanta | Template | Catch-all invite for approved one-off partners | `atl-generic-train` | /partners/atlanta/atl-generic-train |

Rows marked “confirm URL” must be verified by Max before any email is sent.

---

## Personalized outreach drafts (NOT SENT)

### 1 — Atlanta Track Club

**Subject:** Training-partner invite for Atlanta runners (GetTrainMate)

Hi Atlanta Track Club team — I’m Max with GetTrainMate (gettrainmate.com). We’re helping Atlanta athletes find **TRAIN**-mode partners (not dating-first). We built a private invite for your community:  
https://gettrainmate.com/partners/atlanta/atl-track-club  
Code: `atl-track-club`. Members keep control of profiles; we never sell member data. Happy to share aggregated signup stats only. Would you be open to sharing this with interested runners?

### 2 — Fleet Feet Atlanta

**Subject:** Invite link for Atlanta runners looking for training partners

Hi Fleet Feet Atlanta — GetTrainMate matches people who want consistent training partners in Atlanta. Here’s a Fleet Feet–tagged invite (no obligation):  
https://gettrainmate.com/partners/atlanta/atl-fleet-feet  
We can report only aggregated joins from that link. Interested in a short pilot with your running groups?

### 3 — F3 Atlanta

**Subject:** Partner invite for F3 Atlanta PAX who want mid-week training buddies

Hi F3 Atlanta — GetTrainMate is TRAIN-first for Atlanta. Invite for your community:  
https://gettrainmate.com/partners/atlanta/atl-f3  
No fake profiles, no guaranteed matches — just a place for PAX to find compatible partners by schedule/city. OK if I send a one-paragraph blurb you can paste?

### 4–10 — Template (customize org name + URL + code)

**Subject:** Atlanta TRAIN partner invite for {{Org}}

Hi {{Org}} — GetTrainMate helps Atlanta people find training partners (TRAIN mode). Your invite:  
https://gettrainmate.com/partners/atlanta/{{code}}  
Benefit we’re proposing (pending approval): Founding Atlanta access for early members + aggregated activation report. We don’t sell private member data or promise matches. May I share a short blurb for your newsletter / Discord / Instagram?

---

## Follow-up draft (day 7, if no reply)

Hi again — just bumping the Atlanta TRAIN invite for {{Org}}: {{landing_url}}. Happy to jump on a 10-minute call or send a one-pager. No pressure if the timing isn’t right.

---

## Tracking plan

| Step | Signal |
|------|--------|
| Partner page view | GA4 `landing_page_view` + `partner_code` |
| Signup start | `signup_started` + `partner_code` |
| Attribution persist | session `partner` → checkout `partner_code` |
| Density | Admin metro CRM aggregates when credentials available (min cohort) |

---

## Distribution completed this run

- **Shipped in product:** partner hub + invite landings + codes (live after Amplify).  
- **Outreach sent:** **none** (awaiting Max).  
- **Partner accounts created:** **none**.
