/**
 * SolverEngine — main-thread interface to the solver Web Worker.
 * Manages the worker lifecycle and exposes a Promise-based solve API.
 *
 * Usage:
 *   await solverEngine.init();
 *   const solution = await solverEngine.solve(stateString);
 */
import { eventBus, Events } from '../core/eventBus.js';

/**
 * @typedef {Object} Solution
 * @property {string[]} moves
 * @property {number} moveCount
 * @property {number} solveTimeMs
 * @property {string} notation
 * @property {{ optimalMax: number, efficiency: number }} stats
 */

class SolverEngine {
  constructor() {
    /** @type {Worker|null} */
    this._worker = null;
    /** @type {Promise<void>|null} */
    this._initPromise = null;
    /** @type {((value: void) => void)|null} */
    this._initResolve = null;
    /** @type {((reason: Error) => void)|null} */
    this._initReject = null;
    /** @type {((solution: Solution) => void)|null} */
    this._solveResolve = null;
    /** @type {((err: Error) => void)|null} */
    this._solveReject = null;
    this._ready = false;
  }

  /**
   * Start the worker and wait for pruning tables to be ready.
   * Safe to call multiple times — returns the same promise.
   * @returns {Promise<void>}
   */
  init() {
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = new Promise((resolve, reject) => {
      this._initResolve = resolve;
      this._initReject = reject;
    });

    eventBus.emit(Events.SOLVER_INIT_PROGRESS, { percent: 0, stage: 'Starting solver worker…' });

    this._worker = new Worker(
      new URL('./solver.worker.js', import.meta.url),
      { type: 'classic' }
    );

    this._worker.onmessage = (event) => this._handleMessage(event.data);
    this._worker.onerror = (err) => {
      const msg = err.message || 'Worker error';
      if (this._initReject) {
        this._initReject(new Error(msg));
        this._initReject = null;
      }
      if (this._solveReject) {
        this._solveReject(new Error(msg));
        this._solveReject = null;
      }
      eventBus.emit(Events.SOLVER_ERROR, { code: 'SOL_INIT_FAILED', message: msg });
    };

    this._worker.postMessage({ type: 'INIT' });

    return this._initPromise;
  }

  /**
   * Returns true once the solver is initialized and ready.
   * @returns {boolean}
   */
  isReady() {
    return this._ready;
  }

  /**
   * Solve the given 54-char Kociemba state string.
   * Waits for init to complete if called before init finishes.
   *
   * @param {string} stateString - 54-char Kociemba notation
   * @returns {Promise<Solution>}
   */
  async solve(stateString) {
    // Auto-init if not yet started
    if (!this._initPromise) {
      this.init();
    }
    // Skip the await when already ready so that _solveReject is set
    // synchronously — avoids a race where a worker ERROR arrives before
    // the Promise executor runs.
    if (!this._ready) {
      await this._initPromise;
    }

    return new Promise((resolve, reject) => {
      this._solveResolve = resolve;
      this._solveReject = reject;
      eventBus.emit(Events.SOLVER_INIT_PROGRESS, { percent: 0, stage: 'Solving…' });
      this._worker.postMessage({ type: 'SOLVE', payload: { state: stateString } });
    });
  }

  /**
   * Terminate the worker and reset state.
   */
  dispose() {
    if (this._worker) {
      this._worker.postMessage({ type: 'TERMINATE' });
      this._worker = null;
    }
    this._initPromise = null;
    this._ready = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal message handler
  // ──────────────────────────────────────────────────────────────────────────

  /** @param {{ type: string, payload?: * }} msg */
  _handleMessage(msg) {
    switch (msg.type) {
      case 'INIT_PROGRESS':
        eventBus.emit(Events.SOLVER_INIT_PROGRESS, msg.payload);
        break;

      case 'INIT_COMPLETE':
        this._ready = true;
        eventBus.emit(Events.SOLVER_READY, {});
        if (this._initResolve) {
          this._initResolve();
          this._initResolve = null;
          this._initReject = null;
        }
        break;

      case 'SOLVE_RESULT':
        eventBus.emit(Events.SOLVER_SOLUTION, msg.payload);
        if (this._solveResolve) {
          this._solveResolve(msg.payload);
          this._solveResolve = null;
          this._solveReject = null;
        }
        break;

      case 'ERROR': {
        const err = new Error(msg.payload?.message || 'Solver error');
        err.code = msg.payload?.code;
        eventBus.emit(Events.SOLVER_ERROR, msg.payload);

        if (this._initReject) {
          this._initReject(err);
          this._initReject = null;
          this._initResolve = null;
        } else if (this._solveReject) {
          this._solveReject(err);
          this._solveReject = null;
          this._solveResolve = null;
        }
        break;
      }

      default:
        break;
    }
  }
}

/** Named export of the class for testing. */
export { SolverEngine };

/** Singleton solver engine shared across the app. */
export const solverEngine = new SolverEngine();
