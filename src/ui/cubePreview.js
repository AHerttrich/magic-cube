/**
 * CubePreview — unfolded cube-net preview widget.
 * Shows 6 face slots in a cross layout. Scanned faces render actual colored tiles.
 * Tapping a scanned face triggers a re-scan callback.
 *
 * @returns {{ container: HTMLElement, updateFace(label, colors): void, mount(): void, unmount(): void }}
 */

const FACE_LABELS = ['U', 'L', 'F', 'R', 'B', 'D'];

/**
 * Build the 9-cell placeholder grid (grey squares).
 * @returns {HTMLElement}
 */
function buildPlaceholder() {
  const el = document.createElement('div');
  el.className = 'cube-preview-placeholder';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cube-preview-placeholder-cell';
    el.appendChild(cell);
  }
  return el;
}

/**
 * Build a 9-cell colored tile grid for a scanned face.
 * @param {string[][]} colors - 3×3 array of color strings
 * @returns {HTMLElement}
 */
function buildTileGrid(colors) {
  const el = document.createElement('div');
  el.className = 'cube-preview-tiles';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const tile = document.createElement('div');
      tile.className = 'cube-preview-tile';
      const color = colors[r]?.[c] ?? 'white';
      tile.setAttribute('data-color', color);
      el.appendChild(tile);
    }
  }
  return el;
}

/**
 * Creates the unfolded cube preview widget.
 *
 * @param {{
 *   onRescan?: function(label: string, index: number): void,
 * }} [opts]
 * @returns {{ container: HTMLElement, updateFace(label: string, colors: string[][]): void, mount(): void, unmount(): void }}
 */
export function createCubePreview({ onRescan } = {}) {
  const container = document.createElement('div');
  container.className = 'cube-preview';
  container.setAttribute('data-testid', 'cube-preview-root');

  const label = document.createElement('div');
  label.className = 'cube-preview-label';
  label.textContent = 'Scanned faces';

  const net = document.createElement('div');
  net.className = 'cube-preview-net';
  net.setAttribute('data-testid', 'cube-preview-net');
  net.setAttribute('role', 'img');
  net.setAttribute('aria-label', 'Unfolded cube preview');

  container.appendChild(label);
  container.appendChild(net);

  /** @type {Map<string, HTMLElement>} */
  const faceEls = new Map();

  // Build face slots
  for (const faceLabel of FACE_LABELS) {
    const faceEl = document.createElement('div');
    faceEl.className = 'cube-preview-face';
    faceEl.setAttribute('data-face', faceLabel);
    faceEl.setAttribute('data-state', 'empty');
    faceEl.setAttribute('data-testid', `cube-preview-face-${faceLabel.toLowerCase()}`);
    faceEl.setAttribute('aria-label', `${faceLabel} face — not yet scanned`);
    faceEl.appendChild(buildPlaceholder());

    // Badge showing face letter
    const badge = document.createElement('span');
    badge.className = 'cube-preview-face-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = faceLabel;
    faceEl.appendChild(badge);

    net.appendChild(faceEl);
    faceEls.set(faceLabel, faceEl);
  }

  /**
   * Update a face slot with confirmed colors.
   * @param {string} faceLabel - e.g. 'F', 'R', etc.
   * @param {string[][] | null} colors - 3×3 grid, or null to reset to placeholder
   * @param {number} [faceIndex] - sequence index (for onRescan callback)
   */
  function updateFace(faceLabel, colors, faceIndex = -1) {
    const el = faceEls.get(faceLabel);
    if (!el) { return; }

    // Remove all children except badge
    const badge = el.querySelector('.cube-preview-face-badge');
    el.innerHTML = '';
    if (badge) { el.appendChild(badge); }

    if (colors) {
      el.setAttribute('data-state', 'scanned');
      el.setAttribute('aria-label', `${faceLabel} face — scanned. Tap to re-scan.`);
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.insertBefore(buildTileGrid(colors), badge);

      // Re-scan on tap
      const handleActivate = () => {
        if (onRescan) { onRescan(faceLabel, faceIndex); }
      };
      el.onclick = handleActivate;
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      };
    } else {
      el.setAttribute('data-state', 'empty');
      el.setAttribute('aria-label', `${faceLabel} face — not yet scanned`);
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      el.onclick = null;
      el.onkeydown = null;
      el.insertBefore(buildPlaceholder(), badge);
    }
  }

  function mount() {
    // Nothing to initialize
  }

  function unmount() {
    for (const el of faceEls.values()) {
      el.onclick = null;
      el.onkeydown = null;
    }
  }

  return { container, updateFace, mount, unmount };
}
