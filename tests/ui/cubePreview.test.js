/**
 * CubePreview unit tests.
 * Covers: net rendering, face slot states (empty/scanned),
 * tile color rendering, tap-to-rescan callback, reset to placeholder.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCubePreview } from '../../src/ui/cubePreview.js';

describe('createCubePreview', () => {
  /** @type {ReturnType<typeof createCubePreview>} */
  let preview;

  beforeEach(() => {
    preview = createCubePreview();
    preview.mount();
  });

  // ── DOM structure ─────────────────────────────────────────────────────────

  it('renders a root container with data-testid="cube-preview-root"', () => {
    expect(preview.container.getAttribute('data-testid')).toBe('cube-preview-root');
  });

  it('renders a net element with data-testid="cube-preview-net"', () => {
    const net = preview.container.querySelector('[data-testid="cube-preview-net"]');
    expect(net).not.toBeNull();
  });

  it('renders exactly 6 face slots', () => {
    const faces = preview.container.querySelectorAll('.cube-preview-face');
    expect(faces).toHaveLength(6);
  });

  it('each face slot has the correct data-face attribute', () => {
    const expectedFaces = ['U', 'L', 'F', 'R', 'B', 'D'];
    for (const label of expectedFaces) {
      const el = preview.container.querySelector(`[data-face="${label}"]`);
      expect(el, `face ${label} should exist`).not.toBeNull();
    }
  });

  it('all face slots start in "empty" state', () => {
    const faces = preview.container.querySelectorAll('[data-state="empty"]');
    expect(faces).toHaveLength(6);
  });

  it('each face has a data-testid attribute', () => {
    for (const label of ['U', 'L', 'F', 'R', 'B', 'D']) {
      const el = preview.container.querySelector(`[data-testid="cube-preview-face-${label.toLowerCase()}"]`);
      expect(el, `testid for ${label}`).not.toBeNull();
    }
  });

  // ── updateFace — scanned ──────────────────────────────────────────────────

  it('updateFace() transitions face to "scanned" state', () => {
    const colors = [
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
      ['red', 'red', 'red'],
    ];
    preview.updateFace('F', colors, 0);
    const faceEl = preview.container.querySelector('[data-face="F"]');
    expect(faceEl.getAttribute('data-state')).toBe('scanned');
  });

  it('updateFace() renders a tile grid with correct color attributes', () => {
    const colors = [
      ['red',   'blue',  'green'],
      ['white', 'yellow','orange'],
      ['red',   'blue',  'green'],
    ];
    preview.updateFace('F', colors, 0);

    const tiles = preview.container.querySelectorAll('[data-face="F"] .cube-preview-tile');
    expect(tiles).toHaveLength(9);

    const colorOrder = ['red', 'blue', 'green', 'white', 'yellow', 'orange', 'red', 'blue', 'green'];
    tiles.forEach((tile, i) => {
      expect(tile.getAttribute('data-color')).toBe(colorOrder[i]);
    });
  });

  it('updateFace() removes placeholder on scanned state', () => {
    const colors = Array.from({ length: 3 }, () => ['blue', 'blue', 'blue']);
    preview.updateFace('R', colors, 1);
    const placeholder = preview.container.querySelector('[data-face="R"] .cube-preview-placeholder');
    expect(placeholder).toBeNull();
  });

  it('updateFace() updates the aria-label', () => {
    const colors = Array.from({ length: 3 }, () => ['white', 'white', 'white']);
    preview.updateFace('U', colors, 4);
    const faceEl = preview.container.querySelector('[data-face="U"]');
    expect(faceEl.getAttribute('aria-label')).toMatch(/scanned/i);
  });

  // ── updateFace — reset to placeholder ────────────────────────────────────

  it('updateFace(null) resets face back to empty/placeholder state', () => {
    const colors = Array.from({ length: 3 }, () => ['green', 'green', 'green']);
    preview.updateFace('D', colors, 5);
    // Now reset
    preview.updateFace('D', null, 5);

    const faceEl = preview.container.querySelector('[data-face="D"]');
    expect(faceEl.getAttribute('data-state')).toBe('empty');
    const placeholder = faceEl.querySelector('.cube-preview-placeholder');
    expect(placeholder).not.toBeNull();
    const tiles = faceEl.querySelectorAll('.cube-preview-tile');
    expect(tiles).toHaveLength(0);
  });

  // ── tap-to-rescan ─────────────────────────────────────────────────────────

  it('calls onRescan with face label and index when a scanned face is clicked', () => {
    const onRescan = vi.fn();
    const p = createCubePreview({ onRescan });
    p.mount();

    const colors = Array.from({ length: 3 }, () => ['yellow', 'yellow', 'yellow']);
    p.updateFace('L', colors, 1);

    const faceEl = p.container.querySelector('[data-face="L"]');
    faceEl.click();

    expect(onRescan).toHaveBeenCalledWith('L', 1);
  });

  it('does not call onRescan when an empty face is clicked', () => {
    const onRescan = vi.fn();
    const p = createCubePreview({ onRescan });
    p.mount();

    const faceEl = p.container.querySelector('[data-face="B"]');
    faceEl.click();

    expect(onRescan).not.toHaveBeenCalled();
  });

  // ── unmount cleanup ────────────────────────────────────────────────────────

  it('unmount() removes click handlers so onRescan is no longer called', () => {
    const onRescan = vi.fn();
    const p = createCubePreview({ onRescan });
    p.mount();

    const colors = Array.from({ length: 3 }, () => ['orange', 'orange', 'orange']);
    p.updateFace('B', colors, 2);

    p.unmount();

    const faceEl = p.container.querySelector('[data-face="B"]');
    faceEl.click();
    expect(onRescan).not.toHaveBeenCalled();
  });

  // ── Multiple faces ────────────────────────────────────────────────────────

  it('can update all 6 faces independently', () => {
    const faces = ['U', 'L', 'F', 'R', 'B', 'D'];
    const colorPalette = ['red', 'orange', 'blue', 'green', 'white', 'yellow'];

    faces.forEach((label, i) => {
      const colors = Array.from({ length: 3 }, () => new Array(3).fill(colorPalette[i]));
      preview.updateFace(label, colors, i);
    });

    const scannedFaces = preview.container.querySelectorAll('[data-state="scanned"]');
    expect(scannedFaces).toHaveLength(6);
  });
});
