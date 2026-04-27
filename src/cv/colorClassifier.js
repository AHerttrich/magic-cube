/**
 * Color Classifier — CIEDE2000-based color matching engine.
 * Decision matrix from SPEC §2.5.
 */

import { ciede2000 } from './ciede2000.js';

/**
 * @typedef {Object} ClassifiedColor
 * @property {string} name         - Matched color name (e.g. 'red')
 * @property {number} delta        - Best ΔE₀₀ distance
 * @property {number} gap          - Gap to second-best match
 * @property {'confident'|'uncertain'|'ambiguous'|'failed'} confidence
 * @property {string[]} candidates - Top-2 color names when ambiguous
 */

/**
 * @typedef {Object} ColorReference
 * @property {string} name
 * @property {{ L: number, a: number, b: number }} lab
 */

/**
 * @typedef {Object} ClassificationThresholds
 * @property {number} maxDelta      - ΔE above which match is failed (default 25)
 * @property {number} ambiguityDelta - ΔE above which match is ambiguous (default 15)
 * @property {number} gapThreshold  - Min gap for confident vs uncertain (default 8)
 */

/** @type {ClassificationThresholds} */
const DEFAULT_THRESHOLDS = {
  maxDelta: 25,
  ambiguityDelta: 15,
  gapThreshold: 8,
};

/**
 * Classify a single LAB color against a set of reference colors.
 *
 * Decision matrix (SPEC §2.5):
 *   - Confident:  ΔE_best < 15 AND gap > 8   → auto-assign
 *   - Uncertain:  ΔE_best < 15 AND gap ≤ 8   → auto-assign with flag
 *   - Ambiguous:  ΔE_best 15–25              → show top-2 choices
 *   - Failed:     ΔE_best > 25               → no assignment
 *
 * @param {{ L: number, a: number, b: number }} labColor - Color to classify
 * @param {ColorReference[]} references - Reference colors to match against
 * @param {ClassificationThresholds} [thresholds]
 * @returns {ClassifiedColor}
 */
export function classifyColor(labColor, references, thresholds = DEFAULT_THRESHOLDS) {
  const thr = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Compute ΔE to all references, sort ascending
  const ranked = references
    .map(ref => ({ name: ref.name, delta: ciede2000(labColor, ref.lab) }))
    .sort((a, b) => a.delta - b.delta);

  if (ranked.length === 0) {
    return { name: '', delta: Infinity, gap: 0, confidence: 'failed', candidates: [] };
  }

  const best = ranked[0];
  const second = ranked[1];
  const gap = second ? second.delta - best.delta : Infinity;

  /** @type {ClassifiedColor['confidence']} */
  let confidence;
  if (best.delta > thr.maxDelta) {
    confidence = 'failed';
  } else if (best.delta > thr.ambiguityDelta) {
    confidence = 'ambiguous';
  } else if (gap > thr.gapThreshold) {
    confidence = 'confident';
  } else {
    confidence = 'uncertain';
  }

  const candidates = confidence === 'ambiguous' && second
    ? [best.name, second.name]
    : [best.name];

  return {
    name: confidence === 'failed' ? '' : best.name,
    delta: best.delta,
    gap,
    confidence,
    candidates,
  };
}

/**
 * Classify an NxN grid of LAB colors.
 *
 * @param {{ L: number, a: number, b: number }[][]} labGrid - NxN array of LAB colors
 * @param {ColorReference[]} references
 * @param {ClassificationThresholds} [thresholds]
 * @returns {{ colors: string[][], confidence: number[][], warnings: string[], classified: ClassifiedColor[][] }}
 */
export function classifyColors(labGrid, references, thresholds = DEFAULT_THRESHOLDS) {
  const colors = [];
  const confidence = [];
  const classified = [];
  const warnings = [];
  let ambiguousCount = 0;
  let failedCount = 0;

  for (const row of labGrid) {
    const colorRow = [];
    const confRow = [];
    const classRow = [];

    for (const lab of row) {
      const result = classifyColor(lab, references, thresholds);
      classRow.push(result);
      colorRow.push(result.name);

      let confScore;
      switch (result.confidence) {
        case 'confident':  confScore = 1.0; break;
        case 'uncertain':  confScore = 0.6; break;
        case 'ambiguous':  confScore = 0.3; ambiguousCount++; break;
        case 'failed':     confScore = 0.0; failedCount++;    break;
        default:           confScore = 0.0;
      }
      confRow.push(confScore);
    }

    colors.push(colorRow);
    confidence.push(confRow);
    classified.push(classRow);
  }

  if (ambiguousCount > 0) {
    warnings.push(`${ambiguousCount} tile(s) have ambiguous color — tap to select manually`);
  }
  if (failedCount > 0) {
    warnings.push(`${failedCount} tile(s) could not be classified — try recalibrating`);
  }

  const allScores = confidence.flat();
  const overallConfidence = allScores.reduce((s, v) => s + v, 0) / allScores.length;

  return { colors, confidence, classified, warnings, overallConfidence };
}
