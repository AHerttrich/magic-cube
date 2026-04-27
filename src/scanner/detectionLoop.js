/**
 * DetectionLoop — throttled rAF loop that drives lighting assessment
 * and on-demand face detection via the Detector worker.
 */
import { detector } from '../cv/detector.js';

const LIGHTING_INTERVAL_MS = 2000;

export class DetectionLoop {
  /**
   * @param {{
   *   videoEl: HTMLVideoElement,
   *   onLighting?: function(import('../cv/detector.js').LightingAssessment): void,
   *   onDetected?: function(import('../cv/detector.js').DetectionResult): void,
   *   onError?: function(Error): void,
   * }} opts
   */
  constructor({ videoEl, onLighting, onDetected, onError }) {
    this._video      = videoEl;
    this._onLighting = onLighting ?? null;
    this._onDetected = onDetected ?? null;
    this._onError    = onError    ?? null;

    this._running  = false;
    this._rafId    = null;
    this._lastLightingTs = 0;

    this._offscreen = document.createElement('canvas');
    this._offCtx    = null;

    this._detectPending = false;
  }

  /** Start the rAF loop. */
  start() {
    if (this._running) { return; }
    this._running = true;
    this._offCtx  = this._offscreen.getContext('2d');
    this._tick();
  }

  /** Stop the loop and cancel any pending animation frame. */
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Capture the current video frame and send it to the detector.
   * Called by the "Capture" button handler — not on every frame.
   * @returns {Promise<import('../cv/detector.js').DetectionResult|null>}
   */
  async capture() {
    const imageData = this._grabFrame();
    if (!imageData) { return null; }

    try {
      const result = await detector.detectFace(imageData);
      if (this._onDetected) { this._onDetected(result); }
      return result;
    } catch (err) {
      if (this._onError) { this._onError(err); }
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────────────────────

  _tick() {
    if (!this._running) { return; }

    const now = performance.now();
    if (now - this._lastLightingTs > LIGHTING_INTERVAL_MS) {
      this._lastLightingTs = now;
      this._assessLighting();
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }

  _grabFrame() {
    if (!this._video || this._video.readyState < HTMLVideoElement.HAVE_CURRENT_DATA) {
      return null;
    }
    const { videoWidth: w, videoHeight: h } = this._video;
    if (w === 0 || h === 0) { return null; }

    this._offscreen.width  = w;
    this._offscreen.height = h;
    this._offCtx.drawImage(this._video, 0, 0, w, h);
    return this._offCtx.getImageData(0, 0, w, h);
  }

  async _assessLighting() {
    const imageData = this._grabFrame();
    if (!imageData) { return; }

    try {
      const result = await detector.assessLighting(imageData);
      if (this._onLighting) { this._onLighting(result); }
    } catch {
      // Lighting assessment errors are non-fatal — ignore silently.
    }
  }
}
