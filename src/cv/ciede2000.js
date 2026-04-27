/**
 * CIEDE2000 — ΔE₀₀ color difference formula.
 * Reference: CIE Technical Report 142-2001.
 *
 * Perceptual thresholds (from SPEC §2.4):
 *   ΔE < 1.0  — imperceptible difference
 *   ΔE 1–2    — barely perceptible
 *   ΔE 2–3.5  — noticeable on close inspection
 *   ΔE 3.5–5  — clearly noticeable
 *   ΔE > 5    — obvious, different color
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Compute CIEDE2000 color difference (ΔE₀₀) between two LAB colors.
 * @param {{ L: number, a: number, b: number }} lab1 - Reference color
 * @param {{ L: number, a: number, b: number }} lab2 - Sample color
 * @returns {number} ΔE₀₀ value (0 = identical)
 */
export function ciede2000(lab1, lab2) {
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;

  // Step 1: Compute C*ab and h*ab for each color
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  // G factor — weight for the a* axis
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7 = 6103515625

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = _hprime(a1p, b1);
  const h2p = _hprime(a2p, b2);

  // Step 2: Compute ΔL', ΔC', ΔH'
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG_TO_RAD);

  // Step 3: Compute CIEDE2000 weighting functions
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let Hbarp;
  if (C1p * C2p === 0) {
    Hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    Hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    Hbarp = (h1p + h2p + 360) / 2;
  } else {
    Hbarp = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((Hbarp - 30) * DEG_TO_RAD)
    + 0.24 * Math.cos(2 * Hbarp * DEG_TO_RAD)
    + 0.32 * Math.cos((3 * Hbarp + 6) * DEG_TO_RAD)
    - 0.20 * Math.cos((4 * Hbarp - 63) * DEG_TO_RAD);

  const SL = 1 + 0.015 * Math.pow(Lbarp - 50, 2) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;

  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 6103515625));
  const dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2));
  const RT = -Math.sin(2 * dTheta * DEG_TO_RAD) * RC;

  // Step 4: Compute ΔE₀₀
  const lTerm = dLp / SL;
  const cTerm = dCp / SC;
  const hTerm = dHp / SH;

  return Math.sqrt(
    lTerm * lTerm +
    cTerm * cTerm +
    hTerm * hTerm +
    RT * cTerm * hTerm
  );
}

/**
 * Compute h'(a', b') in degrees [0, 360).
 * @param {number} ap
 * @param {number} b
 * @returns {number}
 */
function _hprime(ap, b) {
  if (ap === 0 && b === 0) { return 0; }
  const h = Math.atan2(b, ap) * RAD_TO_DEG;
  return h < 0 ? h + 360 : h;
}

// ──────────────────────────────────────────────────────────────────────────────
// RGB ↔ LAB conversion utilities (D65 reference illuminant)
// ──────────────────────────────────────────────────────────────────────────────

/** D65 reference white in XYZ. */
const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

/**
 * Convert sRGB [0–255] to CIE LAB (D65).
 * @param {number} r - Red channel 0–255
 * @param {number} g - Green channel 0–255
 * @param {number} b - Blue channel 0–255
 * @returns {{ L: number, a: number, b: number }}
 */
export function rgbToLab(r, g, b) {
  // sRGB → linear RGB
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

  // Linear RGB → XYZ (D65, sRGB matrix)
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) * 100;
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) * 100;
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) * 100;

  // XYZ → LAB
  const fx = _labF(X / D65.X);
  const fy = _labF(Y / D65.Y);
  const fz = _labF(Z / D65.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Convert CIE LAB (D65) to sRGB [0–255].
 * Values are clamped to the sRGB gamut.
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @returns {{ r: number, g: number, b: number }}
 */
export function labToRgb(L, a, b) {
  // LAB → XYZ
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const X = D65.X * _labFInv(fx);
  const Y = D65.Y * _labFInv(fy);
  const Z = D65.Z * _labFInv(fz);

  // XYZ → linear RGB (inverse sRGB matrix)
  const xn = X / 100, yn = Y / 100, zn = Z / 100;
  let R =  xn * 3.2404542 - yn * 1.5371385 - zn * 0.4985314;
  let G = -xn * 0.9692660 + yn * 1.8760108 + zn * 0.0415560;
  let B =  xn * 0.0556434 - yn * 0.2040259 + zn * 1.0572252;

  // Linear RGB → sRGB gamma
  R = R > 0.0031308 ? 1.055 * Math.pow(R, 1 / 2.4) - 0.055 : 12.92 * R;
  G = G > 0.0031308 ? 1.055 * Math.pow(G, 1 / 2.4) - 0.055 : 12.92 * G;
  B = B > 0.0031308 ? 1.055 * Math.pow(B, 1 / 2.4) - 0.055 : 12.92 * B;

  return {
    r: Math.round(Math.min(255, Math.max(0, R * 255))),
    g: Math.round(Math.min(255, Math.max(0, G * 255))),
    b: Math.round(Math.min(255, Math.max(0, B * 255))),
  };
}

/** CIE LAB nonlinear function f(t). */
function _labF(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Inverse of _labF. */
function _labFInv(t) {
  return t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787;
}
