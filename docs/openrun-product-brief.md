# OpenRun — Product Brief

## What It Is

OpenRun is a live basketball session manager built for how open runs actually work. The host manages the game from their phone, everyone else watches live from their browser. No app install required, minimal friction for players.

---

## The Problem

Open runs are informal but they still need organizing — who's next, what's the score, who scored. Right now this is all done by memory, shouting, or a whiteboard. Players who haven't arrived yet have no idea what's happening. There's no record of anything.

---

## The Solution

A web app where the host creates a run, shares a QR code, and manages the entire session from one screen. Players scan to join the queue. Everyone — including those still at home — can see the live score, who scored, and where they are in the queue.

---

## Users

| Role | Access | Account |
|---|---|---|
| Host | Full control — queue, teams, score, clock | Required |
| Player | Joins queue, sees live score and their points | Guest (optional account) |
| Spectator | Read-only live view | Guest |

Guests who create an account start tracking their stats from signup onwards. No backfilling of guest history.

---

## Data Structure

```
Run
├── id, name, location, date
├── format (new 10 / winner stays / host decides)
├── session code (public, for QR)
├── queue [ ...players ]
└── Games
    ├── Game 1
    │   ├── goal (17, 21, etc.)
    │   ├── time limit (optional)
    │   ├── duration (only if time limit was set)
    │   ├── Team A [ ...players ]
    │   ├── Team B [ ...players ]
    │   ├── score A, score B
    │   ├── per-player points
    │   └── winner
    ├── Game 2
    └── ...
```

---

## Core Features

### Creating a Run
- Host signs in, sets a name, optional location, and game format
- Session code is generated, QR is immediately live
- Formats: new 10 every game / winner stays / host decides after each game

### Queue
- Players scan QR or enter session code at any point during the run
- They type their name and land at the back of the queue
- Queue persists across all games in the run
- Auto-updates after each game based on the format

### Queue Management
- Dedicated page accessible throughout the entire run via bottom nav
- Available from lobby, during a game, and between games

Queue is structured in three sections:
```
On Court  — players in the current game, locked while game is live
Up Next   — next 10 players in line
Waiting   — everyone else in order
```

Host actions per player:
- **Reorder** — drag up or down in the queue
- **Mark Out** — player stepped away; greyed out but stays in the list in case they return
- **Reinstate** — bring a marked-out player back into the queue
- **Remove** — gone for good, taken off entirely
- **Rename** — fix a name or swap to a nickname

Every player shows a games played counter so the host can:
- Bump a late arrival up if they haven't played yet
- Spot who's had multiple runs and deprioritize if needed
- Make fair calls between early arrivals and latecomers

### QR Accessibility
- Run lobby: QR front and center
- During a game: QR accessible behind a share button
- Results screen: no QR

### Team Assignment
- Host pulls the next 10 players from the queue
- Default split: top 5 vs bottom 5
- Host can drag players between teams to balance
- Scramble button for a random split
- Host confirms, game starts

### During a Game
- Host taps a player's name to add points
- All connected viewers see the score update live
- If a time limit is set: server-side clock that survives page reloads and connection drops
- If no time limit: no clock shown
- Late arrivals can scan the QR and join the queue at any time

### Ending a Game
- First team to reach the goal wins
- If timed: highest score when clock hits zero wins
- Queue auto-updates based on run format
- Host taps "Start Next Game"

### Run Feed
- Available to anyone who joined the run
- Live game pinned to the top showing current score
- All past games listed below in order
- Tap any past game to see full details

### Past Game View
- Final score and winner
- Duration (only shown if the game had a time limit)
- Per-player points for both teams

### Run History
- Account holders can view all their past runs
- Each run shows all games, scores, and per-player points

---

## Clock Architecture

The game clock never "runs" on any device. When the host starts the clock, the server stores a timestamp. Every client calculates the display by subtracting from that timestamp.

```
display = time_limit - (now - started_at - total_paused_duration)
```

This means the clock is consistent for every viewer regardless of when they open the app, whether they reload, or whether they had a connection drop. There is no drift.

---

## Auth Model

```
Host        → account required to create a run
Player      → guest, name only, no account needed
Spectator   → guest, read only, no account needed
```

When a guest creates an account, their previous guest scores are not backfilled. Stats are tracked from signup onwards. The CTA to create an account is shown subtly after a game, once the player has already seen their points — not before.

---

## Screens

```
Landing
└── Create a Run / Join a Run

Sign Up / Log In
└── only when creating a run

Create Run
└── name, location, format → session code generated

Run Lobby — Host
└── QR front and center, queue preview, Start Game

Run Lobby — Player / Spectator
└── position in queue, live status

Bottom Nav (persistent during a run)
├── Game
├── Queue
└── Feed

Queue Page — Host
└── On Court / Up Next / Waiting sections
    per-player: games played, reorder, mark out, reinstate, remove, rename

Queue Page — Player / Spectator
└── read-only, see full queue and games played per player

Team Assignment — Host
└── next 10 pulled, drag to assign, scramble button, confirm

Set Game — Host
└── score goal, time limit or none, start

Game — Host View
└── live score, player names, tap to score, share button (QR), end game

Game — Spectator / Player View
└── live score, who scored, position in queue

Game Results
└── final score, per-player points, updated queue, Start Next Game

Run Feed
└── live game pinned to top, past games listed below, tap to view

Past Game View
└── final score, duration (if timed), per-player points per team

Run History — Account holders
└── all past runs, all games, per-player points

Account (optional)
└── stats across all runs from signup onwards
```

---

## Intentionally Out of Scope

- Shot clock
- Timeouts
- Foul tracking
- Quarters and halves
- Substitutions mid-game
- Tournament brackets
- Co-hosts or host transfer
- Grouping players in queue together

---

## Build Order

1. Create run + QR + queue (join flow)
2. Queue management page
3. Team assignment (drag, scramble, confirm)
4. Live game screen (scoring)
5. Server-side clock (timed games)
6. Game results + next game flow
7. Run feed + past game view
8. Run history
9. Optional accounts + stat tracking
