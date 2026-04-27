/**
 * CameraManager — wraps getUserMedia with graceful error handling and EventBus integration.
 */
import { eventBus, Events } from '../core/eventBus.js';

/**
 * @param {Error} err
 * @returns {string}
 */
function _cameraErrorMessage(err) {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Camera access was denied. Please allow camera permissions in your browser settings and reload.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No camera found. Please connect a camera and try again.';
  }
  if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    return 'Camera is in use by another application. Please close other apps using the camera.';
  }
  if (err.name === 'OverconstrainedError') {
    return 'Camera does not support the requested settings. Trying with default settings.';
  }
  return `Could not access camera: ${err.message}`;
}

export class CameraManager {
  constructor() {
    /** @type {MediaStream|null} */
    this._stream = null;

    /** @type {'user'|'environment'} */
    this._facingMode = 'environment';
  }

  /**
   * Request camera access. Prefers rear camera on mobile (uses `ideal` not `exact`
   * so desktop webcams still work).
   * Emits `scanner:camera-ready` on success, `scanner:camera-error` on failure.
   *
   * @param {'user'|'environment'} [facingMode='environment']
   * @returns {Promise<MediaStream>}
   */
  async requestCamera(facingMode = 'environment') {
    this._facingMode = facingMode;

    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width:  { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._stream = stream;
      eventBus.emit(Events.SCANNER_CAMERA_READY, { stream });
      return stream;
    } catch (err) {
      const message = _cameraErrorMessage(err);
      eventBus.emit(Events.SCANNER_CAMERA_ERROR, { error: err, message });
      throw Object.assign(err, { userMessage: message });
    }
  }

  /**
   * Toggle between front and rear camera.
   * @returns {Promise<MediaStream>}
   */
  async switchCamera() {
    this.stopCamera();
    const next = this._facingMode === 'environment' ? 'user' : 'environment';
    return this.requestCamera(next);
  }

  /**
   * Stop all active camera tracks and release the stream.
   */
  stopCamera() {
    if (this._stream) {
      for (const track of this._stream.getTracks()) {
        track.stop();
      }
      this._stream = null;
    }
  }

  /**
   * Returns the active track's capabilities (zoom, torch, focusMode, etc.)
   * or null if no stream is active.
   * @returns {MediaTrackCapabilities|null}
   */
  getCapabilities() {
    if (!this._stream) { return null; }
    const track = this._stream.getVideoTracks()[0];
    if (!track) { return null; }
    return typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
  }

  /** @returns {boolean} */
  isActive() {
    return this._stream !== null;
  }

  /** @returns {'user'|'environment'} */
  getFacingMode() {
    return this._facingMode;
  }
}

/** Singleton shared across scanner views. */
export const cameraManager = new CameraManager();
