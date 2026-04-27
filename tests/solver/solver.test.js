/**
 * Unit tests for src/solver/solver.js (SolverEngine)
 * Tests the message-passing protocol using a mocked Worker.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────────
// Mock Worker so we don't spawn a real Web Worker in the test environment
// ──────────────────────────────────────────────────────────────────────────────

class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this._messageQueue = [];
  }

  postMessage(msg) {
    this._messageQueue.push(msg);
  }

  /** Simulate the worker sending a message back to the main thread. */
  _send(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  close() {}
}

vi.stubGlobal('Worker', MockWorker);

// Import AFTER stubbing Worker so SolverEngine picks up MockWorker
const { SolverEngine } = await import('../../src/solver/solver.js');

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('SolverEngine', () => {
  let engine;
  /** @type {MockWorker} */
  let worker;

  beforeEach(() => {
    engine = new SolverEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('is not ready before init()', () => {
    expect(engine.isReady()).toBe(false);
  });

  it('init() sends INIT message to the worker', () => {
    engine.init();
    worker = engine._worker;
    expect(worker._messageQueue).toContainEqual({ type: 'INIT' });
  });

  it('init() returns a Promise', () => {
    const p = engine.init();
    expect(p).toBeInstanceOf(Promise);
    engine._worker._send({ type: 'INIT_COMPLETE' });
    return p;
  });

  it('init() resolves when INIT_COMPLETE is received', async () => {
    const p = engine.init();
    engine._worker._send({ type: 'INIT_COMPLETE' });
    await p;
    expect(engine.isReady()).toBe(true);
  });

  it('calling init() twice returns the same Promise', () => {
    const p1 = engine.init();
    const p2 = engine.init();
    expect(p1).toBe(p2);
  });

  it('init() rejects when ERROR is received', async () => {
    const p = engine.init();
    engine._worker._send({
      type: 'ERROR',
      payload: { code: 'SOL_INIT_FAILED', message: 'Worker failed to load cubejs' },
    });
    await expect(p).rejects.toThrow('Worker failed to load cubejs');
  });

  it('solve() sends SOLVE message after init completes', async () => {
    const initP = engine.init();
    engine._worker._send({ type: 'INIT_COMPLETE' });
    await initP;

    const STATE = 'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';
    const solveP = engine.solve(STATE);

    // solve() is async and awaits _initPromise internally; flush the microtask queue
    await Promise.resolve();
    await Promise.resolve();

    const sentMessages = engine._worker._messageQueue;
    const solveMsg = sentMessages.find((m) => m.type === 'SOLVE');
    expect(solveMsg).toBeDefined();
    expect(solveMsg.payload.state).toHaveLength(54);

    // Resolve the pending promise so it doesn't leak
    engine._worker._send({
      type: 'SOLVE_RESULT',
      payload: {
        moves: [],
        moveCount: 0,
        solveTimeMs: 10,
        notation: '',
        stats: { optimalMax: 20, efficiency: 0 },
      },
    });

    const result = await solveP;
    expect(result.moveCount).toBe(0);
  });

  it('solve() rejects when ERROR is received during solving', async () => {
    const initP = engine.init();
    engine._worker._send({ type: 'INIT_COMPLETE' });
    await initP;

    const STATE = 'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';
    const solveP = engine.solve(STATE);

    // Yield so solve() advances past `await this._initPromise` and registers _solveReject
    await Promise.resolve();
    await Promise.resolve();

    engine._worker._send({
      type: 'ERROR',
      payload: { code: 'SOL_UNSOLVABLE', message: 'Parity error' },
    });

    await expect(solveP).rejects.toThrow('Parity error');
  });

  it('dispose() clears internal state', () => {
    engine.init();
    engine._worker._send({ type: 'INIT_COMPLETE' });
    engine.dispose();
    expect(engine._worker).toBeNull();
    expect(engine._ready).toBe(false);
    expect(engine._initPromise).toBeNull();
  });
});
