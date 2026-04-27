/**
 * Detector — manages the CV worker lifecycle and provides a clean async API.
 * Bridges worker messages to EventBus events (ARCH §3.3 event catalog).
 */

import { eventBus, Events } from '../core/eventBus.js';
import { ErrorCode, AppError } from '../core/errors.js';

/**
 * @typedef {Object} DetectionResult
 * @property {boolean} success
 * @property {string[][]} colors
 * @property {number[][]} confidence
 * @property {{ x: number, y: number }[][]} gridPoints
 * @property {number} overallConfidence
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} LightingAssessment
 * @property {'good'|'acceptable'|'poor'} quality
 * @property {number} brightness
 * @property {number} contrast
 * @property {number} colorCast
 * @property {string} recommendation
 */

export class Detector {
  constructor() {
    /** @type {Worker|null} */
    this._worker = null;

    /** @type {Map<string, { resolve: Function, reject: Function }>} */
    this._pending = new Map();

    this._msgId = 0;
    this._initialized = false;
  }

  /**
   * Initialize the CV worker and load OpenCV.js.
   * @param {function(number, string): void} [onProgress] - (percent, stage) callback
   * @returns {Promise<void>}
   */
  init(onProgress) {
    return new Promise((resolve, reject) => {
      if (this._initialized) { resolve(); return; }

      this._worker = new Worker(new URL('./cv.worker.js', import.meta.url), { type: 'module' });
      this._worker.onmessage = (e) => this._handleMessage(e.data);
      this._worker.onerror = (e) => {
        const err = new AppError(ErrorCode.CV_INIT_FAILED, e.message);
        reject(err);
        this._rejectAll(err);
      };

      // Store the init promise callbacks so the message handler can resolve them
      this._initResolve = resolve;
      this._initReject  = reject;
      this._onProgress  = onProgress;

      this._worker.postMessage({ type: 'INIT' });
    });
  }

  /**
   * Detect a cube face in the given image.
   * Emits `cv:face-detected` or `cv:lighting-warning` on EventBus.
   *
   * @param {ImageData} imageData
   * @param {number} [gridSize=3]
   * @param {'square'|'triangle'|'pentagon'} [faceShape='square']
   * @returns {Promise<DetectionResult>}
   */
  detectFace(imageData, gridSize = 3, faceShape = 'square') {
    return new Promise((resolve, reject) => {
      if (!this._worker) {
        reject(new AppError(ErrorCode.CV_INIT_FAILED, 'Worker not initialized — call init() first'));
        return;
      }

      const id = String(++this._msgId);
      this._pending.set(id, { resolve, reject });

      this._worker.postMessage(
        { type: 'DETECT_FACE', id, payload: { imageData, gridSize, faceShape } },
        [imageData.data.buffer]  // transfer ownership for performance
      );
    });
  }

  /**
   * Assess lighting quality for the given frame.
   * Emits `cv:lighting-warning` on EventBus if quality is poor/acceptable.
   *
   * @param {ImageData} imageData
   * @returns {Promise<LightingAssessment>}
   */
  assessLighting(imageData) {
    return new Promise((resolve, reject) => {
      if (!this._worker) {
        reject(new AppError(ErrorCode.CV_INIT_FAILED, 'Worker not initialized — call init() first'));
        return;
      }

      const id = String(++this._msgId);
      this._pending.set(id, { resolve, reject });

      this._worker.postMessage(
        { type: 'ASSESS_LIGHTING', id, payload: { imageData } },
        [imageData.data.buffer]
      );
    });
  }

  /**
   * Terminate the worker and free resources.
   */
  dispose() {
    if (this._worker) {
      this._worker.postMessage({ type: 'TERMINATE' });
      this._worker.terminate();
      this._worker = null;
    }
    this._pending.clear();
    this._initialized = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal message handler
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * @param {{ type: string, id?: string, payload?: * }} msg
   */
  _handleMessage(msg) {
    const { type, id, payload } = msg;

    switch (type) {
      case 'INIT_PROGRESS':
        if (this._onProgress) { this._onProgress(payload.percent, payload.stage); }
        eventBus.emit(Events.CV_INIT_PROGRESS, payload);
        break;

      case 'INIT_COMPLETE':
        this._initialized = true;
        eventBus.emit(Events.CV_INIT_COMPLETE);
        if (this._initResolve) { this._initResolve(); this._initResolve = null; }
        break;

      case 'DETECTION_RESULT': {
        const pending = this._popPending(id);
        if (!pending) { break; }

        if (payload.success) {
          eventBus.emit(Events.CV_FACE_DETECTED, payload);
        }
        pending.resolve(payload);
        break;
      }

      case 'LIGHTING_RESULT': {
        const pending = this._popPending(id);
        if (payload && payload.quality !== 'good') {
          eventBus.emit(Events.CV_LIGHTING_WARNING, payload);
        }
        if (pending) { pending.resolve(payload); }
        break;
      }

      case 'ERROR': {
        const err = new AppError(payload.code, payload.message);
        const pending = this._popPending(id);
        if (pending) {
          pending.reject(err);
        } else if (this._initReject) {
          this._initReject(err);
          this._initReject = null;
        }
        break;
      }
    }
  }

  /**
   * @param {string|undefined} id
   * @returns {{ resolve: Function, reject: Function }|null}
   */
  _popPending(id) {
    if (!id) { return null; }
    const p = this._pending.get(id);
    if (p) { this._pending.delete(id); }
    return p ?? null;
  }

  /** Reject all in-flight promises with the given error. */
  _rejectAll(err) {
    for (const p of this._pending.values()) {
      p.reject(err);
    }
    this._pending.clear();
    if (this._initReject) {
      this._initReject(err);
      this._initReject = null;
    }
  }
}

/** Singleton instance for convenience. */
export const detector = new Detector();
