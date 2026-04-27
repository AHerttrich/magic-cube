/**
 * Schemas — centralized runtime validation for all cross-module data shapes.
 * Pattern from ARCH §7.2. No external validation library.
 * All data entering/leaving Web Workers is validated here.
 */

/**
 * @typedef {{ valid: boolean, errors: string[] }} ValidationResult
 */

/**
 * Creates a ValidationResult.
 * @param {string[]} errors
 * @returns {ValidationResult}
 */
function result(errors) {
  return { valid: errors.length === 0, errors };
}

/** @param {*} val @param {string} name @returns {string|null} */
function requireNumber(val, name) {
  return typeof val !== 'number' || !isFinite(val) ? `${name} must be a finite number` : null;
}

/** @param {*} val @param {string} name @returns {string|null} */
function requireString(val, name) {
  return typeof val !== 'string' ? `${name} must be a string` : null;
}

/** @param {*} val @param {string} name @returns {string|null} */
function requireBoolean(val, name) {
  return typeof val !== 'boolean' ? `${name} must be a boolean` : null;
}

/** @param {*} val @param {string} name @returns {string|null} */
function requireArray(val, name) {
  return !Array.isArray(val) ? `${name} must be an array` : null;
}

/** @param {*} val @param {string} name @returns {string|null} */
function requireObject(val, name) {
  return val === null || typeof val !== 'object' || Array.isArray(val)
    ? `${name} must be an object`
    : null;
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a LAB color object { L, a, b }.
 * @param {*} val
 * @param {string} name
 * @returns {string[]} errors
 */
function validateLAB(val, name) {
  const err = requireObject(val, name);
  if (err) { return [err]; }
  return [
    requireNumber(val.L, `${name}.L`),
    requireNumber(val.a, `${name}.a`),
    requireNumber(val.b, `${name}.b`),
  ].filter(Boolean);
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a CalibrationProfile object.
 * Schema from ARCH §4.2 calibration data flow.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateCalibrationProfile(data) {
  const errors = [];

  const objErr = requireObject(data, 'CalibrationProfile');
  if (objErr) { return result([objErr]); }

  if (data.version !== 1) {
    errors.push('CalibrationProfile.version must be 1');
  }
  const tsErr = requireString(data.timestamp, 'CalibrationProfile.timestamp');
  if (tsErr) { errors.push(tsErr); }

  errors.push(...validateLAB(data.illuminant, 'CalibrationProfile.illuminant'));

  const refsErr = requireObject(data.references, 'CalibrationProfile.references');
  if (refsErr) {
    errors.push(refsErr);
  } else {
    for (const color of ['white', 'yellow', 'red', 'orange', 'blue', 'green']) {
      errors.push(...validateLAB(data.references[color], `CalibrationProfile.references.${color}`));
    }
  }

  const thrErr = requireObject(data.thresholds, 'CalibrationProfile.thresholds');
  if (thrErr) {
    errors.push(thrErr);
  } else {
    const md = requireNumber(data.thresholds.maxDelta, 'CalibrationProfile.thresholds.maxDelta');
    const ag = requireNumber(data.thresholds.ambiguityGap, 'CalibrationProfile.thresholds.ambiguityGap');
    if (md) { errors.push(md); }
    if (ag) { errors.push(ag); }
  }

  return result(errors);
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a DetectionResult object.
 * Schema from SPEC §1.3.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateDetectionResult(data) {
  const errors = [];

  const objErr = requireObject(data, 'DetectionResult');
  if (objErr) { return result([objErr]); }

  const boolErr = requireBoolean(data.success, 'DetectionResult.success');
  if (boolErr) { errors.push(boolErr); }

  const colorsErr = requireArray(data.colors, 'DetectionResult.colors');
  if (colorsErr) {
    errors.push(colorsErr);
  } else {
    if (!data.colors.every(Array.isArray)) {
      errors.push('DetectionResult.colors must be a 2D array');
    }
  }

  const confErr = requireArray(data.confidence, 'DetectionResult.confidence');
  if (confErr) { errors.push(confErr); }

  const ocErr = requireNumber(data.overallConfidence, 'DetectionResult.overallConfidence');
  if (ocErr) { errors.push(ocErr); }

  if (!Array.isArray(data.warnings)) {
    errors.push('DetectionResult.warnings must be an array');
  }

  return result(errors);
}

// ──────────────────────────────────────────────────────────────────────────────

/** Valid face characters in Kociemba notation. */
const VALID_FACE_CHARS = new Set(['U', 'R', 'F', 'D', 'L', 'B']);

/**
 * Validates a CubeState — a 54-character Kociemba notation string.
 * Checks format only; deep piece validity is handled by the Validator plugin.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateCubeState(data) {
  const errors = [];

  const strErr = requireString(data, 'CubeState');
  if (strErr) { return result([strErr]); }

  if (data.length !== 54) {
    errors.push(`CubeState must be exactly 54 characters, got ${data.length}`);
  }

  const invalidChars = [...data].filter(c => !VALID_FACE_CHARS.has(c));
  if (invalidChars.length > 0) {
    errors.push(`CubeState contains invalid characters: ${[...new Set(invalidChars)].join(', ')}`);
  }

  return result(errors);
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a Solution object.
 * Schema from SPEC §1.4.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateSolution(data) {
  const errors = [];

  const objErr = requireObject(data, 'Solution');
  if (objErr) { return result([objErr]); }

  const movesErr = requireArray(data.moves, 'Solution.moves');
  if (movesErr) { errors.push(movesErr); }

  const mcErr = requireNumber(data.moveCount, 'Solution.moveCount');
  if (mcErr) { errors.push(mcErr); }

  const tmErr = requireNumber(data.solveTimeMs, 'Solution.solveTimeMs');
  if (tmErr) { errors.push(tmErr); }

  const notErr = requireString(data.notation, 'Solution.notation');
  if (notErr) { errors.push(notErr); }

  const statsErr = requireObject(data.stats, 'Solution.stats');
  if (statsErr) {
    errors.push(statsErr);
  } else {
    const omErr = requireNumber(data.stats.optimalMax, 'Solution.stats.optimalMax');
    const effErr = requireNumber(data.stats.efficiency, 'Solution.stats.efficiency');
    if (omErr) { errors.push(omErr); }
    if (effErr) { errors.push(effErr); }
  }

  return result(errors);
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a LightingAssessment object.
 * Schema from SPEC §4.4.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateLightingAssessment(data) {
  const errors = [];

  const objErr = requireObject(data, 'LightingAssessment');
  if (objErr) { return result([objErr]); }

  const validQualities = ['good', 'acceptable', 'poor'];
  if (!validQualities.includes(data.quality)) {
    errors.push(`LightingAssessment.quality must be one of: ${validQualities.join(', ')}`);
  }

  const bErr = requireNumber(data.brightness, 'LightingAssessment.brightness');
  if (bErr) { errors.push(bErr); }

  const cErr = requireNumber(data.contrast, 'LightingAssessment.contrast');
  if (cErr) { errors.push(cErr); }

  const ccErr = requireNumber(data.colorCast, 'LightingAssessment.colorCast');
  if (ccErr) { errors.push(ccErr); }

  const recErr = requireString(data.recommendation, 'LightingAssessment.recommendation');
  if (recErr) { errors.push(recErr); }

  return result(errors);
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a ValidationResult object (used by plugins).
 * Schema from SPEC §1.6.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateValidationResult(data) {
  const errors = [];

  const objErr = requireObject(data, 'ValidationResult');
  if (objErr) { return result([objErr]); }

  const validErr = requireBoolean(data.valid, 'ValidationResult.valid');
  if (validErr) { errors.push(validErr); }

  const errsErr = requireArray(data.errors, 'ValidationResult.errors');
  if (errsErr) { errors.push(errsErr); }

  const warnsErr = requireArray(data.warnings, 'ValidationResult.warnings');
  if (warnsErr) { errors.push(warnsErr); }

  return result(errors);
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates an OverlayConfig object.
 * Schema from SPEC §1.3.
 *
 * @param {*} data
 * @returns {ValidationResult}
 */
export function validateOverlayConfig(data) {
  const errors = [];

  const objErr = requireObject(data, 'OverlayConfig');
  if (objErr) { return result([objErr]); }

  const validShapes = ['grid', 'triangles', 'pentagons'];
  if (!validShapes.includes(data.shape)) {
    errors.push(`OverlayConfig.shape must be one of: ${validShapes.join(', ')}`);
  }

  const rErr = requireNumber(data.rows, 'OverlayConfig.rows');
  if (rErr) { errors.push(rErr); }

  const cErr = requireNumber(data.cols, 'OverlayConfig.cols');
  if (cErr) { errors.push(cErr); }

  return result(errors);
}
