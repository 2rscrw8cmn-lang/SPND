# SPND — Design Reference Images

This is the durable home for visual references used to implement SPND. Keep approved references in the repository so every implementation agent sees the same target.

## Where to put screenshots

Add image files in:

    docs/assets/reference/

Recommended names:

    docs/assets/reference/phase-3-home-safe-to-spnd.jpg
    docs/assets/reference/phase-3-budget-dense-list.jpg
    docs/assets/reference/phase-3-activity-review.jpg
    docs/assets/reference/phase-3-category-detail.jpg

Use lowercase names with hyphens. Prefer JPG or optimized WEBP; use PNG only when sharp text or transparency matters. Keep each image below roughly 2 MB where possible.

Do not commit bank balances, account numbers, transaction names, addresses, or other real financial data. Crop, redact, or replace with fictional data first.

## Current reference set

| File | Screen | What to emulate |
| --- | --- | --- |
| 01-3D628D3C-CF49-4E35-BA05-289EF11FE858_4_5005_c.jpeg | Budget | Compact month rail, dense category rows, inline alert, icon color language, bottom nav |
| 02-D40BA880-F92C-4778-B287-5C0FCC2D2225_4_5005_c.jpeg | Home | Available/Safe-to-SPND hierarchy, one hero, restrained lime, high information density |
| D03B00AA-9E5E-4C77-BE2C-D0CB7907027D.png | Copilot categories | Category status visualization and color differentiation |
| 9CC8EB1B-664A-4C53-9366-A36D2CFF29F0.png | Copilot detail | Transaction detail actions and category context |
| 3D4A4B7B-6FC2-47B7-90F6-C3139F8638BB.png | Copilot activity | Day grouping, dense scanability, category chips |
| C9816477-84DA-4771-BDAE-490F00DC895B.png | Copilot dashboard | Dashboard hierarchy and review preview |

Those files may have started as temporary uploads. Copy redacted, approved versions into docs/assets/reference before relying on them in repository work. Update this table with their final repository paths once committed.

## How to use references

References define product direction, not pixels to copy.

- Use SPND branding, wording, category taxonomy, data, and tokens.
- Borrow hierarchy, density, motion restraint, and interaction patterns.
- Never copy Copilot logo/wordmark, artwork, proprietary copy, exact layouts, or assets.
- When references disagree, the Phase Three screen contracts decide.
- Name any reference that materially shaped a screen in the implementation note or pull request.

## Screenshot checklist for reviews

For every visual milestone, add redacted screenshots of:

- 390px Home: empty, on-track, attention, disconnected.
- 390px Budget: ordinary month, over-budget category, empty category.
- 390px Activity: Needs review, after review action, category-filtered, pending.
- 390px category detail: transactions present, no transactions, settings section.
- 430px and desktop spot checks.
- Any error or import-review state changed by the milestone.

Use stateful filenames such as p3-activity-needs-review-after-swipe.png. Keep test data clearly fictional.
