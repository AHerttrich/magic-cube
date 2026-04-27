/**
 * Schemas unit tests.
 * Covers: valid and invalid inputs for all exported validators.
 */
import { describe, it, expect } from 'vitest';
import {
  validateCalibrationProfile,
  validateDetectionResult,
  validateCubeState,
  validateSolution,
  validateLightingAssessment,
  validateValidationResult,
  validateOverlayConfig,
} from '../../src/core/schemas.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Asserts a validation result is valid. */
function expectValid(result) {
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
}

/** Asserts a validation result is invalid with at least one error. */
function expectInvalid(result) {
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
}

/** Asserts error messages include a particular substring. */
function expectError(result, substring) {
  expectInvalid(result);
  const hasMatch = result.errors.some(e => e.toLowerCase().includes(substring.toLowerCase()));
  expect(hasMatch, `Expected error containing "${substring}", got: ${result.errors.join(', ')}`).toBe(true);
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const validCalibrationProfile = {
  version: 1,
  timestamp: '2026-04-26T20:00:00Z',
  illuminant: { L: 95.2, a: -1.3, b: 2.8 },
  references: {
    white: { L: 95.0, a: 0.0, b: 0.0 },
    yellow: { L: 90.0, a: -5.0, b: 85.0 },
    red: { L: 45.0, a: 60.0, b: 35.0 },
    orange: { L: 65.0, a: 40.0, b: 65.0 },
    blue: { L: 30.0, a: 15.0, b: -55.0 },
    green: { L: 50.0, a: -45.0, b: 30.0 },
  },
  thresholds: { maxDelta: 25.0, ambiguityGap: 5.0 },
};

const validDetectionResult = {
  success: true,
  colors: [
    ['white', 'red', 'blue'],
    ['green', 'yellow', 'orange'],
    ['red', 'white', 'green'],
  ],
  confidence: [
    [0.9, 0.8, 0.95],
    [0.7, 0.85, 0.9],
    [0.88, 0.92, 0.78],
  ],
  gridPoints: [],
  overallConfidence: 0.86,
  warnings: [],
};

const validSolvedState = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const validSolution = {
  moves: ['R', "U", "R'", "U'"],
  moveCount: 4,
  solveTimeMs: 120,
  notation: "R U R' U'",
  stats: { optimalMax: 20, efficiency: 80 },
};

const validLightingAssessment = {
  quality: 'good',
  brightness: 130,
  contrast: 45,
  colorCast: 5,
  recommendation: 'Lighting is good',
};

const validValidationResult = {
  valid: true,
  errors: [],
  warnings: [],
};

const validOverlayConfig = {
  shape: 'grid',
  rows: 3,
  cols: 3,
};

// ── CalibrationProfile ─────────────────────────────────────────────────────

describe('validateCalibrationProfile', () => {
  it('accepts a valid calibration profile', () => {
    expectValid(validateCalibrationProfile(validCalibrationProfile));
  });

  it('rejects null', () => {
    expectInvalid(validateCalibrationProfile(null));
  });

  it('rejects wrong version', () => {
    expectError(validateCalibrationProfile({ ...validCalibrationProfile, version: 2 }), 'version');
  });

  it('rejects missing timestamp', () => {
    const bad = { ...validCalibrationProfile, timestamp: 123 };
    expectError(validateCalibrationProfile(bad), 'timestamp');
  });

  it('rejects invalid illuminant (missing b)', () => {
    const bad = {
      ...validCalibrationProfile,
      illuminant: { L: 95.2, a: -1.3 },
    };
    expectError(validateCalibrationProfile(bad), 'illuminant.b');
  });

  it('rejects missing reference color', () => {
    const { green: _g, ...refs } = validCalibrationProfile.references;
    const bad = { ...validCalibrationProfile, references: refs };
    expectError(validateCalibrationProfile(bad), 'green');
  });

  it('rejects non-numeric threshold', () => {
    const bad = {
      ...validCalibrationProfile,
      thresholds: { maxDelta: 'high', ambiguityGap: 5 },
    };
    expectError(validateCalibrationProfile(bad), 'maxdelta');
  });
});

// ── DetectionResult ────────────────────────────────────────────────────────

describe('validateDetectionResult', () => {
  it('accepts a valid detection result', () => {
    expectValid(validateDetectionResult(validDetectionResult));
  });

  it('rejects non-object', () => {
    expectInvalid(validateDetectionResult('not an object'));
  });

  it('rejects non-boolean success', () => {
    expectError(validateDetectionResult({ ...validDetectionResult, success: 1 }), 'success');
  });

  it('rejects colors that is not an array', () => {
    expectError(validateDetectionResult({ ...validDetectionResult, colors: 'bad' }), 'colors');
  });

  it('rejects non-number overallConfidence', () => {
    expectError(
      validateDetectionResult({ ...validDetectionResult, overallConfidence: 'high' }),
      'overallconfidence'
    );
  });

  it('rejects missing warnings array', () => {
    const { warnings: _w, ...rest } = validDetectionResult;
    expectError(validateDetectionResult(rest), 'warnings');
  });
});

// ── CubeState ──────────────────────────────────────────────────────────────

describe('validateCubeState', () => {
  it('accepts a valid 54-char solved state', () => {
    expectValid(validateCubeState(validSolvedState));
  });

  it('accepts a valid scrambled-ish state with correct character counts', () => {
    // 9 each of U, R, F, D, L, B = 54 chars
    const state = 'URFDLBURFDLBURFDLBURFDLBURFDLBURFDLBURFDLBURFDLBURFDLB';
    expectValid(validateCubeState(state));
  });

  it('rejects a non-string', () => {
    expectError(validateCubeState(123), 'string');
  });

  it('rejects a string shorter than 54 chars', () => {
    expectError(validateCubeState('UUUUUU'), '54');
  });

  it('rejects a string longer than 54 chars', () => {
    expectError(validateCubeState(validSolvedState + 'U'), '54');
  });

  it('rejects invalid characters', () => {
    const bad = validSolvedState.slice(0, 53) + 'X';
    expectError(validateCubeState(bad), 'invalid characters');
  });

  it('rejects lowercase characters', () => {
    const bad = validSolvedState.toLowerCase();
    expectError(validateCubeState(bad), 'invalid characters');
  });
});

// ── Solution ───────────────────────────────────────────────────────────────

describe('validateSolution', () => {
  it('accepts a valid solution', () => {
    expectValid(validateSolution(validSolution));
  });

  it('rejects non-object', () => {
    expectInvalid(validateSolution(null));
  });

  it('rejects non-array moves', () => {
    expectError(validateSolution({ ...validSolution, moves: 'R U R' }), 'moves');
  });

  it('rejects non-number moveCount', () => {
    expectError(validateSolution({ ...validSolution, moveCount: '4' }), 'movecount');
  });

  it('rejects non-string notation', () => {
    expectError(validateSolution({ ...validSolution, notation: 123 }), 'notation');
  });

  it('rejects missing stats', () => {
    const { stats: _s, ...rest } = validSolution;
    expectError(validateSolution(rest), 'stats');
  });
});

// ── LightingAssessment ─────────────────────────────────────────────────────

describe('validateLightingAssessment', () => {
  it('accepts good/acceptable/poor quality values', () => {
    for (const quality of ['good', 'acceptable', 'poor']) {
      expectValid(validateLightingAssessment({ ...validLightingAssessment, quality }));
    }
  });

  it('rejects an invalid quality value', () => {
    expectError(
      validateLightingAssessment({ ...validLightingAssessment, quality: 'excellent' }),
      'quality'
    );
  });

  it('rejects non-number brightness', () => {
    expectError(
      validateLightingAssessment({ ...validLightingAssessment, brightness: null }),
      'brightness'
    );
  });
});

// ── ValidationResult ───────────────────────────────────────────────────────

describe('validateValidationResult', () => {
  it('accepts a valid result object', () => {
    expectValid(validateValidationResult(validValidationResult));
  });

  it('accepts a result with errors array', () => {
    expectValid(
      validateValidationResult({
        valid: false,
        errors: [{ type: 'COLOR_COUNT', message: 'oops' }],
        warnings: [],
      })
    );
  });

  it('rejects non-boolean valid field', () => {
    expectError(validateValidationResult({ ...validValidationResult, valid: 'yes' }), 'valid');
  });

  it('rejects non-array errors', () => {
    expectError(
      validateValidationResult({ ...validValidationResult, errors: 'none' }),
      'errors'
    );
  });
});

// ── OverlayConfig ──────────────────────────────────────────────────────────

describe('validateOverlayConfig', () => {
  it('accepts a valid grid config', () => {
    expectValid(validateOverlayConfig(validOverlayConfig));
  });

  it('accepts all valid shape values', () => {
    for (const shape of ['grid', 'triangles', 'pentagons']) {
      expectValid(validateOverlayConfig({ ...validOverlayConfig, shape }));
    }
  });

  it('rejects an invalid shape', () => {
    expectError(validateOverlayConfig({ ...validOverlayConfig, shape: 'hexagons' }), 'shape');
  });

  it('rejects non-number rows', () => {
    expectError(validateOverlayConfig({ ...validOverlayConfig, rows: '3' }), 'rows');
  });
});

// ── LAB sub-validation ─────────────────────────────────────────────────────

describe('LAB validation (via CalibrationProfile.illuminant)', () => {
  it('rejects NaN in a LAB field', () => {
    const bad = { ...validCalibrationProfile, illuminant: { L: NaN, a: 0, b: 0 } };
    expectError(validateCalibrationProfile(bad), 'illuminant.l');
  });

  it('rejects Infinity in a LAB field', () => {
    const bad = { ...validCalibrationProfile, illuminant: { L: Infinity, a: 0, b: 0 } };
    expectError(validateCalibrationProfile(bad), 'illuminant.l');
  });

  it('accepts 0 as a valid LAB value', () => {
    const profile = {
      ...validCalibrationProfile,
      illuminant: { L: 0, a: 0, b: 0 },
    };
    expectValid(validateCalibrationProfile(profile));
  });
});

