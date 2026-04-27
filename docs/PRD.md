# PRD — Magic Cube Solver

> **Version**: 1.1  
> **Status**: Draft  
> **Author**: Alexander Herttrich  
> **Date**: 2026-04-26  
> **Repository**: github.com/[TBD]/magic-cube (public)  
> **Hosting**: Firebase Hosting (tenacious-tiger-473819-p9) + Custom Domain

---

## 1. Vision & Problem Statement

### Vision
A free, privacy-first web application that lets anyone photograph their twisty puzzle and receive an optimal algorithmic solution — instantly, entirely in the browser, with no AI/LLM dependencies.

### Problem
- Solving a Rubik's Cube (or variant) is intimidating for beginners
- Existing solver apps often require manual color input (tedious, error-prone)
- Many rely on server-side processing, raising privacy and latency concerns
- Most tools only support the standard 3×3×3 cube

### Solution
A client-side web app that:
1. **Scans** puzzle faces via the device camera using classical computer vision
2. **Validates** the detected state for physical correctness
3. **Solves** using established combinatorial algorithms (Kociemba, reduction, etc.)
4. **Visualizes** the step-by-step solution on an interactive 3D model

---

## 2. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Beginner** | Owns a cube but can't solve it | Step-by-step guided solution |
| **Learner** | Wants to understand solving techniques | See optimal moves, learn patterns |
| **Speedcuber** | Already solves, wants to verify optimal solutions | Move count comparison |
| **Collector** | Owns various puzzle types (4×4, pyramid, etc.) | Multi-geometry support |

---

## 3. User Stories

### P0 — Must Have (MVP)

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-01 | As a user, I can scan my 3×3×3 Rubik's Cube face-by-face using my phone/laptop camera | Live camera feed with 3×3 grid overlay; confirms each face after detection |
| US-02 | As a user, I can manually correct any misdetected colors before solving | Tappable 3×3 grid per face; cycle through 6 colors |
| US-03 | As a user, I can calibrate colors for my specific lighting conditions | Guided calibration flow using center squares as references |
| US-04 | As a user, I receive the optimal (≤20 moves) solution for my cube | Solution displayed in standard move notation |
| US-05 | As a user, I can watch the solution animated on a 3D cube model | Interactive Three.js cube with play/pause/step controls |
| US-06 | As a user, I see clear error messages when my scanned state is invalid | Specific guidance on which face to rescan and why |
| US-07 | As a user, the app works on mobile and desktop browsers | Responsive layout; camera access works on both |
| US-08 | As a user, I can see the move count and how it compares to God's Number (20) | Stats card showing move count, optimality percentage |

### P1 — Should Have (v1.1)

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-09 | As a user, I can share my solution as an image/link | Shareable card with cube state + solution |
| US-10 | As a user, I can switch between light and dark theme | Theme toggle in header; light mode default |

### P2 — Nice to Have (Future)

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-11 | As a user, I can solve a 4×4×4 Revenge Cube | Scanner detects 4×4 grid; reduction + Kociemba solving |
| US-12 | As a user, I can solve a Pyraminx (tetrahedron) | Triangular face detection; dedicated solver |
| US-13 | As a user, I can solve a Megaminx (dodecahedron) | Pentagonal face detection; dedicated solver |
| US-14 | As a user, I can solve a 2×2×2 Pocket Cube | Simplified scanner; phase-based solver |
| US-15 | As a user, I can see an "Explore" page listing all supported puzzle types | Puzzle catalog with icons and descriptions |

### Testability Convention

All interactive elements must carry a `data-testid` attribute following this naming convention:

```
data-testid="<view>-<element>-<qualifier>"
```

Examples:
- `data-testid="scanner-btn-confirm"`
- `data-testid="scanner-grid-cell-3-2"`
- `data-testid="solution-btn-play"`
- `data-testid="solution-move-7"`
- `data-testid="landing-btn-scan"`

This ensures Playwright E2E tests can reliably target elements without coupling to CSS classes or DOM structure.

---

## 4. Functional Requirements

### FR-1: Camera Scanning Engine

| Req | Description |
|---|---|
| FR-1.1 | Access device camera via `getUserMedia` with rear-camera preference on mobile |
| FR-1.2 | Render live camera feed in a `<video>` element with CSS grid overlay |
| FR-1.3 | Guided face sequence: Front → Right → Back → Left → Top → Bottom |
| FR-1.4 | Auto-detect face orientation and validate 3×3 grid geometry |
| FR-1.5 | Real-time color preview of detected tiles before user confirms |

### FR-2: Computer Vision Pipeline

| Req | Description |
|---|---|
| FR-2.1 | OpenCV.js (WASM) loaded lazily and cached via Service Worker |
| FR-2.2 | Pre-processing: Gaussian blur → Canny edge detection |
| FR-2.3 | Contour detection → polygon filtering (4-sided, area threshold) |
| FR-2.4 | Spatial clustering to identify 3×3 grid arrangement |
| FR-2.5 | Color extraction from cell centers (median of inner region) |
| FR-2.6 | LAB color space conversion + CIEDE2000 distance matching |
| FR-2.7 | All CV operations run in a dedicated Web Worker |

### FR-3: Color Calibration System

| Req | Description |
|---|---|
| FR-3.1 | **Auto-calibration**: Detect center squares (guaranteed known color per face) as reference anchors |
| FR-3.2 | **Manual calibration**: User taps each of the 6 center tiles to sample under current lighting |
| FR-3.3 | **Adaptive white balance**: Estimate illuminant color from the brightest detected region and compensate |
| FR-3.4 | **Tolerance tuning**: Dynamically widen/narrow CIEDE2000 thresholds based on color separation quality |
| FR-3.5 | **Persistence**: Store calibration profile in `localStorage` for returning users in the same environment |
| FR-3.6 | **Lighting warning**: Detect low-light or extreme color-cast conditions and advise user to improve lighting |

### FR-4: Cube State Management

| Req | Description |
|---|---|
| FR-4.1 | Represent cube state as 54-character string (Kociemba notation) |
| FR-4.2 | Validate: exactly 9 of each color |
| FR-4.3 | Validate: valid corner and edge piece combinations |
| FR-4.4 | Validate: correct parity (solvable state) |
| FR-4.5 | Provide specific error diagnostics for invalid states |

### FR-5: Solving Engine

| Req | Description |
|---|---|
| FR-5.1 | Kociemba Two-Phase Algorithm for 3×3×3 |
| FR-5.2 | Web Worker execution to avoid UI blocking |
| FR-5.3 | Pruning table generation on first load (~2–5s) |
| FR-5.4 | Pruning table persistence in IndexedDB for instant subsequent loads |
| FR-5.5 | Solution output in standard notation (R, U, F, L, D, B + primes/doubles) |
| FR-5.6 | Display move count and optimality comparison vs. God's Number |

### FR-6: 3D Visualization

| Req | Description |
|---|---|
| FR-6.1 | Three.js rendered interactive 3D Rubik's Cube |
| FR-6.2 | Orbit controls (rotate/zoom the view) |
| FR-6.3 | Step-by-step move animation with configurable speed |
| FR-6.4 | Playback controls: play, pause, step forward, step back, reset |
| FR-6.5 | Current move highlighted in the notation list |
| FR-6.6 | Cube face colors match the scanned state |

### FR-7: UI/UX

| Req | Description |
|---|---|
| FR-7.1 | Light mode default, dark mode available via toggle |
| FR-7.2 | Responsive: mobile-first, works on desktop |
| FR-7.3 | Google Fonts: Inter (body), Space Grotesk (headings), JetBrains Mono (notation) |
| FR-7.4 | Smooth transitions between scan → validate → solve → visualize |
| FR-7.5 | Loading states with progress indicators for OpenCV init and solving |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | OpenCV.js loads in < 3s on 4G; solver completes in < 2s |
| **Bundle Size** | Initial load < 500KB (OpenCV lazy-loaded) |
| **Privacy** | Zero data leaves the device — no analytics, no server calls |
| **Accessibility** | WCAG 2.1 AA (keyboard nav, screen reader labels, color contrast) |
| **Browser Support** | Chrome 90+, Safari 15+, Firefox 90+, Edge 90+ |
| **Offline** | Service Worker caches app shell + OpenCV.js + solver tables |

---

## 6. Assumptions & Constraints

### Assumptions
- Users have a **standard Rubik's brand** color scheme (white, yellow, red, orange, blue, green). Non-standard color schemes (e.g., Japanese cubes with blue→cyan) are out of scope for MVP but the calibration system can accommodate them.
- The device camera supports a **minimum resolution of 640×480**.
- JavaScript is enabled in the browser.
- Users can physically hold and rotate the cube to show all 6 faces.
- The cube is a **standard stickered or stickerless** model — patterned cubes (mirror, picture cubes) are out of scope.

### Constraints
- **No network calls** after initial page load — all processing must run client-side.
- **No native app** — browser-only, no Capacitor/Cordova.
- **No user accounts** — stateless, no backend, no database.
- **OpenCV.js WASM bundle (~8MB)** — must be lazy-loaded and cached to avoid impacting initial page load.
- **SharedArrayBuffer** requires COOP/COEP headers — may limit cross-origin resource loading.

---

## 7. Dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| `vite` | ^6.x | MIT | Build tool and dev server |
| `cubejs` | ^1.x | MIT | Kociemba Two-Phase solver implementation |
| `three` | ^0.170.x | MIT | 3D rendering engine |
| `opencv.js` | 4.9.0 | Apache 2.0 | Computer vision (loaded from CDN, not npm) |
| `eslint` | ^9.x | MIT | Linting (dev dependency) |
| `vitest` | ^3.x | MIT | Unit testing (dev dependency) |
| `@playwright/test` | ^1.x | Apache 2.0 | E2E testing (dev dependency) |

> All runtime dependencies are MIT or Apache 2.0 licensed, compatible with public open-source distribution.

---

## 8. Future Expansion Roadmap

```
v1.0  ──  3×3×3 Rubik's Cube (Kociemba)
  │
v1.1  ──  Solution sharing, theme toggle
  │
v2.0  ──  4×4×4 Revenge Cube (Reduction → Kociemba)
  │         └── New: 4×4 grid detection, inner-slice notation, parity handling
  │
v2.1  ──  2×2×2 Pocket Cube (Optimal solver, small state space)
  │
v3.0  ──  Pyraminx (custom tetrahedron geometry + solver)
  │         └── New: triangular face detection, tip/axis notation
  │
v3.1  ──  Megaminx (dodecahedron geometry + solver)
  │         └── New: pentagonal face detection, 12-face scanning
  │
v4.0  ──  Puzzle Catalog / "Puzzle Hub" with unified scanner
```

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| **Scan Success Rate** | ≥ 85% of faces detected correctly without manual correction |
| **Solve Time** | < 2s from valid state to solution (including solver init) |
| **Page Load** | < 3s TTI on mobile 4G |
| **Solution Optimality** | Average ≤ 19 moves (near God's Number) |

---

## 10. Out of Scope (MVP)

- User accounts / authentication
- Solution history / persistence across sessions
- Social features (leaderboards, competitions)
- PWA / offline-first (deferred to v1.1)
- Non-English localization
- Speedcubing timer
- Non-standard color schemes (handled by calibration but not explicitly designed for)

---

## 11. Glossary

| Term | Definition |
|---|---|
| **Cubie** | One of the 26 visible small cubes that make up a 3×3×3 Rubik's Cube |
| **Facelet** | A single colored sticker on one face of a cubie (54 total on a 3×3×3) |
| **CIEDE2000** | International standard formula (ΔE₀₀) for computing perceptual color difference between two colors |
| **God's Number** | The maximum number of moves needed to solve any Rubik's Cube from any position (proven to be 20 for 3×3×3 in HTM) |
| **HTM** | Half-Turn Metric — a move counting system where both quarter turns (R) and half turns (R2) count as 1 move |
| **Kociemba Algorithm** | The Two-Phase Algorithm that finds near-optimal solutions (≤20 moves) by reducing to a subgroup first |
| **LAB Color Space** | A color model (CIE L*a*b*) designed to be perceptually uniform — equal numerical changes correspond to equal perceived changes |
| **Pruning Table** | Pre-computed lookup table used by the solver to quickly eliminate non-productive move sequences |
| **Parity** | A mathematical property of the cube state; incorrect parity means the state is physically unreachable |
| **Plugin** | A self-contained module implementing Scanner, Solver, Renderer, and Validator for a specific puzzle type |
| **Von Kries** | A chromatic adaptation transform that adjusts colors to account for different lighting conditions |
| **D65 Illuminant** | The CIE standard illuminant representing average daylight (~6500K color temperature) |
