/**
 * ScannerView — full-viewport camera feed with 3×3 grid overlay.
 * Orchestrates camera, detection loop, face sequence, and cube preview.
 * Enters on Scanning state; exits via FACE_DETECTED or CANCEL.
 */
import { stateMachine, Action } from '../core/stateMachine.js';
import { calibrationEngine } from '../cv/calibration.js';
import { cameraManager } from '../scanner/camera.js';
import { DetectionLoop } from '../scanner/detectionLoop.js';
import { faceSequence, FACE_ORDER } from '../scanner/faceSequence.js';
import { createCubePreview } from './cubePreview.js';

/**
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createScannerView() {
  const container = document.createElement('div');
  container.className = 'scanner';
  container.setAttribute('data-testid', 'scanner-root');

  // Check if a custom calibration profile is loaded
  const isCalibrated = (() => {
    try {
      return localStorage.getItem('magic-cube:calibration-profile') !== null;
    } catch {
      return false;
    }
  })();

  container.innerHTML = `
    <!-- Toolbar -->
    <div class="scanner-toolbar" data-testid="scanner-toolbar">
      <button class="scanner-toolbar-back"
              data-testid="scanner-toolbar-back"
              type="button"
              aria-label="Go back">
        ←
      </button>

      <div class="scanner-face-indicator" data-testid="scanner-face-indicator"
           aria-live="polite" aria-atomic="true">
        <div class="scanner-face-indicator-label" data-testid="scanner-face-label"></div>
        <div class="scanner-face-indicator-sub" data-testid="scanner-face-sub"></div>
      </div>

      <button class="scanner-toolbar-switch"
              data-testid="scanner-toolbar-switch"
              type="button"
              aria-label="Switch camera">
        🔄
      </button>
    </div>

    ${isCalibrated ? '<div class="scanner-calibrated-badge" data-testid="scanner-calibrated-badge" aria-label="Calibrated">Calibrated ✓</div>' : ''}

    <!-- Video feed -->
    <div class="scanner-video-wrap">
      <video class="scanner-video"
             data-testid="scanner-video"
             autoplay muted playsinline></video>
    </div>

    <!-- Grid overlay -->
    <div class="scanner-overlay" data-testid="scanner-overlay" aria-hidden="true">
      <div class="scanner-grid" data-testid="scanner-grid">
        ${Array.from({ length: 9 }, (_, i) =>
          `<div class="scanner-grid-cell" data-testid="scanner-grid-cell-${i}"></div>`
        ).join('')}
      </div>
    </div>

    <!-- Guide instruction -->
    <div class="scanner-guide-text" data-testid="scanner-guide-text" aria-live="polite"></div>

    <!-- Bottom controls -->
    <div class="scanner-controls">
      <div class="scanner-lighting" data-testid="scanner-lighting">
        <div class="scanner-lighting-dot"
             data-testid="scanner-lighting-dot"
             data-quality="unknown"></div>
        <span class="scanner-lighting-text"
              data-testid="scanner-lighting-text">Checking lighting…</span>
      </div>

      <button class="scanner-capture-btn"
              data-testid="scanner-capture-btn"
              type="button"
              aria-label="Capture face">
        📷
      </button>
    </div>

    <!-- Loading overlay (hidden by default) -->
    <div class="scanner-loading" data-testid="scanner-loading" style="display:none;" aria-live="polite">
      <div class="scanner-loading-spinner"></div>
      <span>Detecting colours…</span>
    </div>
  `;

  /** @type {HTMLVideoElement} */
  const videoEl = container.querySelector('.scanner-video');
  const captureBtn     = container.querySelector('[data-testid="scanner-capture-btn"]');
  const backBtn        = container.querySelector('[data-testid="scanner-toolbar-back"]');
  const switchBtn      = container.querySelector('[data-testid="scanner-toolbar-switch"]');
  const faceLabelEl    = container.querySelector('[data-testid="scanner-face-label"]');
  const faceSubEl      = container.querySelector('[data-testid="scanner-face-sub"]');
  const guideTextEl    = container.querySelector('[data-testid="scanner-guide-text"]');
  const loadingEl      = container.querySelector('[data-testid="scanner-loading"]');
  const lightingDot    = container.querySelector('[data-testid="scanner-lighting-dot"]');
  const lightingText   = container.querySelector('[data-testid="scanner-lighting-text"]');
  const controlsEl     = container.querySelector('.scanner-controls');

  // Cube preview panel
  const preview = createCubePreview({
    onRescan: (faceLabel, index) => {
      faceSequence.jumpToFace(index);
      updateFaceIndicator();
    },
  });
  preview.container.classList.add('scanner-preview-panel');
  container.appendChild(preview.container);

  /** @type {DetectionLoop|null} */
  let loop = null;

  /** @type {HTMLElement|null} */
  let warningBanner = null;

  /** @type {Array<() => void>} */
  const cleanups = [];

  // ── Helpers ─────────────────────────────────────────────────────────────

  function updateFaceIndicator() {
    const face = faceSequence.getCurrentFace();
    const progress = faceSequence.getProgress();
    faceLabelEl.textContent = `${face.icon} Scanning ${face.name} (${face.label})`;
    faceSubEl.textContent   = `Face ${face.index + 1} of 6 — ${progress} confirmed`;
    guideTextEl.textContent = face.instruction;
  }

  function showLoading(show) {
    loadingEl.style.display = show ? 'flex' : 'none';
    captureBtn.disabled = show;
  }

  /** @param {import('../cv/detector.js').LightingAssessment} result */
  function onLighting(result) {
    lightingDot.setAttribute('data-quality', result.quality);

    const labels = { good: 'Good lighting', acceptable: 'Acceptable lighting', poor: 'Poor lighting' };
    lightingText.textContent = labels[result.quality] ?? '';

    if (result.quality === 'poor') {
      showLightingWarning(result.recommendation);
    } else {
      dismissLightingWarning();
    }
  }

  function showLightingWarning(recommendation) {
    if (warningBanner) { return; }
    warningBanner = document.createElement('div');
    warningBanner.className = 'scanner-lighting-warning';
    warningBanner.setAttribute('data-testid', 'scanner-lighting-warning');
    warningBanner.setAttribute('role', 'alert');
    warningBanner.innerHTML = `
      <span>${recommendation}</span>
      <button class="scanner-lighting-warning-dismiss" type="button" aria-label="Dismiss">✕</button>
    `;
    warningBanner.querySelector('button').addEventListener('click', dismissLightingWarning);
    controlsEl.insertBefore(warningBanner, controlsEl.firstChild);
  }

  function dismissLightingWarning() {
    if (warningBanner) {
      warningBanner.remove();
      warningBanner = null;
    }
  }

  function showError(message, onRetry) {
    container.innerHTML = `
      <div class="scanner-error" data-testid="scanner-error">
        <div class="scanner-error-icon">📷</div>
        <h2 class="scanner-error-title">Camera Error</h2>
        <p class="scanner-error-message" data-testid="scanner-error-message">${message}</p>
        <button class="scanner-error-retry" data-testid="scanner-error-retry" type="button">
          Try Again
        </button>
      </div>
    `;
    const retry = container.querySelector('[data-testid="scanner-error-retry"]');
    if (retry && onRetry) { retry.addEventListener('click', onRetry); }
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  async function mount() {
    // Load calibration profile on mount
    calibrationEngine.loadSavedProfile();

    // Update initial face indicator
    updateFaceIndicator();

    // Restore previously scanned faces into the preview
    const results = faceSequence.getResults();
    for (let i = 0; i < 6; i++) {
      if (results[i]) {
        preview.updateFace(FACE_ORDER[i].label, results[i], i);
      }
    }

    // Back button → cancel scanning
    const onBack = () => stateMachine.transition(Action.CANCEL);
    backBtn.addEventListener('click', onBack);
    cleanups.push(() => backBtn.removeEventListener('click', onBack));

    // Camera switch
    const onSwitch = () => cameraManager.switchCamera().then((stream) => {
      videoEl.srcObject = stream;
    }).catch(() => {});
    switchBtn.addEventListener('click', onSwitch);
    cleanups.push(() => switchBtn.removeEventListener('click', onSwitch));

    // Request camera
    let stream;
    try {
      stream = await cameraManager.requestCamera('environment');
    } catch (err) {
      showError(err.userMessage ?? err.message, () => {
        // Reload the scanner view by triggering a fresh navigate
        stateMachine.transition(Action.CANCEL);
      });
      return;
    }

    videoEl.srcObject = stream;

    // Start detection loop
    loop = new DetectionLoop({
      videoEl,
      onLighting,
      onDetected: null,
      onError: null,
    });
    loop.start();

    // Capture button handler
    const onCapture = async () => {
      if (captureBtn.disabled) { return; }
      showLoading(true);

      const result = await loop.capture();
      showLoading(false);

      if (!result) { return; }

      // Wire calibration: use center tile LAB as auto-reference after detection
      if (result.success && result.colors) {
        const face = faceSequence.getCurrentFace();
        faceSequence.setPendingResult(result);

        // Auto-calibration: record center tile as reference for confirmed faces
        stateMachine.transition(Action.FACE_DETECTED, { result, face });
      } else {
        // Detection failed — show a brief message but don't block
        lightingText.textContent = 'No face detected — reposition and try again';
        lightingDot.setAttribute('data-quality', 'poor');
      }
    };

    captureBtn.addEventListener('click', onCapture);
    cleanups.push(() => captureBtn.removeEventListener('click', onCapture));

    preview.mount();
  }

  // ── Unmount ───────────────────────────────────────────────────────────────

  function unmount() {
    if (loop) {
      loop.stop();
      loop = null;
    }
    cameraManager.stopCamera();
    preview.unmount();
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
