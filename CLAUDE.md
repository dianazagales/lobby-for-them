# Lobby for Them — Claude Code Guide

## Project overview
Animal welfare advocacy site. Users enter a zip code, see active
animal welfare bills in their state + federal, and email their
representatives in one click.

## Tech stack
- React + Vite + Tailwind CSS + React Router
- Supabase (bills database)
- LegiScan API (live bill data, 24hr cache in Supabase)
- Congress.gov API (federal rep lookup by zip)
- Open States API (state rep lookup by zip)
- Zippopotam.us (zip to state, no key needed)
- Netlify (hosting, auto-deploys from GitHub main branch)
- Namecheap (domain: lobbforthem.org)

## Key files
- src/pages/Home.jsx — homepage with zip code hero
- src/pages/Bills.jsx — bill listing with filters, search, sort
- src/pages/BillDetail.jsx — individual bill + email composer
- src/pages/About.jsx — about page
- src/pages/Admin.jsx — bill management (password protected)
- src/components/Navbar.jsx — nav with capitol dome logo
- src/lib/supabase.js — Supabase client
- src/lib/civic.js — rep lookup logic
- src/context/ZipContext.jsx — zip + reps state across pages
- scripts/seed-puppy-bills.mjs — bulk bill import script
- scripts/generate-why-it-matters.mjs — AI description generator

## Color scheme (do not change without being asked)
- Primary navy: #1a2744
- Accent orange: #e85d26
- Background: #f8f6f1

## Environment variables — NEVER hardcode these
All secrets must use import.meta.env.VITE_* in frontend code.
Required variables (set in .env locally and in Netlify):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_LEGISCAN_API_KEY
- VITE_CONGRESS_API_KEY
- VITE_OPENSTATES_API_KEY
- VITE_ADMIN_PASSWORD
- ANTHROPIC_API_KEY (scripts only, not frontend)

## Critical rules — always follow these
- NEVER hardcode API keys, tokens, or secrets in any source file
- NEVER commit .env, .env.local, or dist/ to git
- NEVER change copy/text unless explicitly asked
- NEVER change colors or design unless explicitly asked
- Always use Tailwind utility classes as the primary styling method
- Always keep code mobile responsive
- Always keep code clean and readable

## Bill display rules
- Only show bills that are actionable — users must be able to
  contact a rep and make a difference
- Actionable statuses: Introduced, In Progress, In Committee,
  Active, Engrossed
- Never show bills with status: Passed, Signed, Failed, Vetoed,
  Dead, Tabled
- Bills have an is_active boolean in Supabase — always filter
  by is_active = true on all public-facing queries
- When fetching from LegiScan, always update status and set
  is_active = false if the bill is no longer actionable
- URGENT badge should never appear on Engrossed bills —
  demote to ACTIVE since it has already passed one chamber
- During batch import, any bill with last_action_date older
  than 1 year is automatically checked against LegiScan for
  a newer version. If none found, it is marked active = false.

## Most sensitive pages — be extra careful here
- src/pages/Bills.jsx — filtering, search, and zip logic are complex
- src/pages/BillDetail.jsx — email composer and rep lookup
- The email composer flow must always work end to end

## How to run locally
npm run dev → http://localhost:5174

## Deployment
Push to GitHub main branch → Netlify auto-deploys.
Never manually commit dist/ — Netlify builds it from source.

## When to read this file
Read CLAUDE.md at the start of every new session and whenever
working on something that touches multiple files or core
functionality.

## Keeping this file up to date
- If any tech stack, file structure, color scheme, environment
  variables, or deployment setup changes, automatically update
  the relevant section in this file as part of that task.
- If something significant is added (new page, new API, new
  script, new dependency) suggest adding it to this file and
  offer the updated text.
- This file should always reflect the current state of the project.
