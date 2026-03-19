# Wordle Duel

A multiplayer word game where players compete head-to-head in fast-paced word battles. Built with Next.js, Socket.io, and a pure TypeScript game engine.

## Features

- **Practice Mode**: Hone your skills offline with persistent stats
- **Quick Match**: Real-time PvP battles with matchmaking
- **Three Game Modes**:
  - **Duel**: Classic 1v1 on a single board
  - **Multi Duel**: Race to solve either of two boards
  - **Gauntlet**: Survive three sequential boards
- **Cosmetics & Themes**: 3 visual themes (Default, Ocean, Forest)
- **Accessibility**: Colorblind mode and reduced motion support
- **Stats Tracking**: Win rate, streaks, and personal bests

## Architecture

This is a monorepo with three main packages:

```
wordle-duel/
├── packages/core/          # Pure TypeScript game engine
│   ├── src/
│   │   ├── types.ts        # Game types and enums
│   │   ├── dictionary.ts   # Word validation
│   │   ├── evaluator.ts    # Guess evaluation logic
│   │   ├── seed.ts         # Deterministic puzzle generation
│   │   ├── reducer.ts      # State machine and game logic
│   │   └── scoring.ts      # PvP scoring system
│   └── tests/              # Vitest unit tests
├── apps/server/            # Authoritative Socket.io server
│   └── src/
│       ├── index.ts        # Server entry point
│       ├── matchmaking.ts  # Queue management
│       └── types.ts        # Server types
└── apps/web/               # Next.js 13 frontend
    ├── app/                # App router pages
    ├── components/         # React components
    └── lib/                # Utilities and adapters
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd wordle-duel
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

### Development

Run both the web app and server concurrently:

```bash
# Terminal 1 - Web app (port 3000)
npm run dev

# Terminal 2 - Server (port 3001)
cd apps/server
npm run dev
```

The web app will be available at `http://localhost:3000` and the server at `http://localhost:3001`.

### Testing

Run unit tests for the core game engine:

```bash
cd packages/core
npm test
```

## Environment Variables

### Web App (apps/web/.env.local)

```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

### Server (apps/server/.env)

```
PORT=3001
CLIENT_URL=http://localhost:3000
```

## Deployment

### Web App (Vercel)

1. Connect your repository to Vercel
2. Set the root directory to `apps/web` (or deploy from root)
3. Add environment variable:
   - `NEXT_PUBLIC_SERVER_URL`: Your server URL

### Server (Render/Fly/Railway)

1. Deploy the `apps/server` directory
2. Set environment variables:
   - `PORT`: Server port (usually provided by platform)
   - `CLIENT_URL`: Your web app URL for CORS
3. Ensure `data/allowed.json` and `data/solutions.json` are accessible

**Important**: The server expects word dictionaries at `../../../data/` relative to the compiled output. Ensure these files are copied during deployment.

## Game Mechanics

### Scoring System

In PvP matches, scoring is calculated as follows:

- **Win Bonus**: +10 for winning, -10 for losing
- **Guess Differential**: ±2 points per guess difference (when both win)
- **Time Differential**: ±1 point per 5 seconds (capped at ±10)
- **DNF Penalty**: -10 for not finishing or abandoning

### Match Flow

1. **Queue**: Players join a matchmaking queue by mode
2. **Match Found**: 3-second countdown with optional ghost warmup
3. **Playing**: Real-time board updates with opponent progress
4. **Results**: Score breakdown and rematch option

### Ghost Warmup

When a match is found, players can:
- Start immediately (recommended)
- Continue practicing for up to 30 seconds before auto-start

## Technology Stack

- **Frontend**: Next.js 13 (App Router), React, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Socket.io, TypeScript
- **Game Logic**: Pure TypeScript (framework-agnostic)
- **Testing**: Vitest
- **Build Tool**: TypeScript Compiler

## Development Notes

### Adding Words

Edit `data/allowed.json` (valid guesses) and `data/solutions.json` (daily solutions). All words must be 5 letters and uppercase.

### Core Game Engine

The `packages/core` package is pure TypeScript with zero dependencies on React, DOM, or network. This allows:
- Easy unit testing
- Potential reuse in mobile apps, CLI, etc.
- Deterministic replay and simulation

### State Management

- **Practice**: Uses `useReducer` with core game reducer
- **PvP**: Server is authoritative; client uses core reducer for rendering only
- **Stats**: localStorage via `IStorage` adapter (future: Supabase)

## License

MIT

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request
