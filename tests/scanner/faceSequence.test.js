/**
 * FaceSequence unit tests.
 * Covers: face order, confirm/advance, completion detection, reset,
 * pending result handling, jumpToFace.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FaceSequence, FACE_ORDER } from '../../src/scanner/faceSequence.js';

describe('FACE_ORDER', () => {
  it('contains exactly 6 faces', () => {
    expect(FACE_ORDER).toHaveLength(6);
  });

  it('has the correct scan order: F → R → B → L → U → D', () => {
    const labels = FACE_ORDER.map((f) => f.label);
    expect(labels).toEqual(['F', 'R', 'B', 'L', 'U', 'D']);
  });

  it('each face has label, name, icon, and instruction', () => {
    for (const face of FACE_ORDER) {
      expect(typeof face.label).toBe('string');
      expect(typeof face.name).toBe('string');
      expect(typeof face.icon).toBe('string');
      expect(typeof face.instruction).toBe('string');
    }
  });
});

describe('FaceSequence', () => {
  /** @type {FaceSequence} */
  let seq;

  beforeEach(() => {
    seq = new FaceSequence();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts at index 0 (Front face)', () => {
    expect(seq.getCurrentIndex()).toBe(0);
    expect(seq.getCurrentFace().label).toBe('F');
  });

  it('starts with no confirmed faces', () => {
    expect(seq.getProgress()).toBe(0);
    expect(seq.isComplete()).toBe(false);
  });

  it('getResults() returns array of 6 nulls initially', () => {
    const r = seq.getResults();
    expect(r).toHaveLength(6);
    expect(r.every((x) => x === null)).toBe(true);
  });

  // ── getCurrentFace() / getFace() ──────────────────────────────────────────

  it('getCurrentFace() includes the index property', () => {
    const f = seq.getCurrentFace();
    expect(f.index).toBe(0);
  });

  it('getFace() returns the correct descriptor for arbitrary indices', () => {
    expect(seq.getFace(0).label).toBe('F');
    expect(seq.getFace(4).label).toBe('U');
    expect(seq.getFace(5).label).toBe('D');
  });

  // ── confirmFace() ─────────────────────────────────────────────────────────

  it('confirmFace() stores colors and advances the index', () => {
    const colors = [
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
    ];
    seq.confirmFace(colors);
    expect(seq.getCurrentIndex()).toBe(1);
    expect(seq.getProgress()).toBe(1);
  });

  it('confirmFace() does not advance past the last face', () => {
    const colors = Array.from({ length: 3 }, () => ['white', 'white', 'white']);
    for (let i = 0; i < 6; i++) {
      seq.confirmFace(colors);
    }
    // After confirming 6th face, index stays at 5
    expect(seq.getCurrentIndex()).toBe(5);
    expect(seq.isComplete()).toBe(true);
  });

  it('confirmFace() stores a deep copy (mutating source does not affect stored result)', () => {
    const colors = [
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
    ];
    seq.confirmFace(colors);
    colors[0][0] = 'blue'; // mutate original
    const results = seq.getResults();
    expect(results[0][0][0]).toBe('red'); // stored copy unchanged
  });

  it('confirmFace() clears the pending result', () => {
    seq.setPendingResult({ success: true, colors: [], confidence: [], gridPoints: [], overallConfidence: 0.9, warnings: [] });
    seq.confirmFace([['red', 'red', 'red'], ['red', 'red', 'red'], ['red', 'red', 'red']]);
    expect(seq.getPendingResult()).toBeNull();
  });

  // ── isComplete() ──────────────────────────────────────────────────────────

  it('isComplete() returns false until all 6 faces confirmed', () => {
    const colors = Array.from({ length: 3 }, () => ['white', 'white', 'white']);
    for (let i = 0; i < 5; i++) {
      expect(seq.isComplete()).toBe(false);
      seq.confirmFace(colors);
    }
    expect(seq.isComplete()).toBe(false);
    seq.confirmFace(colors);
    expect(seq.isComplete()).toBe(true);
  });

  // ── getProgress() ─────────────────────────────────────────────────────────

  it('getProgress() increments as faces are confirmed', () => {
    const colors = Array.from({ length: 3 }, () => ['blue', 'blue', 'blue']);
    for (let i = 0; i < 6; i++) {
      expect(seq.getProgress()).toBe(i);
      seq.confirmFace(colors);
    }
    expect(seq.getProgress()).toBe(6);
  });

  // ── rescan() ──────────────────────────────────────────────────────────────

  it('rescan() clears the pending result without advancing the index', () => {
    seq.setPendingResult({ success: true, colors: [], confidence: [], gridPoints: [], overallConfidence: 0.9, warnings: [] });
    seq.rescan();
    expect(seq.getPendingResult()).toBeNull();
    expect(seq.getCurrentIndex()).toBe(0);
  });

  // ── updateCurrentFaceColors() ─────────────────────────────────────────────

  it('updateCurrentFaceColors() replaces the stored result for the current face', () => {
    const c1 = Array.from({ length: 3 }, () => ['red', 'red', 'red']);
    const c2 = Array.from({ length: 3 }, () => ['blue', 'blue', 'blue']);
    seq.confirmFace(c1); // confirms face 0, advances to face 1
    // Go back to face 0 via jumpToFace
    seq.jumpToFace(0);
    seq.updateCurrentFaceColors(c2);
    // Re-confirm to advance
    seq.confirmFace(c2);
    expect(seq.getResults()[0][0][0]).toBe('blue');
  });

  // ── pendingResult ─────────────────────────────────────────────────────────

  it('setPendingResult / getPendingResult round-trip', () => {
    const result = { success: true, colors: [], confidence: [], gridPoints: [], overallConfidence: 0.95, warnings: [] };
    seq.setPendingResult(result);
    expect(seq.getPendingResult()).toEqual(result);
  });

  // ── jumpToFace() ──────────────────────────────────────────────────────────

  it('jumpToFace() sets the current index and clears that face result', () => {
    const colors = Array.from({ length: 3 }, () => ['green', 'green', 'green']);
    seq.confirmFace(colors);
    seq.confirmFace(colors);
    // Now at index 2
    seq.jumpToFace(0);
    expect(seq.getCurrentIndex()).toBe(0);
    expect(seq.getResults()[0]).toBeNull();
    // Face 1 is still confirmed
    expect(seq.getResults()[1]).not.toBeNull();
  });

  it('jumpToFace() clears the pending result', () => {
    seq.setPendingResult({ success: true, colors: [], confidence: [], gridPoints: [], overallConfidence: 0.9, warnings: [] });
    seq.jumpToFace(0);
    expect(seq.getPendingResult()).toBeNull();
  });

  it('jumpToFace() ignores out-of-range indices', () => {
    seq.jumpToFace(-1);
    expect(seq.getCurrentIndex()).toBe(0);
    seq.jumpToFace(10);
    expect(seq.getCurrentIndex()).toBe(0);
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  it('reset() returns to initial state', () => {
    const colors = Array.from({ length: 3 }, () => ['white', 'white', 'white']);
    seq.confirmFace(colors);
    seq.confirmFace(colors);
    seq.reset();
    expect(seq.getCurrentIndex()).toBe(0);
    expect(seq.getProgress()).toBe(0);
    expect(seq.isComplete()).toBe(false);
    expect(seq.getPendingResult()).toBeNull();
    expect(seq.getResults().every((r) => r === null)).toBe(true);
  });

  // ── getResults() isolation ────────────────────────────────────────────────

  it('getResults() returns a deep copy — mutating result does not affect stored state', () => {
    const colors = [
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
    ];
    seq.confirmFace(colors);
    const results = seq.getResults();
    results[0][0][0] = 'blue'; // mutate returned copy
    // Original stored result must be unchanged
    expect(seq.getResults()[0][0][0]).toBe('red');
  });

  // ── Full 6-face happy path ─────────────────────────────────────────────────

  it('full 6-face scan results in all faces stored and complete', () => {
    const faceColors = ['red', 'orange', 'blue', 'green', 'white', 'yellow'];
    for (let i = 0; i < 6; i++) {
      const c = Array.from({ length: 3 }, () => new Array(3).fill(faceColors[i]));
      seq.confirmFace(c);
    }
    expect(seq.isComplete()).toBe(true);
    const results = seq.getResults();
    for (let i = 0; i < 6; i++) {
      expect(results[i]).not.toBeNull();
      expect(results[i][0][0]).toBe(faceColors[i]);
    }
  });
});
