# Magic Cube Solver

A privacy-first, client-side web application that lets anyone photograph their Rubik's Cube and receive an optimal algorithmic solution — entirely in the browser, no backend, no AI/LLM.

## Features

- **100% client-side** — zero backend, no data ever leaves your device
- **Optimal solutions** — Kociemba Two-Phase algorithm (≤ 20 moves, God's Number)
- **Photo scanning** — computer vision via OpenCV.js WASM (Sprint 2+)
- **3D visualization** — animated solution playback with Three.js (Sprint 5+)
- **Dark/light theme** — premium glassmorphism UI
- **Offline-capable** — Service Worker caching (Sprint 6+)

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Run unit tests
npm run test

# Lint source
npm run lint

# Production build
npm run build
```

## Architecture

```
src/
├── core/          # EventBus, StateMachine, PluginRegistry, Schemas, Errors, Storage
├── ui/            # App shell, Landing page, Theme toggle
├── viz/           # Three.js scene and cube mesh
├── cv/            # Computer vision pipeline (Sprint 2+)
├── plugins/       # Puzzle type plugins (Sprint 2+)
└── styles/        # Design tokens, base styles, layout, landing
```

Key architectural decisions:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build | Vite 6 | Fast HMR, native ESM, small output |
| Language | Vanilla JS | No framework overhead (~7 views) |
| CV | OpenCV.js WASM | Deterministic, no ML dependency |
| Solver | cubejs (Kociemba) | Pure JS, optimal, well-tested |
| 3D | Three.js | Industry standard, tree-shakeable |
| Hosting | Firebase Hosting | Supports COOP/COEP custom headers |

See `docs/ARCH.md` for the full architecture, ADRs, and module dependency graph.

## Tech Stack

- **Build**: Vite 6.x
- **3D**: Three.js
- **CV**: OpenCV.js (WASM) — Sprint 2+
- **Solver**: cubejs (Kociemba Two-Phase) — Sprint 4+
- **Testing**: Vitest (unit), Playwright (E2E)
- **Hosting**: Firebase Hosting (GCP `tenacious-tiger-473819-p9`)

## Privacy

This app processes everything locally in your browser:
- No camera data is sent to any server
- No analytics or tracking
- Verifiable via browser DevTools Network tab

## Development

### Project Structure

```
magic-cube/
├── index.html              # Vite entry point
├── src/                    # Application source
├── tests/                  # Vitest unit tests
├── public/                 # Static assets (favicon, icons)
├── docs/                   # Architecture and specification docs
├── firebase.json           # Firebase Hosting config (COOP/COEP headers)
├── .firebaserc             # Firebase project: tenacious-tiger-473819-p9
└── .github/workflows/      # CI/CD: GitHub Actions → Firebase deploy
```

### Branches

```
main            — stable, auto-deploys to Firebase
feature/MC-*    — feature branches per sprint task
fix/MC-*        — bug fix branches
```

### Commit Convention

```
feat(scope):   New feature
fix(scope):    Bug fix
refactor:      Code restructure
test:          Tests only
docs:          Documentation
ci:            CI/CD changes
```

Scopes: `core`, `cv`, `scanner`, `solver`, `viz`, `ui`, `ci`, `docs`

## Sprint Plan

| Sprint | Goal | Status |
|--------|------|--------|
| **1** | Foundation & scaffold | ✅ Complete |
| **2** | CV pipeline (OpenCV.js) | Planned |
| **3** | Scanner UX & calibration | Planned |
| **4** | Solver integration | Planned |
| **5** | 3D visualization | Planned |
| **6** | Polish & ship v1.0 | Planned |

## License

MIT © Alexander Herttrich
