/**
 * CalibrationView — manual color-reference capture screen.
 * User points the camera at each physical color and taps the matching target.
 * After all 6 are captured, the profile is saved to localStorage.
 */
import { calibrationEngine } from '../cv/calibration.js';
import { cameraManager } from '../scanner/camera.js';

const COLORS = ['white', 'red', 'blue', 'orange', 'green', 'yellow'];

const COLOR_DISPLAY = {
  white:  'White',
  yellow: 'Yellow',
  red:    'Red',
  orange: 'Orange',
  blue:   'Blue',
  green:  'Green',
};

/**
 * @param {{
 *   onDone?: function(): void,
 * }} [opts]
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createCalibrationView({ onDone } = {}) {
  const container = document.createElement('div');
  container.className = 'calibration';
  container.setAttribute('data-testid', 'calibration-root');

  /** @type {Set<string>} */
  const captured = new Set();

  container.innerHTML = `
    <div class="calibration-header">
      <h2 class="calibration-title">Calibrate Colours</h2>
    </div>
    <p class="calibration-subtitle">
      Point your camera at each colour on your cube and tap the matching square.
      This improves detection accuracy in your lighting conditions.
    </p>

    <div class="calibration-preview" data-testid="calibration-preview">
      <video class="calibration-preview-video" autoplay muted playsinline
             data-testid="calibration-preview-video"></video>
      <div class="calibration-preview-reticle" aria-hidden="true"></div>
    </div>

    <div class="calibration-targets" data-testid="calibration-targets"
         role="list" aria-label="Colour targets">
      ${COLORS.map((color) => `
        <button class="calibration-target"
                data-color="${color}"
                data-testid="calibration-target-${color}"
                role="listitem"
                type="button"
                aria-label="Capture ${COLOR_DISPLAY[color]}">
          <div class="calibration-target-swatch" data-color="${color}"></div>
          <span class="calibration-target-label">${COLOR_DISPLAY[color]}</span>
          <span class="calibration-target-check" aria-hidden="true"></span>
        </button>
      `).join('')}
    </div>

    <div class="calibration-progress" data-testid="calibration-progress">
      <div class="calibration-progress-label">
        <span>Progress</span>
        <span data-testid="calibration-progress-count">0 / 6</span>
      </div>
      <div class="calibration-progress-bar">
        <div class="calibration-progress-fill" data-testid="calibration-progress-fill"
             style="width: 0%"></div>
      </div>
    </div>

    <div class="calibration-actions">
      <button class="calibration-btn-reset"
              data-testid="calibration-btn-reset"
              type="button">
        Reset to defaults
      </button>
      <button class="calibration-btn-done btn btn-primary"
              data-testid="calibration-btn-done"
              type="button">
        Done ✓
      </button>
    </div>
  `;

  /** @type {HTMLVideoElement} */
  const videoEl = container.querySelector('.calibration-preview-video');

  /** @type {HTMLCanvasElement} */
  const offscreen = document.createElement('canvas');
  /** @type {CanvasRenderingContext2D|null} */
  let offCtx = null;

  const progressCount = container.querySelector('[data-testid="calibration-progress-count"]');
  const progressFill  = container.querySelector('[data-testid="calibration-progress-fill"]');

  /** @type {Array<() => void>} */
  const cleanups = [];

  function updateProgress() {
    const n = captured.size;
    progressCount.textContent = `${n} / 6`;
    progressFill.style.width = `${(n / 6) * 100}%`;
  }

  /**
   * Grab the centre region of the current video frame and return its
   * average LAB value (simplified — we derive from RGB).
   * @returns {{ L: number, a: number, b: number }|null}
   */
  function sampleCenterLab() {
    if (!videoEl || videoEl.readyState < HTMLVideoElement.HAVE_CURRENT_DATA) {
      return null;
    }
    const { videoWidth: w, videoHeight: h } = videoEl;
    if (w === 0 || h === 0) { return null; }

    // Sample a 32×32 region at the centre
    const sSize = 32;
    offscreen.width  = sSize;
    offscreen.height = sSize;
    if (!offCtx) { offCtx = offscreen.getContext('2d'); }
    offCtx.drawImage(
      videoEl,
      (w - sSize) / 2, (h - sSize) / 2, sSize, sSize,
      0, 0, sSize, sSize,
    );
    const data = offCtx.getImageData(0, 0, sSize, sSize).data;

    // Average RGB
    let sumR = 0, sumG = 0, sumB = 0;
    const pixels = sSize * sSize;
    for (let i = 0; i < data.length; i += 4) {
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
    }
    const r = sumR / pixels / 255;
    const g = sumG / pixels / 255;
    const b = sumB / pixels / 255;

    // RGB → linear sRGB
    const lin = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const lr = lin(r), lg = lin(g), lb = lin(b);

    // Linear sRGB → XYZ (D65)
    const X = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
    const Y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
    const Z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

    // XYZ → CIELAB (D65 reference: Xn=0.95047, Yn=1.0, Zn=1.08883)
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(X / 0.95047);
    const fy = f(Y / 1.0);
    const fz = f(Z / 1.08883);

    return {
      L: Math.max(0, 116 * fy - 16),
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  }

  function mount() {
    // Start camera
    cameraManager.requestCamera('environment').then((stream) => {
      videoEl.srcObject = stream;
    }).catch(() => {
      // Non-fatal — user can still reset to defaults without camera
    });

    // Wire target buttons
    const targets = container.querySelectorAll('.calibration-target');
    for (const target of targets) {
      const color = target.dataset.color;
      const onClick = () => {
        const lab = sampleCenterLab();
        if (lab) {
          calibrationEngine.addReference(color, lab);
        }
        target.classList.add('is-captured');
        captured.add(color);
        updateProgress();

        // Auto-build palette after 3+ references
        if (captured.size >= 3) {
          calibrationEngine.buildPalette();
        }

        // Auto-save after all 6
        if (captured.size === 6) {
          calibrationEngine.saveProfile();
        }
      };
      target.addEventListener('click', onClick);
      cleanups.push(() => target.removeEventListener('click', onClick));
    }

    // Reset button
    const btnReset = container.querySelector('[data-testid="calibration-btn-reset"]');
    const onReset = () => {
      calibrationEngine.reset();
      captured.clear();
      updateProgress();
      for (const t of targets) {
        t.classList.remove('is-captured');
      }
      try {
        localStorage.removeItem('magic-cube:calibration-profile');
      } catch {
        // ignore
      }
    };
    btnReset.addEventListener('click', onReset);
    cleanups.push(() => btnReset.removeEventListener('click', onReset));

    // Done button
    const btnDone = container.querySelector('[data-testid="calibration-btn-done"]');
    const handleDone = () => {
      if (captured.size > 0) {
        calibrationEngine.saveProfile();
      }
      cameraManager.stopCamera();
      if (onDone) { onDone(); }
    };
    btnDone.addEventListener('click', handleDone);
    cleanups.push(() => btnDone.removeEventListener('click', handleDone));
  }

  function unmount() {
    cameraManager.stopCamera();
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
