# Lobby for Them — Claude Code Guide

## Project overview
Animal welfare advocacy site. Users enter a zip code, see active
animal welfare bills in their state + federal, and email their
representatives in one click.

## Tech stack
- React + Vite + Tailwind CSS + React Router
- Supabase (bills database + zip_districts table)
- LegiScan API (live bill data, 24hr cache in Supabase)
- Congress.gov API (federal rep lookup by state code)
- Open States API (state rep lookup by lat/lng)
- Zippopotam.us (zip to state + lat/lng, no key needed)
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
- scripts/import-zip-districts.mjs — loads Census zip-to-district crosswalk into Supabase

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
- NEVER run git add, git commit, or git push — version control is handled by the user
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

## Rep Lookup Architecture
How `src/lib/civic.js` resolves representatives for a given zip + bill scope.
**Do not change this without understanding why each piece exists.**

### STATE bills → Open States API (VITE_OPENSTATES_API_KEY)
1. Geocode zip via Zippopotam.us → lat/lng
2. Call `https://v3.openstates.org/people.geo?lat=&lng=`
3. **CRITICAL: filter results to `jurisdiction.classification === 'state'` only**
   Open States returns federal reps (senators, house rep) alongside state reps.
   Without this filter, federal reps leak into state bill pages.
4. Returns: state senator + state house rep only

### FEDERAL bills → Congress.gov API (VITE_CONGRESS_API_KEY)
1. Geocode zip via Zippopotam.us → state abbreviation
2. Call `https://api.congress.gov/v3/member/{stateCode}?currentMember=true`
3. Look up congressional district from Supabase `zip_districts` table
   (Census Bureau 118th Congress ZCTA crosswalk — see "Zip-to-District Data" below)
4. Filter house reps to only the one whose district matches; fall back to all if not found
5. Returns: 2 US Senators + 1 US House rep

### Scope isolation — never break this
- `getRepresentatives(zip, 'federal')` calls Congress.gov only, never Open States
- `getRepresentatives(zip, 'state')` calls Open States only, never Congress.gov
- Reps are stored in **local component state only** (`EmailComposer.jsx`)
- `ZipContext` stores only the zip string (for pre-filling the input) — never reps
- `EmailComposer` initializes `localReps = null` on mount; populated only after
  the user submits their zip for that specific bill
- Never combine state and federal rep results

## Zip-to-District Data
- The `zip_districts` table in Supabase maps every US zip code to its
  congressional district number and state abbreviation
- Data comes from the US Census Bureau ZCTA-to-Congressional District
  crosswalk (currently 118th Congress, 2023–2025)
- Used by `src/lib/civic.js` to filter Congress.gov house members down
  to the one rep whose district matches the user's zip code
- To update after redistricting: get the new crosswalk file from
  https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/
  and re-run `node scripts/import-zip-districts.mjs`
- The script does a full upsert so it's safe to re-run at any time
- Redistricting happens after each decennial census — next update ~2031

## Keeping this file up to date
- If any tech stack, file structure, color scheme, environment
  variables, or deployment setup changes, automatically update
  the relevant section in this file as part of that task.
- If something significant is added (new page, new API, new
  script, new dependency) suggest adding it to this file and
  offer the updated text.
- This file should always reflect the current state of the project.
