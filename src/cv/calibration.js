/**
 * Calibration Engine — manages color reference profiles for CIEDE2000 matching.
 * Implements SPEC §4 (calibration flow, default references, adaptive white balance).
 */

import { ciede2000 } from './ciede2000.js';

/** Storage key for persisting calibration profiles. */
const STORAGE_KEY = 'magic-cube:calibration-profile';

/**
 * Default reference colors from SPEC §4.2 (D65 illuminant LAB values).
 * @type {Record<string, { L: number, a: number, b: number }>}
 */
export const DEFAULT_REFERENCES = {
  white:  { L: 95.0, a:   0.0, b:   0.0 },
  yellow: { L: 90.0, a:  -5.0, b:  85.0 },
  red:    { L: 45.0, a:  60.0, b:  35.0 },
  orange: { L: 65.0, a:  40.0, b:  65.0 },
  blue:   { L: 30.0, a:  15.0, b: -55.0 },
  green:  { L: 50.0, a: -45.0, b:  30.0 },
};

/**
 * Lighting quality thresholds from SPEC §4.4.
 */
const LIGHTING_THRESHOLDS = {
  brightness: { min: 60, max: 220 },
  contrast:   { min: 20 },
  colorCast:  { max: 15 },
};

/**
 * @typedef {Object} CalibrationProfile
 * @property {number} version
 * @property {string} timestamp
 * @property {{ L: number, a: number, b: number }} illuminant
 * @property {Record<string, { L: number, a: number, b: number }>} references
 * @property {{ maxDelta: number, ambiguityGap: number }} thresholds
 */

/**
 * Manages color calibration: stores reference colors, computes thresholds,
 * applies Von Kries chromatic adaptation, and persists profiles.
 */
export class CalibrationEngine {
  constructor() {
    /** @type {Record<string, { L: number, a: number, b: number }>} */
    this._references = { ...DEFAULT_REFERENCES };

    /** @type {{ L: number, a: number, b: number }} */
    this._illuminant = { L: 100, a: 0, b: 0 }; // neutral D65

    /** @type {{ maxDelta: number, ambiguityGap: number }} */
    this._thresholds = { maxDelta: 25.0, ambiguityGap: 5.0 };
  }

  /**
   * Add or update a reference color for a named face.
   * @param {string} faceLabel - e.g. 'white', 'red', 'blue'
   * @param {{ L: number, a: number, b: number }} labColor
   */
  addReference(faceLabel, labColor) {
    this._references[faceLabel] = { ...labColor };
  }

  /**
   * Compute inter-color distances and derive dynamic thresholds.
   * Thresholds are set so that they sit between the closest pair of
   * reference colors and the maximum expected single-color spread.
   */
  buildPalette() {
    const names = Object.keys(this._references);
    const labs = Object.values(this._references);

    // Find the minimum pairwise distance between any two reference colors
    let minInterColorDelta = Infinity;
    for (let i = 0; i < labs.length; i++) {
      for (let j = i + 1; j < labs.length; j++) {
        const d = ciede2000(labs[i], labs[j]);
        if (d < minInterColorDelta) { minInterColorDelta = d; }
      }
    }

    if (minInterColorDelta === Infinity || names.length < 2) {
      // Default thresholds
      this._thresholds = { maxDelta: 25.0, ambiguityGap: 5.0 };
      return;
    }

    // maxDelta: half the minimum inter-color distance, capped at 25
    this._thresholds.maxDelta = Math.min(25.0, minInterColorDelta / 2);
    // ambiguityGap: 20% of maxDelta, minimum 3
    this._thresholds.ambiguityGap = Math.max(3.0, this._thresholds.maxDelta * 0.2);
  }

  /**
   * Return the current calibration profile.
   * @returns {CalibrationProfile}
   */
  getProfile() {
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      illuminant: { ...this._illuminant },
      references: Object.fromEntries(
        Object.entries(this._references).map(([k, v]) => [k, { ...v }])
      ),
      thresholds: { ...this._thresholds },
    };
  }

  /**
   * Load a previously saved profile, replacing current references.
   * @param {CalibrationProfile} profile
   */
  loadProfile(profile) {
    if (profile.version !== 1) {
      throw new Error(`Unsupported calibration profile version: ${profile.version}`);
    }
    this._illuminant = { ...profile.illuminant };
    this._references = Object.fromEntries(
      Object.entries(profile.references).map(([k, v]) => [k, { ...v }])
    );
    this._thresholds = { ...profile.thresholds };
  }

  /**
   * Persist current profile to localStorage.
   */
  saveProfile() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getProfile()));
    } catch {
      // localStorage may be unavailable (private browsing, quota exceeded)
    }
  }

  /**
   * Load profile from localStorage if one exists.
   * @returns {boolean} true if a profile was loaded
   */
  loadSavedProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { return false; }
      const profile = JSON.parse(raw);
      this.loadProfile(profile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset to factory default references (SPEC §4.2).
   */
  reset() {
    this._references = { ...DEFAULT_REFERENCES };
    this._illuminant = { L: 100, a: 0, b: 0 };
    this._thresholds = { maxDelta: 25.0, ambiguityGap: 5.0 };
  }

  /**
   * Adapt a LAB color from the detected illuminant to D65 reference
   * using Von Kries chromatic adaptation (simplified, applied in LAB space).
   *
   * Full implementation per SPEC §4.3: LAB → XYZ → LMS → scale → XYZ → LAB.
   * This simplified version applies a first-order correction directly in LAB.
   *
   * @param {{ L: number, a: number, b: number }} labColor
   * @returns {{ L: number, a: number, b: number }} Adapted color
   */
  applyWhiteBalance(labColor) {
    // Compute shift from detected illuminant to neutral D65 (L=100, a=0, b=0)
    const dA = -this._illuminant.a;
    const dB = -this._illuminant.b;
    const dL = (100 - this._illuminant.L) * 0.1; // gentle luminance correction

    return {
      L: labColor.L + dL,
      a: labColor.a + dA,
      b: labColor.b + dB,
    };
  }

  /**
   * Set the estimated scene illuminant (used for white balance).
   * @param {{ L: number, a: number, b: number }} illuminantLab
   */
  setIlluminant(illuminantLab) {
    this._illuminant = { ...illuminantLab };
  }

  /**
   * Assess lighting quality from basic frame statistics.
   * @param {{ brightness: number, contrast: number, colorCast: number }} stats
   * @returns {{ quality: 'good'|'acceptable'|'poor', recommendation: string }}
   */
  assessLightingQuality(stats) {
    const { brightness, contrast, colorCast } = stats;
    const issues = [];

    if (brightness < LIGHTING_THRESHOLDS.brightness.min) {
      issues.push('tooDark');
    } else if (brightness > LIGHTING_THRESHOLDS.brightness.max) {
      issues.push('tooBright');
    }
    if (contrast < LIGHTING_THRESHOLDS.contrast.min) {
      issues.push('lowContrast');
    }
    if (colorCast > LIGHTING_THRESHOLDS.colorCast.max) {
      issues.push('colorCast');
    }

    const RECOMMENDATIONS = {
      tooDark:     'Move to a brighter area or turn on more lights',
      tooBright:   'Reduce direct light — avoid pointing at a bright window',
      lowContrast: 'Add more directional light to create shadows on the cube',
      colorCast:   'Your lighting has a strong color tint — use the calibration tool for best results',
    };

    // Brightness violations prevent scanning entirely → 'poor'.
    // Contrast/colorCast violations reduce accuracy but are workable → 'acceptable'.
    const hasBrightnessIssue = issues.includes('tooDark') || issues.includes('tooBright');
    const quality = issues.length === 0 ? 'good'
      : hasBrightnessIssue ? 'poor'
      : 'acceptable';

    const recommendation = issues.length > 0
      ? RECOMMENDATIONS[issues[0]]
      : 'Lighting conditions are good';

    return { quality, recommendation };
  }

  /** @returns {Record<string, { L: number, a: number, b: number }>} */
  getReferences() {
    return Object.fromEntries(
      Object.entries(this._references).map(([k, v]) => [k, { ...v }])
    );
  }

  /** @returns {{ maxDelta: number, ambiguityGap: number }} */
  getThresholds() {
    return { ...this._thresholds };
  }
}

/** Singleton instance shared across the application. */
export const calibrationEngine = new CalibrationEngine();
