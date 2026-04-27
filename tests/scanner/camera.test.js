/**
 * CameraManager unit tests.
 * Covers: getUserMedia constraints, permission errors, NotFoundError,
 * stopCamera cleanup, switchCamera, getCapabilities, EventBus events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraManager } from '../../src/scanner/camera.js';
import { eventBus, Events } from '../../src/core/eventBus.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a fake MediaStream with controllable tracks. */
function makeFakeStream(trackCount = 1) {
  const tracks = Array.from({ length: trackCount }, () => ({
    stop: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({ zoom: { min: 1, max: 5 } }),
  }));
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
    _tracks: tracks,
  };
}

/** Build an error with a given name. */
function makeMediaError(name, message = 'Error') {
  const err = new Error(message);
  err.name = name;
  return err;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CameraManager', () => {
  let camera;
  let getUserMediaMock;

  beforeEach(() => {
    camera = new CameraManager();

    // Mock navigator.mediaDevices.getUserMedia
    getUserMediaMock = vi.fn();
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    camera.stopCamera();
    vi.restoreAllMocks();
    eventBus.clear();
  });

  // ── requestCamera ─────────────────────────────────────────────────────────

  it('calls getUserMedia with ideal environment facing mode', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);

    await camera.requestCamera('environment');

    expect(getUserMediaMock).toHaveBeenCalledOnce();
    const [constraints] = getUserMediaMock.mock.calls[0];
    expect(constraints.video.facingMode).toEqual({ ideal: 'environment' });
  });

  it('includes ideal width and height constraints', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);

    await camera.requestCamera();

    const [constraints] = getUserMediaMock.mock.calls[0];
    expect(constraints.video.width).toEqual({ ideal: 1280 });
    expect(constraints.video.height).toEqual({ ideal: 720 });
  });

  it('returns the stream on success', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);

    const result = await camera.requestCamera();
    expect(result).toBe(stream);
  });

  it('emits scanner:camera-ready on success', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);
    const spy = vi.fn();
    eventBus.on(Events.SCANNER_CAMERA_READY, spy);

    await camera.requestCamera();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ stream }));
  });

  // ── Permission denied ─────────────────────────────────────────────────────

  it('throws and emits scanner:camera-error on NotAllowedError', async () => {
    getUserMediaMock.mockRejectedValue(makeMediaError('NotAllowedError'));
    const errorSpy = vi.fn();
    eventBus.on(Events.SCANNER_CAMERA_ERROR, errorSpy);

    await expect(camera.requestCamera()).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledOnce();
    const { message } = errorSpy.mock.calls[0][0];
    expect(message).toMatch(/denied/i);
  });

  it('attaches a userMessage to the thrown error for NotAllowedError', async () => {
    getUserMediaMock.mockRejectedValue(makeMediaError('NotAllowedError'));

    await camera.requestCamera().catch((err) => {
      expect(err.userMessage).toMatch(/denied/i);
    });
  });

  // ── No camera ─────────────────────────────────────────────────────────────

  it('throws with user-friendly message for NotFoundError', async () => {
    getUserMediaMock.mockRejectedValue(makeMediaError('NotFoundError'));
    const errorSpy = vi.fn();
    eventBus.on(Events.SCANNER_CAMERA_ERROR, errorSpy);

    await expect(camera.requestCamera()).rejects.toThrow();
    const { message } = errorSpy.mock.calls[0][0];
    expect(message).toMatch(/no camera/i);
  });

  // ── Camera in use ─────────────────────────────────────────────────────────

  it('emits user-friendly message for NotReadableError', async () => {
    getUserMediaMock.mockRejectedValue(makeMediaError('NotReadableError'));
    const errorSpy = vi.fn();
    eventBus.on(Events.SCANNER_CAMERA_ERROR, errorSpy);

    await expect(camera.requestCamera()).rejects.toThrow();
    const { message } = errorSpy.mock.calls[0][0];
    expect(message).toMatch(/in use/i);
  });

  // ── stopCamera ────────────────────────────────────────────────────────────

  it('stopCamera() calls stop() on all tracks', async () => {
    const stream = makeFakeStream(2);
    getUserMediaMock.mockResolvedValue(stream);
    await camera.requestCamera();

    camera.stopCamera();

    for (const track of stream._tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
  });

  it('stopCamera() sets isActive() to false', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);
    await camera.requestCamera();
    expect(camera.isActive()).toBe(true);

    camera.stopCamera();
    expect(camera.isActive()).toBe(false);
  });

  it('stopCamera() is a no-op if no stream is active', () => {
    expect(() => camera.stopCamera()).not.toThrow();
  });

  // ── switchCamera ──────────────────────────────────────────────────────────

  it('switchCamera() toggles facing mode from environment to user', async () => {
    const stream1 = makeFakeStream();
    const stream2 = makeFakeStream();
    getUserMediaMock
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);

    await camera.requestCamera('environment');
    await camera.switchCamera();

    expect(camera.getFacingMode()).toBe('user');

    const secondCall = getUserMediaMock.mock.calls[1][0];
    expect(secondCall.video.facingMode).toEqual({ ideal: 'user' });
  });

  it('switchCamera() stops the previous stream tracks', async () => {
    const stream1 = makeFakeStream();
    const stream2 = makeFakeStream();
    getUserMediaMock
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);

    await camera.requestCamera('environment');
    await camera.switchCamera();

    for (const track of stream1._tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
  });

  // ── getCapabilities ───────────────────────────────────────────────────────

  it('getCapabilities() returns null when no stream is active', () => {
    expect(camera.getCapabilities()).toBeNull();
  });

  it('getCapabilities() returns track capabilities when active', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);
    await camera.requestCamera();

    const caps = camera.getCapabilities();
    expect(caps).toBeDefined();
  });

  // ── isActive / getFacingMode ──────────────────────────────────────────────

  it('isActive() returns false before requesting camera', () => {
    expect(camera.isActive()).toBe(false);
  });

  it('getFacingMode() defaults to environment', () => {
    expect(camera.getFacingMode()).toBe('environment');
  });

  it('getFacingMode() reflects the facing mode passed to requestCamera', async () => {
    const stream = makeFakeStream();
    getUserMediaMock.mockResolvedValue(stream);
    await camera.requestCamera('user');
    expect(camera.getFacingMode()).toBe('user');
  });
});
