/**
 * CV Web Worker — OpenCV.js WASM-based face detection pipeline.
 * Handles messages: INIT, DETECT_FACE, ASSESS_LIGHTING, TERMINATE (SPEC §6.1).
 *
 * OpenCV.js is loaded via importScripts() (not ES module import) because it uses
 * the legacy UMD/IIFE pattern and expects to be executed as a script in the
 * worker global scope.
 */

/* global cv, importScripts */

const OPENCV_CDN = 'https://docs.opencv.org/4.9.0/opencv.js';

// Detection parameters from SPEC §2.2
const PARAMS = {
  resizeWidth:    640,
  resizeHeight:   480,
  blurKernel:     5,
  cannyLow:       50,
  cannyHigh:      150,
  dilateKernel:   3,
  dilateIter:     1,
  areaMinPercent: 0.005,  // 0.5% of image area
  areaMaxPercent: 0.15,   // 15% of image area
  polyEpsilonFactor: 0.04,
  aspectRatioMin: 0.6,
  aspectRatioMax: 1.4,
};

let cvReady = false;

// ──────────────────────────────────────────────────────────────────────────────
// Message dispatcher
// ──────────────────────────────────────────────────────────────────────────────

self.onmessage = function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT':
      handleInit();
      break;
    case 'DETECT_FACE':
      handleDetectFace(payload);
      break;
    case 'ASSESS_LIGHTING':
      handleAssessLighting(payload);
      break;
    case 'TERMINATE':
      self.close();
      break;
    default:
      postError('UNKNOWN_MESSAGE', `Unknown message type: ${type}`);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// INIT handler — load OpenCV.js from CDN
// ──────────────────────────────────────────────────────────────────────────────

function handleInit() {
  if (cvReady) {
    self.postMessage({ type: 'INIT_COMPLETE' });
    return;
  }

  self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 0, stage: 'Loading OpenCV.js…' } });

  try {
    // OpenCV.js must be loaded as a script in the worker scope, not as an ES module.
    // It registers itself as a global `cv` promise/object on the worker global.
    importScripts(OPENCV_CDN);

    self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 70, stage: 'Initializing WASM runtime…' } });

    // cv may already be initialized (sync WASM) or be a promise (async WASM)
    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
      cvReady = true;
      self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 100, stage: 'Ready' } });
      self.postMessage({ type: 'INIT_COMPLETE' });
    } else if (typeof cv !== 'undefined' && cv instanceof Promise) {
      cv.then((initializedCv) => {
        self.cv = initializedCv;
        cvReady = true;
        self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 100, stage: 'Ready' } });
        self.postMessage({ type: 'INIT_COMPLETE' });
      }).catch((err) => {
        postError('CV_INIT_FAILED', `OpenCV WASM init failed: ${err.message}`);
      });
    } else {
      // Newer OpenCV.js versions use Module.onRuntimeInitialized
      /* global Module */
      // eslint-disable-next-line no-undef
      Module.onRuntimeInitialized = function () {
        cvReady = true;
        self.postMessage({ type: 'INIT_PROGRESS', payload: { percent: 100, stage: 'Ready' } });
        self.postMessage({ type: 'INIT_COMPLETE' });
      };
    }
  } catch (err) {
    postError('CV_INIT_FAILED', `Failed to load OpenCV.js: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DETECT_FACE handler
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ imageData: ImageData, gridSize: number, faceShape: string }} payload
 */
function handleDetectFace(payload) {
  if (!cvReady) {
    postError('CV_INIT_FAILED', 'OpenCV.js not yet initialized');
    return;
  }

  const { imageData, gridSize, faceShape } = payload;
  const requiredVertices = faceShape === 'triangle' ? 3 : faceShape === 'pentagon' ? 5 : 4;

  let src, gray, blurred, edges, dilated, contours, hierarchy;

  try {
    // Step 1: Load ImageData into an OpenCV Mat
    src = cv.matFromImageData(imageData);
    const origWidth  = src.cols;
    const origHeight = src.rows;

    // Step 2: Resize to working resolution
    const workSize = new cv.Size(PARAMS.resizeWidth, PARAMS.resizeHeight);
    const resized = new cv.Mat();
    cv.resize(src, resized, workSize);

    const scaleX = origWidth  / PARAMS.resizeWidth;
    const scaleY = origHeight / PARAMS.resizeHeight;
    const imageArea = PARAMS.resizeWidth * PARAMS.resizeHeight;

    // Step 3: Gaussian blur
    gray = new cv.Mat();
    blurred = new cv.Mat();
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(PARAMS.blurKernel, PARAMS.blurKernel), 0);

    // Step 4: Canny edge detection
    edges = new cv.Mat();
    cv.Canny(blurred, edges, PARAMS.cannyLow, PARAMS.cannyHigh);

    // Step 5: Dilate to close gaps
    dilated = new cv.Mat();
    const dilateKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(PARAMS.dilateKernel, PARAMS.dilateKernel)
    );
    cv.dilate(edges, dilated, dilateKernel, new cv.Point(-1, -1), PARAMS.dilateIter);
    dilateKernel.delete();

    // Step 6: Find contours
    contours  = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    // Step 7: Filter candidate tiles
    const areaMin = imageArea * PARAMS.areaMinPercent;
    const areaMax = imageArea * PARAMS.areaMaxPercent;
    const candidates = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < areaMin || area > areaMax) {
        contour.delete();
        continue;
      }

      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, PARAMS.polyEpsilonFactor * perimeter, true);

      if (approx.rows !== requiredVertices) {
        approx.delete();
        contour.delete();
        continue;
      }

      const rect = cv.boundingRect(approx);
      const aspectRatio = rect.width / rect.height;
      if (aspectRatio < PARAMS.aspectRatioMin || aspectRatio > PARAMS.aspectRatioMax) {
        approx.delete();
        contour.delete();
        continue;
      }

      // Centroid of the contour
      const M = cv.moments(approx);
      if (M.m00 === 0) {
        approx.delete();
        contour.delete();
        continue;
      }
      const cx = M.m10 / M.m00;
      const cy = M.m01 / M.m00;

      candidates.push({ cx, cy, rect, area });
      approx.delete();
      contour.delete();
    }

    // Step 8: Grid clustering
    const gridResult = clusterIntoGrid(candidates, gridSize);

    if (!gridResult) {
      _cleanup(src, resized, gray, blurred, edges, dilated, contours, hierarchy);
      self.postMessage({
        type: 'DETECTION_RESULT',
        payload: {
          success: false,
          colors: [],
          confidence: [],
          gridPoints: [],
          overallConfidence: 0,
          warnings: ['No valid grid detected'],
        },
      });
      return;
    }

    // Step 9: Extract median LAB colors from each cell ROI
    const labGrid = extractCellColors(resized, gridResult.grid);

    // Step 10: Scale grid points back to original resolution
    const scaledGridPoints = gridResult.grid.map(row =>
      row.map(cell => ({
        x: cell.cx * scaleX,
        y: cell.cy * scaleY,
      }))
    );

    _cleanup(src, resized, gray, blurred, edges, dilated, contours, hierarchy);

    self.postMessage({
      type: 'DETECTION_RESULT',
      payload: {
        success: true,
        labGrid,
        gridPoints: scaledGridPoints,
        overallConfidence: gridResult.confidence,
        warnings: [],
      },
    });

  } catch (err) {
    _cleanup(src, gray, blurred, edges, dilated, contours, hierarchy);
    postError('CV_NO_FACE', `Detection failed: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ASSESS_LIGHTING handler
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ imageData: ImageData }} payload
 */
function handleAssessLighting(payload) {
  if (!cvReady) {
    postError('CV_INIT_FAILED', 'OpenCV.js not yet initialized');
    return;
  }

  const { imageData } = payload;
  let src, gray;

  try {
    src  = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Brightness: mean luminance
    const mean   = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(gray, mean, stddev);

    const brightness = mean.data64F[0];
    const contrast   = stddev.data64F[0];
    mean.delete();
    stddev.delete();

    // Color cast: mean of chrominance channels in Lab
    const lab = new cv.Mat();
    cv.cvtColor(src, lab, cv.COLOR_RGBA2Lab);
    const labMean = cv.mean(lab);
    // labMean: [L, a, b, alpha]
    // Neutral gray has a≈128, b≈128 in OpenCV's 8-bit Lab encoding
    const colorCast = Math.sqrt(
      Math.pow(labMean[1] - 128, 2) + Math.pow(labMean[2] - 128, 2)
    );
    lab.delete();

    src.delete();
    gray.delete();

    /** @type {'good'|'acceptable'|'poor'} */
    let quality;
    let recommendation;

    if (brightness < 60) {
      quality = 'poor';
      recommendation = 'Move to a brighter area or turn on more lights';
    } else if (brightness > 220) {
      quality = 'poor';
      recommendation = 'Reduce direct light — avoid pointing at a bright window';
    } else if (contrast < 20) {
      quality = 'acceptable';
      recommendation = 'Add more directional light to create shadows on the cube';
    } else if (colorCast > 15) {
      quality = 'acceptable';
      recommendation = 'Your lighting has a strong color tint — use the calibration tool for best results';
    } else {
      quality = 'good';
      recommendation = 'Lighting conditions are good';
    }

    self.postMessage({
      type: 'LIGHTING_RESULT',
      payload: {
        quality,
        brightness,
        contrast,
        colorCast,
        recommendation,
      },
    });

  } catch (err) {
    if (src)  { try { src.delete();  } catch (_err) { /* ignore */ } }
    if (gray) { try { gray.delete(); } catch (_err) { /* ignore */ } }
    postError('CV_LOW_LIGHT', `Lighting assessment failed: ${err.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Grid clustering — SPEC §2.3
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cluster candidate centroids into an NxN grid.
 * @param {{ cx: number, cy: number, rect: object, area: number }[]} candidates
 * @param {number} gridSize
 * @returns {{ grid: object[][], confidence: number }|null}
 */
function clusterIntoGrid(candidates, gridSize) {
  const N = gridSize;

  if (candidates.length < N * N) { return null; }

  // Sort by Y then X to seed row clustering
  const sorted = [...candidates].sort((a, b) => a.cy - b.cy);

  // k-means on Y coordinates to identify rows
  const rows = kMeans1D(sorted.map(c => c.cy), N);
  if (!rows) { return null; }

  // Assign each candidate to a row
  const rowGroups = Array.from({ length: N }, () => []);
  for (const c of sorted) {
    let bestRow = 0, bestDist = Infinity;
    for (let r = 0; r < N; r++) {
      const d = Math.abs(c.cy - rows[r]);
      if (d < bestDist) { bestDist = d; bestRow = r; }
    }
    rowGroups[bestRow].push(c);
  }

  // Validate: each row must have exactly N tiles
  for (let r = 0; r < N; r++) {
    if (rowGroups[r].length !== N) { return null; }
  }

  // Sort each row by X
  const grid = rowGroups.map(row => row.slice().sort((a, b) => a.cx - b.cx));

  // Validate: approximately equal spacing
  const rowSpacings = [];
  for (let r = 1; r < N; r++) {
    rowSpacings.push(rows[r] - rows[r - 1]);
  }
  const avgRowSpacing = rowSpacings.reduce((s, v) => s + v, 0) / rowSpacings.length;
  for (const sp of rowSpacings) {
    if (Math.abs(sp - avgRowSpacing) / avgRowSpacing > 0.4) { return null; }
  }

  const confidence = Math.min(1, (candidates.length / (N * N)) > 1.5 ? 0.7 : 0.95);

  return { grid, confidence };
}

/**
 * Simple 1D k-means returning k cluster centers.
 * @param {number[]} values
 * @param {number} k
 * @returns {number[]|null}
 */
function kMeans1D(values, k) {
  if (values.length < k) { return null; }

  // Initialize centers evenly across the range
  const min = Math.min(...values);
  const max = Math.max(...values);
  let centers = Array.from({ length: k }, (_, i) => min + (max - min) * (i / (k - 1 || 1)));

  for (let iter = 0; iter < 20; iter++) {
    const sums   = new Array(k).fill(0);
    const counts = new Array(k).fill(0);

    for (const v of values) {
      let bestC = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = Math.abs(v - centers[c]);
        if (d < bestD) { bestD = d; bestC = c; }
      }
      sums[bestC]   += v;
      counts[bestC] += 1;
    }

    const newCenters = centers.map((c, i) => counts[i] > 0 ? sums[i] / counts[i] : c);
    if (newCenters.every((c, i) => Math.abs(c - centers[i]) < 0.5)) { break; }
    centers = newCenters;
  }

  return centers.sort((a, b) => a - b);
}

// ──────────────────────────────────────────────────────────────────────────────
// Color extraction — extract median LAB from each cell's center ROI
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @param {cv.Mat} img - The resized image
 * @param {object[][]} grid - NxN array of { cx, cy, rect }
 * @returns {{ L: number, a: number, b: number }[][]}
 */
function extractCellColors(img, grid) {
  const labGrid = [];
  const labImg  = new cv.Mat();
  cv.cvtColor(img, labImg, cv.COLOR_RGBA2Lab);

  for (const row of grid) {
    const labRow = [];
    for (const cell of row) {
      const { cx, cy, rect } = cell;
      // Sample the center 40% of the cell to avoid edge artifacts
      const sampleW = Math.max(1, Math.round(rect.width  * 0.4));
      const sampleH = Math.max(1, Math.round(rect.height * 0.4));
      const x0 = Math.max(0, Math.round(cx - sampleW / 2));
      const y0 = Math.max(0, Math.round(cy - sampleH / 2));
      const x1 = Math.min(img.cols, x0 + sampleW);
      const y1 = Math.min(img.rows, y0 + sampleH);

      const roi    = labImg.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0));
      const meanV  = cv.mean(roi);
      roi.delete();

      // OpenCV Lab encoding: L in [0,255] maps to [0,100], a,b in [0,255] maps to [-128,127]
      labRow.push({
        L: meanV[0] * 100 / 255,
        a: meanV[1] - 128,
        b: meanV[2] - 128,
      });
    }
    labGrid.push(labRow);
  }

  labImg.delete();
  return labGrid;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function postError(code, message) {
  self.postMessage({ type: 'ERROR', payload: { code, message } });
}

function _cleanup(...mats) {
  for (const m of mats) {
    if (m && typeof m.delete === 'function') {
      try { m.delete(); } catch (_err) { /* ignore Mat deletion errors */ }
    }
  }
}
