# SPND

> A private, shared household budgeting app that makes daily money decisions clear.

SPND is a dark-only, mobile-first web application for Zack and Stephanie. It uses SimpleFIN Bridge for read-only account syncing, fixed monthly category budgets, automatic categorization, and a cash-flow-based **Safe to SPND** number.

## Product principles

1. Answer the daily question first: **How much is safe to spend?**
2. Keep budgeting collaborative and non-judgmental.
3. Make corrections fast; a correction should improve future suggestions.
4. Treat banking credentials and synced financial data as highly sensitive.
5. Build the smallest useful version first.

## Documentation

- [Product brief](docs/01-product-brief.md)
- [Build plan for Codex](docs/02-agent-build-plan.md)
- [Technical architecture](docs/03-architecture.md)
- [SimpleFIN Bridge setup and integration](docs/04-simplefin-setup.md)
- [Design system and UX guide](docs/05-design-guide.md)
- [Owner setup checklist](docs/06-owner-setup.md)
- [Data model](docs/07-data-model.md)
- [Production launch](docs/08-production-launch.md)
- [Phase Two product and build plan](docs/09-phase-2-plan.md)

## Recommended stack

- Next.js (App Router) + TypeScript
- Vercel for hosting and scheduled jobs
- Supabase Postgres, Auth, and Row Level Security
- SimpleFIN Bridge for read-only transaction data
- Tailwind CSS + shadcn/ui primitives + Lucide icons

Do not add bank login forms, payments, transfers, card issuance, or financial advice. SPND is a private read-only budgeting tool.
