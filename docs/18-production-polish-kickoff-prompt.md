# Codex Kickoff Prompt — SPND Production Polish

Copy the prompt below into a new Codex task from the repository root.

---

You are completing the final production-polish pass for SPND, a private shared-household budgeting application.

Start by reading these documents in order:

1. `docs/12-accounting-rules.md`
2. `docs/13-final-stabilization-plan.md`
3. `docs/14-production-polish-product-spec.md`
4. `docs/15-transaction-review-and-rules.md`
5. `docs/16-responsive-visual-system.md`
6. `docs/17-production-polish-implementation-plan.md`
7. `docs/11-design-reference-images.md`

Treat docs 12 and 15 as binding accounting and transaction behavior. If an older document conflicts with them, the newer approved rule wins. Do not invent product decisions or expose hidden imports.

The required product outcomes are:

- one reusable transaction row and transaction-detail system everywhere;
- category-detail transactions grouped and styled exactly like Activity;
- swipe right to review and swipe left to move/change category, with accessible menu equivalents;
- remembered categorization applied to pending, posted, and eligible existing unreviewed transactions without marking them reviewed;
- Activity organized as `Review {count} | All activity`, not Needs review as a filter;
- a real expected-versus-received Income view linked from Budget and Plan;
- curated filled/duotone category icons and restrained semantic gradients;
- full-screen detail workflows on phones and right inspectors on desktop;
- no reload-based synchronization between Home, Budget, Activity, and detail views.

Work in the exact milestone order in `docs/17-production-polish-implementation-plan.md`. Begin with P0 and P1. Do not start broad CSS work until transaction and remembered-rule behavior is protected by automated tests.

Before editing:

1. inspect the current branch and working tree;
2. preserve unrelated user changes;
3. run and record tests, lint, typecheck, build, and available Playwright checks;
4. inspect all migrations already applied and create forward-only migrations;
5. map duplicate transaction/category components and the active CSS cascade;
6. compare current 390px screens with the new production-polish mocks.

Implementation constraints:

- Keep Next.js, TypeScript, Supabase, Vercel, and SimpleFIN.
- Store currency as integer cents.
- Keep all queries and mutations household-scoped with RLS.
- Do not log SimpleFIN access URLs, raw financial payloads, emails, or secrets.
- Preserve manual edits across SimpleFIN resync and pending-to-posted reconciliation.
- Use optimistic UI only with rollback and an accessible result announcement.
- Do not use `window.location.reload()` as the update strategy.
- Do not auto-review remembered-rule matches.
- Do not rewrite reviewed history or manual splits when a rule is created.
- Do not add a fifth mobile navigation item.
- Do not implement general document imports or automatic budget rollover.
- Use gradients only where the visual guide assigns meaning.

For each milestone:

1. state the precise scope and files likely to change;
2. implement the smallest complete vertical slice;
3. add or update tests before moving on;
4. run focused tests and then the full quality suite;
5. capture 390px and desktop screenshots for changed workflows;
6. compare the result against the acceptance criteria;
7. report migrations, environment changes, known risks, and the next milestone.

P1 must include tests proving:

- a remembered rule categorizes pending and posted imports but leaves them unreviewed;
- creating a rule updates eligible existing unreviewed matches;
- reviewed history and manual splits are preserved;
- pending-to-posted reconciliation preserves category and review state;
- move and undo keep category aggregates correct;
- conflicting household edits are surfaced.

Stop and ask only when a missing choice would change accounting behavior, delete household data, require a new paid service, or expand scope beyond these documents. Otherwise make a documented, reversible assumption and continue.

Do not declare the pass complete until every Definition of Done item in `docs/17-production-polish-implementation-plan.md` is verified.

---
