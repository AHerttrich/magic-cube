/**
 * Unit tests for src/solver/validator.js
 * Covers: validateColors, buildStateString
 */
import { describe, it, expect } from 'vitest';
import { validateColors, buildStateString } from '../../src/solver/validator.js';

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────────

/** Create a uniform 3×3 face of one color. */
function face(color) {
  return Array.from({ length: 3 }, () => Array(3).fill(color));
}

/**
 * Create 6 faces for a solved cube in scan order (F,R,B,L,U,D).
 * Uses color names that map to face labels:
 *   green→F, red→R, blue→B, orange→L, white→U, yellow→D
 */
function solvedFaces() {
  return [
    face('green'),   // F (scan index 0)
    face('red'),     // R (scan index 1)
    face('blue'),    // B (scan index 2)
    face('orange'),  // L (scan index 3)
    face('white'),   // U (scan index 4)
    face('yellow'),  // D (scan index 5)
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// validateColors
// ──────────────────────────────────────────────────────────────────────────────

describe('validateColors', () => {
  it('accepts a valid solved cube', () => {
    const result = validateColors(solvedFaces());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects when fewer than 54 tiles are provided', () => {
    const faces = solvedFaces();
    faces[0] = face('green').slice(0, 2); // only 2 rows
    const result = validateColors(faces);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'COLOR_COUNT')).toBe(true);
  });

  it('rejects when a color appears more than 9 times', () => {
    const faces = solvedFaces();
    // Replace one white tile on F-face with an extra 'white'
    faces[0][0][0] = 'white'; // F now has 1 extra white, missing 1 green
    const result = validateColors(faces);
    expect(result.valid).toBe(false);
    const types = result.errors.map(e => e.type);
    expect(types).toContain('COLOR_COUNT');
  });

  it('rejects when a color appears fewer than 9 times', () => {
    const faces = solvedFaces();
    // Replace center of R-face (red) with 'green' → green=10, red=8
    faces[1][1][1] = 'green';
    const result = validateColors(faces);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'COLOR_COUNT')).toBe(true);
  });

  it('rejects when two face centers share the same color', () => {
    const faces = solvedFaces();
    // Make F-center and R-center both 'red'
    faces[0][1][1] = 'red';
    const result = validateColors(faces);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'CENTER_UNIQUE')).toBe(true);
  });

  it('returns multiple errors when both COLOR_COUNT and CENTER_UNIQUE are violated', () => {
    const faces = solvedFaces();
    // Set all F tiles to 'red' → F-center = 'red' (dup of R), and red count = 18
    faces[0] = face('red');
    const result = validateColors(faces);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects when only 5 distinct colors are present', () => {
    const faces = solvedFaces();
    // Replace all blue (B face) with green
    faces[2] = face('green');
    const result = validateColors(faces);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'COLOR_COUNT')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// buildStateString
// ──────────────────────────────────────────────────────────────────────────────

describe('buildStateString', () => {
  it('returns a 54-character string', () => {
    const state = buildStateString(solvedFaces());
    expect(state).toHaveLength(54);
  });

  it('produces UUUUU…RRRRR…FFFFF…DDDDD…LLLLL…BBBBB for a solved cube', () => {
    const state = buildStateString(solvedFaces());
    const expected =
      'U'.repeat(9) +
      'R'.repeat(9) +
      'F'.repeat(9) +
      'D'.repeat(9) +
      'L'.repeat(9) +
      'B'.repeat(9);
    expect(state).toBe(expected);
  });

  it('only uses the characters U R F D L B', () => {
    const state = buildStateString(solvedFaces());
    expect(/^[URFDLB]{54}$/.test(state)).toBe(true);
  });

  it('maps center colors to their face labels', () => {
    const state = buildStateString(solvedFaces());
    // Center of each face is at Kociemba indices 4, 13, 22, 31, 40, 49
    expect(state[4]).toBe('U');  // U center
    expect(state[13]).toBe('R'); // R center
    expect(state[22]).toBe('F'); // F center
    expect(state[31]).toBe('D'); // D center
    expect(state[40]).toBe('L'); // L center
    expect(state[49]).toBe('B'); // B center
  });

  it('handles a face where one tile differs from the center', () => {
    const faces = solvedFaces();
    // Place one 'red' tile at F[0][0] (top-left of front face)
    faces[0][0][0] = 'red';

    const state = buildStateString(faces);
    // Position 18 (F0 = first tile of the F section in Kociemba) should be 'R'
    expect(state[18]).toBe('R');
    // All other F-face tiles should still be 'F'
    expect(state[19]).toBe('F');
    expect(state[22]).toBe('F'); // F center unchanged
  });

  it('throws if a tile color is not represented by any center', () => {
    const faces = solvedFaces();
    // Add a completely unknown color to a tile
    faces[0][0][0] = 'purple';
    expect(() => buildStateString(faces)).toThrow(/Unknown color/);
  });

  it('places U-face tiles first in the output', () => {
    const faces = solvedFaces();
    // U face is scan index 4 (all 'white' → 'U')
    const state = buildStateString(faces);
    expect(state.slice(0, 9)).toBe('UUUUUUUUU');
  });

  it('places B-face tiles last in the output', () => {
    const faces = solvedFaces();
    // B face is scan index 2 (all 'blue' → 'B')
    const state = buildStateString(faces);
    expect(state.slice(45, 54)).toBe('BBBBBBBBB');
  });
});
