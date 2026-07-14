# SPND — Design and UX Guide

## Brand

**SPND** is a modern consumer budgeting app. The feeling should be confident, colorful, and satisfying—not corporate finance software, a spreadsheet, or a childish game.

**Tagline:** Make room for what matters.

## Non-negotiable visual direction

- Dark-only, forever. Do not add a light theme or system-theme switch.
- Near-black canvas with graphite surfaces.
- Vivid category colors used intentionally for recognition and pacing.
- Big numbers, short labels, clear status.
- No gradients, glassmorphism, stock illustrations, mascots, or dense charts.
- Motion is smooth and subtle: number easing, progress fill, small page transitions. Never bouncy.

## Tokens

| Token | Value | Use |
|---|---:|---|
| Canvas | `#0D0E12` | Page background |
| Surface | `#17191F` | Cards and sheets |
| Surface raised | `#1E2129` | Active/interactive surfaces |
| Border | `#2A2E38` | Subtle card divisions |
| Text primary | `#F5F7FA` | Headings and primary numbers |
| Text secondary | `#A6ACB8` | Supporting labels |
| Lime | `#C9FF4A` | Primary action, safe-to-spend, success |
| Aqua | `#45D9E1` | Groceries/example category |
| Coral | `#FF705B` | Dining/attention |
| Violet | `#9B6CFF` | Family/example category |
| Yellow | `#FFD24A` | Caution/pending |
| Red | `#FF5D6C` | Overspend/error |

## Typography and layout

- Use a clean geometric sans (e.g. Geist Sans); use tabular numerals for financial values.
- Safe-to-SPND money figure: 52–64px mobile, bold, tight tracking.
- Section title: 22–24px, bold.
- Body: 15–16px; never make key values tiny.
- Mobile content width: full width with 16px side padding.
- Card radius: 22–24px. Touch target: at least 44px.

## Primary screen: Home

1. Header: SPND wordmark, greeting, compact profile/settings button.
2. Hero: **SAFE TO SPND**, large dollar value, timeframe, progress ring or compact breakdown affordance.
3. Budget pulse: 3–5 high-priority category cards with colored icon disc, progress bar, and remaining dollars.
4. One insight: one concise, actionable sentence.
5. Recent activity: merchant, category, amount, date, and quick category correction.
6. Bottom navigation: Home, Budget, Activity, Plan.

## Interaction language

Use friendly factual copy:

- "You’re on track this week."
- "Dining is pacing $84 over plan."
- "We need a little more information before this is accurate."
- "Categorized for future purchases."

Avoid shame language such as "failed," "bad spending," or alarmist red screens.

## Status treatment

| Status | Treatment |
|---|---|
| On track | Lime dot/chip and clear label |
| Near limit | Yellow + exact remaining dollars |
| Over budget | Coral/red + a practical next action |
| Needs review | Neutral surface + visible explanation |
| Sync issue | Yellow status badge; last successful sync shown |

## Screenshot reference

The approved home-screen concept uses the large safe-to-spend hero, lime progress ring, color-coded budget pulse cards, recent activity, and dark bottom navigation. Treat it as the composition reference, not a pixel-for-pixel spec.
