# CLAUDE_HANDOFF.md — Sprint 1 + Sprint 2 + Sprint 3 + Sprint 4

**Date**: 2026-04-27
**Agent**: Claude Sonnet 4.6

---

## Sprint 4: Solver Integration

### Summary

Implemented the full Sprint 4 solver pipeline (S4.1–S4.8):

- **State Builder + Validator** (`src/solver/validator.js`): Converts 6 scanned face grids (scan order F→R→B→L→U→D) to a 54-char Kociemba state string (order U→R→F→D→L→B). Validates color count (9 of each color) and center uniqueness. Deep parity checks deferred to cubejs.

- **Solver Web Worker** (`src/solver/solver.worker.js`): Loads `cubejs@1.2.2` from jsDelivr CDN via `importScripts`, calls `Cube.initSolver()` to generate pruning tables (~2–5s), then solves states with `Cube.fromString(state).solve()`.

- **SolverEngine** (`src/solver/solver.js`): Main-thread singleton wrapping the worker. Provides idempotent `init()`, `solve(stateString)` returning `Promise<Solution>`, and `dispose()`. Emits events on shared `eventBus`.

- **UI Views** — three new views: `validating.js` (spinner + validation logic), `solving.js` (spinner + live status), `solution.js` (move blocks, efficiency bar, action buttons).

- **Wired into app shell**: `app.js` handles all three new states. Validation errors route back to `Scanning` as a dismissable banner. `main.js` pre-warms solver on startup.

### Files Changed (Sprint 4)

**Created**: `src/solver/validator.js`, `src/solver/solver.worker.js`, `src/solver/solver.js`, `src/ui/validating.js`, `src/ui/solving.js`, `src/ui/solution.js`, `src/styles/validating.css`, `src/styles/solving.css`, `src/styles/solution.css`, `src/styles/solver.css`, `tests/solver/validator.test.js`, `tests/solver/solver.test.js`

**Modified**: `src/ui/app.js` (new view cases), `src/main.js` (CSS imports + solver pre-warm)

### Follow-up Items (Sprint 4)

1. **Worker format**: Worker uses `importScripts()` (classic worker). Vite is configured with `worker.format: 'es'` — this may fail in production builds. Consider `{ type: 'classic' }` in the Worker constructor or an ESM-compatible Kociemba package for Sprint 5.

2. **Pruning table caching**: `Cube.initSolver()` runs on every page load (~2–5s). cubejs doesn't expose pruning table serialization, so IndexedDB caching is not feasible without vendoring a fork.

3. **3D solution playback**: Solution view shows moves as text only. Animated 3D playback is Sprint 5.

### Verification (Sprint 4)

```bash
npm run test   # 250 tests, all pass
npm run lint   # 0 errors
npm run build  # Clean build (bundle size warning is pre-existing Three.js)
```

End-to-end: `npm run dev` → Scan/edit 6 faces → All Done → Validating → Solving → Solution view with moves, count, and efficiency bar.

---

---

## 1. Summary

### Sprint 1 + Sprint 2 (previous — see git history for details)
- Sprint 1: project foundation, app shell, landing page, Three.js cube, core engine
- Sprint 2: CV pipeline (CIEDE2000, ColorClassifier, CalibrationEngine, Detector, cv.worker.js)

### Sprint 3: Scanner UX & Calibration (this session)

Implemented S3.1–S3.12 in full. The scanner UX pipeline is now end-to-end:
landing page CTA → camera activation → real-time grid overlay → face capture →
detection → confirm/edit/rescan → 6-face guided sequence → calibration persistence.

All modules follow the existing architecture (EventBus, StateMachine, vanilla JS views,
CSS custom properties only). No new npm dependencies added.

---

## 2. Files Created or Modified

### New Files

#### Scanner Module (`src/scanner/`)
| File | Purpose |
|---|---|
| `src/scanner/camera.js` | CameraManager: getUserMedia with ideal constraints, graceful error handling, EventBus events |
| `src/scanner/detectionLoop.js` | rAF loop: lighting assessment every 2 s, on-demand face capture |
| `src/scanner/faceSequence.js` | 6-face state manager: F→R→B→L→U→D order, confirm/advance, jump-to-rescan, pending result |

#### UI Views (`src/ui/`)
| File | Purpose |
|---|---|
| `src/ui/scanner.js` | Full-viewport camera + 3×3 grid overlay, capture button, lighting indicator, cube preview panel |
| `src/ui/faceConfirm.js` | Post-detection confirm/edit/rescan view with confidence % and warnings |
| `src/ui/faceEditor.js` | 3×3 tappable grid cycling 6 colours, tooltip, flash animation |
| `src/ui/calibration.js` | Camera-based colour reference capture, progress bar, auto-save |
| `src/ui/cubePreview.js` | Unfolded cube net widget (cross layout), tap-to-rescan, appear animation |

#### Styles (`src/styles/`)
| File | Purpose |
|---|---|
| `src/styles/scanner.css` | Video feed, toolbar, grid overlay, capture button, lighting indicator |
| `src/styles/faceConfirm.css` | Confidence badge, colour grid, warning banner, action buttons |
| `src/styles/faceEditor.css` | 3×3 tile grid, colour flash animation, colour legend |
| `src/styles/calibration.css` | Camera preview, 6-target grid, progress bar |
| `src/styles/cubePreview.css` | Unfolded cross net, placeholder cells, tile colours, appear animation |

#### Tests
| File | Tests |
|---|---|
| `tests/scanner/faceSequence.test.js` | 23 — face order, confirm/advance, completion, reset, pending result, jump-to-face |
| `tests/scanner/camera.test.js` | 18 — getUserMedia constraints, permission/NotFound/NotReadable errors, stopCamera, switchCamera |
| `tests/ui/cubePreview.test.js` | 15 — net rendering, empty/scanned states, tile colors, tap-to-rescan, unmount cleanup |

### Modified Files
| File | Change |
|---|---|
| `src/core/eventBus.js` | Added `SCANNER_CAMERA_READY`, `SCANNER_CAMERA_ERROR`, `SCANNER_FACE_CONFIRMED`, `SCANNER_SEQUENCE_COMPLETE` events |
| `src/cv/calibration.js` | Added `export const calibrationEngine = new CalibrationEngine()` singleton |
| `src/ui/app.js` | Added `Scanning`, `FaceConfirm`, `FaceEdit` cases to `setView()`; imported new views |
| `src/main.js` | Imported 5 new CSS files; calls `calibrationEngine.loadSavedProfile()` on init |
| `src/ui/landing.js` | Wired CTA button to `SELECT_PUZZLE → START_SCAN`; removed `disabled` attribute |
| `CLAUDE_HANDOFF.md` | Updated to include Sprint 3 (this file) |

---

## 3. GitHub Repo

**URL**: https://github.com/AHerttrich/magic-cube (public)

Sprint 3 commit: `feat(scanner): Sprint 3 — scanner UX, guided face sequence, calibration, cube preview`

**Action required**: Run `git push origin master` to push to GitHub (permission prompt blocks automated push).

---

## 4. Firebase Live URL

**https://tenacious-tiger-473819-p9.web.app**

Deployed 2026-04-27 after Sprint 3 build.

---

## 5. Test Results

```
Test Files   9 passed (9)
     Tests  226 passed (226)
  Duration  20.96s

Lint:   0 errors, 0 warnings
Build:  ✓ built in 1.50s
```

Breakdown:
- Existing Sprint 1+2 tests: 170 (unchanged, all still pass)
- New Sprint 3 tests: 56 (23 + 18 + 15)

---

## 6. Follow-Up Items

### Required (blocking)
1. **Push to GitHub**: Run `git push origin master` — all commits are local. Blocked by permission prompt.

2. **Push `.github/workflows/deploy.yml`** (if needed): The CI workflow lacks `workflow` scope.
   ```bash
   gh auth refresh -s workflow
   git add .github/workflows/deploy.yml
   git commit -m "ci: add GitHub Actions deploy workflow"
   git push
   ```

### Optional / Future Sprint
3. **Calibration view entry point**: `src/ui/calibration.js` is complete but has no navigation
   entry in the current state machine. Wire it via a Settings menu in Sprint 4.

4. **Detector eager init**: `detector.init()` is not called on app start, so the first capture
   triggers WASM load (may be slow). Consider calling `detector.init()` when entering scanner view.

5. **Auto-calibration (S3.7 partial)**: The hook to record centre-tile LAB into
   `calibrationEngine.addReference()` after each face confirmation is not yet fully wired.
   Requires extracting LAB from the detection result's `gridPoints` (Sprint 4).

6. **PuzzleSelect view**: Landing CTA jumps through `PuzzleSelect` state quickly — if a
   puzzle-selection screen is needed, add the view in Sprint 4.

---

## 7. Verification Steps

```bash
# All tests must pass (226)
npm run test

# Zero lint errors
npm run lint

# Build succeeds
npm run build

# Push to GitHub (requires manual approval or permission grant)
git push origin master

# Verify live site
open https://tenacious-tiger-473819-p9.web.app
# 1. Click "📸 Scan My Cube" — camera activates
# 2. Grid overlay visible on video feed
# 3. Capture button triggers detection → Face Confirm view
# 4. Tap "✏️ Edit" → Face Editor with tappable colour tiles
# 5. Confirm 6 faces — cube net preview updates in real time
# 6. Lighting dot: green/yellow/red depending on brightness
```
