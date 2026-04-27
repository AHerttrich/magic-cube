/**
 * Solver Web Worker — runs cubejs off the main thread.
 * Loads cubejs via importScripts (CDN), generates pruning tables,
 * then responds to SOLVE and VALIDATE messages.
 *
 * Protocol (SPEC §6.2):
 *   In:  { type: 'INIT' }
 *        { type: 'SOLVE',    payload: { state } }
 *        { type: 'TERMINATE' }
 *   Out: { type: 'INIT_PROGRESS', payload: { percent, stage } }
 *        { type: 'INIT_COMPLETE' }
 *        { type: 'SOLVE_RESULT',  payload: Solution }
 *        { type: 'ERROR',         payload: { code, message } }
 */

/* global importScripts */

const CUBEJS_CDN = 'https://cdn.jsdelivr.net/npm/cubejs@1.2.2/lib/cube.min.js';

let Cube = null;
let solverReady = false;

// ──────────────────────────────────────────────────────────────────────────────
// Message dispatcher
// ──────────────────────────────────────────────────────────────────────────────

self.onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT':
      handleInit();
      break;
    case 'SOLVE':
      handleSolve(payload);
      break;
    case 'TERMINATE':
      self.close();
      break;
    default:
      postError('SOL_INIT_FAILED', `Unknown message type: ${type}`);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// INIT handler — load cubejs and generate pruning tables
// ──────────────────────────────────────────────────────────────────────────────

function handleInit() {
  if (solverReady) {
    self.postMessage({ type: 'INIT_COMPLETE' });
    return;
  }

  self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 10, stage: 'Loading cubejs…' } });

  try {
    // Polyfill CommonJS module/exports for cubejs CDN build
    if (typeof self.module === 'undefined') {
      self.module = { exports: {} };
      self.exports = self.module.exports;
    }

    importScripts(CUBEJS_CDN);

    // Resolve the Cube constructor from module.exports or global fallback
    Cube = self.module.exports;
    if (typeof Cube !== 'function' && Cube && typeof Cube.default === 'function') {
      Cube = Cube.default;
    }
    if (typeof Cube !== 'function') {
      Cube = self.Cube;
    }

    if (!Cube || typeof Cube.initSolver !== 'function') {
      throw new Error('cubejs did not load correctly — Cube.initSolver not found');
    }

    self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 40, stage: 'Generating pruning tables…' } });

    // Synchronous — takes 2-5s, generates ~1MB of in-memory tables
    Cube.initSolver();

    solverReady = true;
    self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 100, stage: 'Ready' } });
    self.postMessage({ type: 'INIT_COMPLETE' });

  } catch (err) {
    postError('SOL_INIT_FAILED', `Solver init failed: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SOLVE handler
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ state: string }} payload
 */
function handleSolve(payload) {
  if (!solverReady) {
    postError('SOL_INIT_FAILED', 'Solver not yet initialized — wait for INIT_COMPLETE');
    return;
  }

  const { state } = payload;

  try {
    const t0 = Date.now();
    const cube = Cube.fromString(state);
    const solutionStr = cube.solve();
    const solveTimeMs = Date.now() - t0;

    const moves = solutionStr
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const moveCount = moves.length;
    const GOD_NUMBER = 20;

    self.postMessage({
      type: 'SOLVE_RESULT',
      payload: {
        moves,
        moveCount,
        solveTimeMs,
        notation: moves.join(' '),
        stats: {
          optimalMax: GOD_NUMBER,
          efficiency: Math.round((moveCount / GOD_NUMBER) * 100),
        },
      },
    });

  } catch (err) {
    // cubejs throws for physically impossible states (parity errors etc.)
    postError('SOL_UNSOLVABLE', err.message || 'This cube state is not solvable — check for scanning errors or a modified cube.');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function postError(code, message) {
  self.postMessage({ type: 'ERROR', payload: { code, message } });
}
