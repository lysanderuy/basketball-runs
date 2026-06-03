# BallRuns

BallRuns is the sideline tool for running pickup basketball. It helps hosts manage queues, run games, and track scores in real time — while players just show up and play.

## What is BallRuns?

BallRuns keeps the chaos out of pickup basketball. Hosts create a session and share a 6-character code. Players scan in, join the queue, and wait their turn. The host assigns teams, tracks points, and manages the clock — all from their phone. Everyone sees the same live state without refreshing.

## Core Principles

**Host-first design.** The host is managing a game on a court, not sitting at a desk. Every action should be fast and obvious.

**Real-time by default.** Queue changes and score updates push to all connected clients instantly. Nobody should be looking at stale state.

**Zero friction for players.** Players join with a name and a code — no account, no download, no friction.

**Scores are events, not edits.** Every point is logged as an event. Undo doesn't delete — it voids. The record stays intact.

**Queue order is explicit.** Order is a linked list the host controls, not a timestamp sort. Reordering is a first-class action.

## Who Should Use BallRuns

**Run organizers.** People who host recurring pickup sessions and want structure without spreadsheets.

**Gym and court managers.** Anyone managing a rotating queue of teams across multiple games.

**Casual groups.** Friend groups who want a fair, visible queue instead of "who called next?"

## Key Features

**Session codes.** Share a 6-character code to bring players into your run — no accounts needed on their end.

**Live queue management.** Add players, reorder the queue, mark players out, or pull them back — with changes reflected instantly for everyone.

**Team assignment.** Pick who plays before each game starts. Drag from the queue directly into Team A or Team B.

**Live scoreboard.** Log points by team. Undo any point without losing the audit trail.

**Game clock.** Optional countdown timer with pause and resume. Paused time is tracked separately so the clock stays accurate.

**Run formats.** Supports Winner Stays, New Ten, and Host Decides formats.

**Game history.** Every game, team lineup, and point event is stored. Past games are always viewable from the feed.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase** — PostgreSQL, Auth, Realtime
- **Drizzle ORM** + Zod
- **Tailwind CSS** + Radix UI

## Project Structure

```
basketball-runs/
├── app/
│   ├── auth/                        Sign in, sign up, OAuth callback
│   ├── (protected)/                 Host-only pages (create run, history, account)
│   ├── runs/[code]/
│   │   ├── lobby/                   Pre-game queue and player management
│   │   ├── team-assignment/         Assign players to teams before tip-off
│   │   ├── results/                 Post-game summary
│   │   └── (session)/               Active game shell
│   │       ├── game/                Live scoreboard and clock
│   │       ├── queue/               Queue view during a game
│   │       └── feed/                Game event history
│   └── api/                         All API routes (runs, queue, games, scoring, clock)
├── lib/
│   ├── db/                          Drizzle schema and client
│   ├── supabase/                    Browser, server, and middleware clients
│   └── validations/                 Zod schemas
├── services/                        Business logic called by API routes
├── hooks/                           Realtime subscriptions (client-side)
├── types/                           Drizzle-inferred TypeScript types
└── supabase/migrations/             SQL migration files
```

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key

3. Apply the database schema
   ```bash
   npm run db:push
   ```

4. Start the dev server
   ```bash
   npm run dev
   ```

App runs at [localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:push` | Apply migrations to Supabase |
