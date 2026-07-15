# SPND — Responsive and Visual System

> Purpose: make SPND recognizable, compact, and usable across phone, tablet, and desktop. This guide refines [05-design-guide.md](05-design-guide.md) and the Phase Three references.

## Responsive modes

Do not treat breakpoints as column-count changes only.

| Mode | Suggested range | Navigation | Detail behavior | List behavior |
| --- | --- | --- | --- | --- |
| Compact phone | 320–599px | Bottom navigation | Full-screen route/view | One column, flat groups |
| Tablet | 600–899px | Bottom or compact rail | Wide sheet or split view | One/two columns by task |
| Desktop | 900px+ | Persistent left rail | Right inspector | Master-detail where useful |

Use content needs rather than device names in implementation. Validate at 320, 375, 390, 430, 768, 1024, and 1440px.

## Density contract

| Element | Compact target |
| --- | --- |
| Page inset | 16px, 14px only at 320px |
| Section gap | 18–24px |
| Transaction row | 58–66px |
| Category row | 62–72px |
| Standard touch target | 44 × 44px minimum |
| Supporting type | 12–13px minimum |
| Body type | 15–16px |
| Page title | 24–28px |
| Hero amount | 42–52px |
| Summary radius | 18–22px |
| Row divider | 1px low-contrast |

Reduce card count and internal padding before reducing type or touch targets.

## Surface hierarchy

Use three elevation levels:

1. Canvas: near-black app background.
2. Content surface: list regions and quiet controls.
3. Emphasis surface: Safe to SPND, monthly summary, destructive warning, or selected inspector.

Transactions inside a list are not individual cards. Category groups are section headers, not rounded containers around more rounded containers.

## Gradient strategy

Gradients are an SPND signature when tied to meaning.

### Atmospheric gradients

- Safe to SPND: near-black base with a restrained lime radial glow from the upper-right quadrant.
- Budget summary: charcoal-to-deep-olive directional gradient.
- Income summary: deep emerald glow distinct from the general lime action color.
- Over-budget alert: dark wine/coral gradient with clear text contrast.

Keep these subtle enough that white text remains readable and screenshots still feel dark.

### Functional gradients

- Review action: lime → chartreuse.
- Move/category action: violet → indigo.
- Progress fill: category base color → lighter endpoint.
- Selected month or mode: translucent lime-to-olive surface, not a glowing neon pill.

### Do not gradient

- every transaction row;
- every settings row;
- form fields;
- long list backgrounds;
- ordinary secondary buttons.

## Category visual identity

Replace the identical outline-circle treatment with a curated icon registry.

Each category stores:

- icon key;
- palette key;
- optional user override;
- stable fallback.

Default presentation:

- 38–40px rounded-square tile;
- 22–24px filled or duotone glyph;
- two-stop category gradient;
- subtle inner highlight and restrained outer shadow;
- sufficient foreground contrast.

Recommended defaults:

| Category | Glyph | Palette |
| --- | --- | --- |
| Housing | house | violet–indigo |
| Utilities | lightning bolt | yellow–orange |
| Groceries | cart/basket | cyan–teal |
| Dining | fork and knife | orange–amber |
| Transportation | car | lime–green |
| Insurance | shield-check | blue–indigo |
| Healthcare | heart/cross | coral–red |
| Family & Kids | family/blocks | pink–violet |
| Toiletries | bottle/droplet | pink–magenta |
| Shopping | bag | purple–pink |
| Entertainment | ticket/film | magenta–violet |
| Travel | plane | sky–blue |
| Savings | vault/piggy bank | teal–emerald |
| Debt | card/receipt | amber–orange |
| Income | wallet/down arrow | lime–emerald |

Do not use emoji. Do not choose glyphs whose meaning conflicts with the category.

## Semantic color

- Lime: safe, selected, reviewed, primary action.
- Emerald: received income and positive cash-flow events.
- Amber: pending, approaching budget, or uncertain match.
- Coral/red: over budget, destructive, or negative shortfall.
- Violet: move/reclassify actions and planning context.
- Muted gray: inactive, excluded, or neutral.

Pair color with text, icon, or pattern. Never encode status by color alone.

## Reusable component contracts

Build and use these shared primitives:

- `TransactionRow`
- `TransactionGroup`
- `TransactionInspector`
- `CategoryTile`
- `CategoryRow`
- `CategoryInspector`
- `MetricStrip`
- `InlineAlert`
- `ModeSwitcher`
- `UndoToast`
- `FullScreenMobileView`
- `DesktopInspector`

Phone and desktop wrappers may differ, but the content and domain actions inside inspectors remain shared.

## Motion

Motion should explain change:

- swipe follows the pointer and snaps predictably;
- moved rows collapse from their old category;
- destination totals interpolate to their new values;
- review action resolves the row and advances the queue;
- Undo restores position when possible;
- progress changes animate only after a user action, not on every render.

Respect `prefers-reduced-motion`. Optional haptics must never be required feedback.

## Phone interaction requirements

- Full-screen detail uses a standard back control, not a giant close button.
- Browser Back closes the topmost detail/picker before leaving the parent list.
- Bottom navigation honors `env(safe-area-inset-bottom)`.
- Sticky actions rise above the software keyboard.
- Long forms use progressive disclosure.
- Horizontal chip lists have edge fades and are reserved for short, optional sets.
- Primary content begins close to the header; avoid redundant page title plus subtitle plus card heading stacks.

## Desktop requirements

- Activity supports a persistent list with transaction inspector.
- Budget can keep the category list visible while category detail is open.
- Filters may remain visible in a sidebar or toolbar.
- Hover reveals actions but never replaces the overflow menu.
- Content width is task-specific; do not stretch transaction text across the full viewport.

## Accessibility

- Meet WCAG AA contrast for text and functional icons.
- Maintain 44px interactive targets.
- Provide visible focus states.
- Trap focus in true modal pickers and make the background inert.
- Announce review, move, save, failure, and undo results.
- Give swipe actions equivalent buttons.
- Keep transaction amounts readable at 200% text zoom.

## Visual acceptance

- Four transaction rows fit comfortably within a 390px Activity viewport below its compact header.
- Category detail and Activity rows are visually indistinguishable apart from contextual labels.
- Icons remain recognizable in grayscale by shape, not color alone.
- A screenshot is recognizable as SPND through dark canvas, earned lime, atmospheric summary gradients, and category tiles.
- No screen contains card-in-card-in-card hierarchy.

