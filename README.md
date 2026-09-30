# Poketip

A Pokémon team-building single-page app with an AI assistant, grounded in verified
[PokéAPI](https://pokeapi.co) data.

[**Live demo**](https://poketip.vercel.app) · [Report an issue](https://github.com/hey-Lyn/poketip/issues)

![Poketip Pokédex](docs/pokedex.png)

## Overview

Poketip is an ongoing project with the idea of being a website for Pokémon enthusiasts to get their info from, and also build their own teams.
I'm sure that sounds too generic, what differentiates the project though is the presence of its own AI system, which receives a ton of information and tests so it minimizes the hallucination LLMs tend to have.
At this stage, the AI can both explain info about a specific pokémon (it has access to competitive data!), and also automatically build your pokémon team from scratch or with personalized instruction! it can even be shared to Pokémon Showdown

## Features

- **Pokédex** — browse and search every Pokémon with types, base stats, evolution
  and encounter data.
- **Team Builder** — build a party of up to six Pokémon with full competitive sets
  (nature, EVs, IVs, moves, item, ability, tera type) and live team analysis.
- **AI assistant** — ask about a specific Pokémon or your whole team. The server
  re-verifies every Pokémon/species/move through PokéAPI before the model answers,
  and it can propose validated team edits that you apply explicitly.
- **Campaign guide** — grounded guidance for Pokémon Emerald and FireRed milestones.
- **Accounts** — email auth with private profiles (avatar, bio, favorite Pokémon)
  and an AI credit balance.
- **Themes** — Sylveon and Umbreon palettes with an optional Shiny variant and a
  reduce-motion toggle.
- **Admin** — role-based admin console to manage accounts and credits.

## Tech stack

- **Frontend:** React 19, React Router, Vite
- **Backend:** Vercel serverless functions (`/api`)
- **Data:** Supabase (Postgres + Auth + Storage), PokéAPI, Pokémon Showdown data
  (`@pkmn/dex`)
- **AI:** OpenRouter (server-side only)
- **Tests:** Vitest + Testing Library

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [OpenRouter](https://openrouter.ai) API key

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill it in:

   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — public, safe for the browser.
   - `SUPABASE_URL` — server only; use the same Project URL as `VITE_SUPABASE_URL`.
   - `SUPABASE_SERVICE_ROLE_KEY` — server only; never expose it to the browser.
   - `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` — server only.
   - `AI_DAILY_LIMIT` (optional, default `7`) and `AI_CREDIT_COST` (optional,
     default `1`).
   - `AI_IP_DAILY_LIMIT` (optional, default `14`) — caps requests per network.

3. Run the SQL migrations in the Supabase SQL editor, in order:

   ```text
   supabase/migrations/0001_ai_usage.sql
   supabase/migrations/0002_profiles.sql
   supabase/migrations/0003_roles.sql
   supabase/migrations/0004_profile_security.sql
   supabase/migrations/0005_ip_usage.sql
   ```

4. Enable email sign-up in Supabase Dashboard → Authentication.

5. Run the app:

   ```bash
   npm run dev:full   # Vite + the /api functions (loads .env.local)
   ```

   `npm run dev` runs Vite only; the `/api` routes will not work.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server only |
| `npm run dev:full` | Vite + serverless functions locally |
| `npm test` | Run the test suite |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run test:ai` | Hit a running `dev:full` server as a signed-in user |

## Architecture

- `src/` — React SPA (entry `src/main.jsx`, routes in `src/App.jsx`).
- `src/services/` — browser-side data/API services (PokéAPI, Showdown, Supabase,
  team storage, settings).
- `api/` — Vercel serverless functions; shared logic in `api/_lib/`.
- `supabase/migrations/` — database schema, RLS policies and functions.

### AI and security

The browser never sees the OpenRouter key or model choice, and it cannot send
system instructions. Every AI request requires a signed-in session and is rate
limited per user per day and per client IP, so creating many accounts from one
network cannot bypass the limit. Beyond the free daily limit a request spends
server-owned credits. Profile `credits` and `role` are protected by column-level
grants and a database trigger, and the credit/usage RPCs are executable only by
the service role.

## Deployment

The app deploys to [Vercel](https://vercel.com). Set the same environment
variables in the project settings and connect the repository for automatic
deploys. A `vercel.json` rewrite keeps client-side routes working on refresh.

## License

[MIT](LICENSE)
