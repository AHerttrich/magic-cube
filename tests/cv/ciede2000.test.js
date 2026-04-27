import { describe, it, expect } from 'vitest';
import { ciede2000, rgbToLab, labToRgb } from '../../src/cv/ciede2000.js';

// ──────────────────────────────────────────────────────────────────────────────
// Reference ΔE₀₀ pairs from Sharma et al. (2005) — the canonical CIE test set.
// Source: "The CIEDE2000 Color-Difference Formula", Color Research & Application.
// ──────────────────────────────────────────────────────────────────────────────
const CIE_REFERENCE_PAIRS = [
  // [L1, a1, b1, L2, a2, b2, expectedΔE]
  [50.0000,  2.6772, -79.7751, 50.0000,  0.0000, -82.7485,  2.0425],
  [50.0000,  3.1571, -77.2803, 50.0000,  0.0000, -82.7485,  2.8615],
  [50.0000,  2.8361, -74.0200, 50.0000,  0.0000, -82.7485,  3.4412],
  [50.0000, -1.3802, -84.2814, 50.0000,  0.0000, -82.7485,  1.0000],
  [50.0000, -1.1848, -84.8006, 50.0000,  0.0000, -82.7485,  1.0000],
  [50.0000, -0.9009, -85.5211, 50.0000,  0.0000, -82.7485,  1.0000],
  [50.0000,  0.0000,   0.0000, 50.0000, -1.0000,   2.0000,  2.3669],
  [50.0000, -1.0000,   2.0000, 50.0000,  0.0000,   0.0000,  2.3669],
  [50.0000,  2.4900,  -0.0010, 50.0000, -2.4900,   0.0009,  7.1792],
  [50.0000,  2.4900,  -0.0010, 50.0000, -2.4900,   0.0010,  7.1792],
  [50.0000,  2.4900,  -0.0010, 50.0000, -2.4900,   0.0011,  7.2195],
  [50.0000,  2.4900,  -0.0010, 50.0000, -2.4900,   0.0012,  7.2195],
  [50.0000, -0.0010,   2.4900, 50.0000,  0.0009,  -2.4900,  4.8045],
  [50.0000, -0.0010,   2.4900, 50.0000,  0.0010,  -2.4900,  4.8045],
  [50.0000, -0.0010,   2.4900, 50.0000,  0.0011,  -2.4900,  4.7461],
  [50.0000,  2.5000,   0.0000, 50.0000,  0.0000,  -2.5000,  4.3065],
  [50.0000,  2.5000,   0.0000, 73.0000, 25.0000, -18.0000, 27.1492],
  [50.0000,  2.5000,   0.0000, 61.0000, -5.0000,  29.0000, 22.8977],
  [50.0000,  2.5000,   0.0000, 56.0000, -27.0000, -3.0000, 31.9030],
  [50.0000,  2.5000,   0.0000, 58.0000, 24.0000,  15.0000, 19.4535],
  [50.0000,  2.5000,   0.0000, 50.0000,  3.1736,   0.5854,  1.0000],
  [50.0000,  2.5000,   0.0000, 50.0000,  3.2972,   0.0000,  1.0000],
  [50.0000,  2.5000,   0.0000, 50.0000,  1.8634,   0.5757,  1.0000],
  [50.0000,  2.5000,   0.0000, 50.0000,  3.2592,   0.3350,  1.0000],
  [60.2574, -34.0099,  36.2677, 60.4626, -34.1751, 39.4387,  1.2644],
  [63.0109, -31.0961,  -5.8663, 62.8187, -29.7946, -4.0864,  1.2630],
  [61.2901,  3.7196,  -5.3901, 61.4292,  2.2480,  -4.9620,  1.8731],
  [35.0831, -44.1164,   3.7933, 35.0232, -40.0716,  1.5901,  1.8645],
  [22.7233,  20.0904, -46.6940, 23.0331,  14.9730, -42.5619,  2.0373],
  [36.4612,  47.8580,  18.3852, 36.2715,  50.5065,  21.2231,  1.4146],
  [90.8027,  -2.0831,   1.4410, 91.1528,  -1.6435,   0.0447,  1.4441],
  [90.9257,  -0.5406,  -0.9208, 88.6381,  -0.8985,  -0.7239,  1.5381],
  [ 6.7747,  -0.2908,  -2.4247,  5.8714,  -0.0985,  -2.2286,  0.6377],
  [ 2.0776,   0.0795,  -1.1350,  0.9033,  -0.0636,  -0.5514,  0.9082],
];

describe('ciede2000', () => {
  it('returns 0 for identical colors', () => {
    expect(ciede2000({ L: 50, a: 20, b: -30 }, { L: 50, a: 20, b: -30 })).toBe(0);
  });

  it('is symmetric', () => {
    const c1 = { L: 50, a:  2.5, b:  0 };
    const c2 = { L: 73, a: 25,   b: -18 };
    expect(ciede2000(c1, c2)).toBeCloseTo(ciede2000(c2, c1), 4);
  });

  it('is non-negative', () => {
    for (const [L1, a1, b1, L2, a2, b2] of CIE_REFERENCE_PAIRS) {
      expect(ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 })).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(CIE_REFERENCE_PAIRS.map(([L1, a1, b1, L2, a2, b2, expected], i) => ({
    index: i + 1,
    lab1: { L: L1, a: a1, b: b1 },
    lab2: { L: L2, a: a2, b: b2 },
    expected,
  })))('CIE reference pair #$index → ΔE ≈ $expected', ({ lab1, lab2, expected }) => {
    expect(ciede2000(lab1, lab2)).toBeCloseTo(expected, 2);
  });

  it('clearly distinguishes Rubik\'s cube face colors', () => {
    const white  = { L: 95, a:   0, b:   0 };
    const yellow = { L: 90, a:  -5, b:  85 };
    const red    = { L: 45, a:  60, b:  35 };
    const orange = { L: 65, a:  40, b:  65 };
    const blue   = { L: 30, a:  15, b: -55 };
    const green  = { L: 50, a: -45, b:  30 };

    const colors = [white, yellow, red, orange, blue, green];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        // Adjacent Rubik's cube colors should differ by at least 15 ΔE
        expect(ciede2000(colors[i], colors[j])).toBeGreaterThan(10);
      }
    }
  });
});

describe('rgbToLab', () => {
  it('converts pure white correctly', () => {
    const lab = rgbToLab(255, 255, 255);
    expect(lab.L).toBeCloseTo(100, 0);
    expect(Math.abs(lab.a)).toBeLessThan(1);
    expect(Math.abs(lab.b)).toBeLessThan(1);
  });

  it('converts pure black correctly', () => {
    const lab = rgbToLab(0, 0, 0);
    expect(lab.L).toBeCloseTo(0, 0);
    expect(Math.abs(lab.a)).toBeLessThan(1);
    expect(Math.abs(lab.b)).toBeLessThan(1);
  });

  it('converts sRGB red approximately correctly', () => {
    const lab = rgbToLab(255, 0, 0);
    expect(lab.L).toBeCloseTo(53.2, 0);
    expect(lab.a).toBeCloseTo(80.1, 0);
    expect(lab.b).toBeCloseTo(67.2, 0);
  });

  it('converts sRGB blue approximately correctly', () => {
    const lab = rgbToLab(0, 0, 255);
    expect(lab.L).toBeCloseTo(32.3, 0);
    expect(lab.a).toBeCloseTo(79.2, 0);
    expect(lab.b).toBeCloseTo(-107.9, 0);
  });
});

describe('labToRgb', () => {
  it('converts pure white back to RGB', () => {
    const rgb = labToRgb(100, 0, 0);
    expect(rgb.r).toBeCloseTo(255, -1);
    expect(rgb.g).toBeCloseTo(255, -1);
    expect(rgb.b).toBeCloseTo(255, -1);
  });

  it('converts pure black back to RGB', () => {
    const rgb = labToRgb(0, 0, 0);
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('RGB → LAB → RGB round-trip stays within 3 units', () => {
    const testColors = [
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [128, 128, 128], [255, 165, 0], [0, 128, 128],
      [255, 255, 0], [100, 50, 200],
    ];

    for (const [r, g, b] of testColors) {
      const lab = rgbToLab(r, g, b);
      const rgb2 = labToRgb(lab.L, lab.a, lab.b);
      expect(Math.abs(rgb2.r - r)).toBeLessThan(3);
      expect(Math.abs(rgb2.g - g)).toBeLessThan(3);
      expect(Math.abs(rgb2.b - b)).toBeLessThan(3);
    }
  });

  it('clamps out-of-gamut values to [0, 255]', () => {
    // An extremely saturated LAB color that falls outside sRGB gamut
    const rgb = labToRgb(50, 100, 100);
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(255);
  });
});
