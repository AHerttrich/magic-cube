/**
 * Validator — cube state builder and validation logic.
 * Transforms 6 scanned face grids into a 54-char Kociemba string
 * and validates the resulting state for solvability.
 *
 * Scan order:  F(0) → R(1) → B(2) → L(3) → U(4) → D(5)
 * Kociemba:   U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
 */

/**
 * @typedef {Object} ValidationError
 * @property {'COLOR_COUNT'|'CENTER_UNIQUE'|'INVALID_PIECE'|'PARITY'} type
 * @property {string} message
 * @property {string} [affectedFace]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {ValidationError[]} errors
 */

/**
 * Validate that 6 scanned face grids form a potentially valid cube state.
 * Checks COLOR_COUNT and CENTER_UNIQUE; deep piece/parity checks are
 * deferred to cubejs.fromString() during the solve step.
 *
 * @param {string[][][]} faces - 6 × 3×3 color grids in scan order (F,R,B,L,U,D)
 * @returns {ValidationResult}
 */
export function validateColors(faces) {
  const errors = [];

  // Flatten all 54 tiles to count colors
  const flat = faces.flatMap((face) => face.flatMap((row) => row));

  if (flat.length !== 54) {
    errors.push({
      type: 'COLOR_COUNT',
      message: `Expected 54 tiles, found ${flat.length}. Make sure all 6 faces are scanned.`,
    });
    return { valid: false, errors };
  }

  // Rule 1: COLOR_COUNT — each color must appear exactly 9 times
  /** @type {Record<string, number>} */
  const counts = {};
  for (const color of flat) {
    counts[color] = (counts[color] || 0) + 1;
  }

  const colorNames = Object.keys(counts);
  if (colorNames.length !== 6) {
    errors.push({
      type: 'COLOR_COUNT',
      message: `Expected 6 distinct colors, found ${colorNames.length}. Check for undetected tiles.`,
    });
  }

  for (const [color, count] of Object.entries(counts)) {
    if (count !== 9) {
      errors.push({
        type: 'COLOR_COUNT',
        message: `Color "${color}" appears ${count} times (expected 9). Rescan the affected face.`,
      });
    }
  }

  // Rule 2: CENTER_UNIQUE — each face center must be a different color
  // Face centers in scan order: faces[i][1][1]
  const centers = faces.map((face) => face[1][1]);
  const uniqueCenters = new Set(centers);
  if (uniqueCenters.size !== 6) {
    errors.push({
      type: 'CENTER_UNIQUE',
      message: 'Two or more face centers share the same color. Each face must have a unique center.',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build a 54-character Kociemba state string from 6 scanned face grids.
 *
 * The center of each scanned face defines the color→face-label mapping.
 * Output order: U R F D L B (each face row-by-row, left-to-right).
 *
 * @param {string[][][]} faces - 6 × 3×3 color grids in scan order (F,R,B,L,U,D)
 * @returns {string} 54-char string using face labels U,R,F,D,L,B
 * @throws {Error} If a tile color is not recognized (unmapped center)
 */
export function buildStateString(faces) {
  // Map each center color to its Kociemba face label
  // Scan order: F=0, R=1, B=2, L=3, U=4, D=5
  const SCAN_TO_LABEL = ['F', 'R', 'B', 'L', 'U', 'D'];
  /** @type {Record<string, string>} */
  const colorToLabel = {};
  for (let i = 0; i < 6; i++) {
    const centerColor = faces[i][1][1];
    colorToLabel[centerColor] = SCAN_TO_LABEL[i];
  }

  // Kociemba state order: U, R, F, D, L, B
  // Mapped from scan indices:  U=4, R=1, F=0, D=5, L=3, B=2
  const kociembaOrder = [4, 1, 0, 5, 3, 2];
  let state = '';

  for (const faceIdx of kociembaOrder) {
    const face = faces[faceIdx];
    for (const row of face) {
      for (const color of row) {
        const label = colorToLabel[color];
        if (!label) {
          throw new Error(
            `[validator] Unknown color "${color}" — no center tile has this color.`
          );
        }
        state += label;
      }
    }
  }

  return state;
}
