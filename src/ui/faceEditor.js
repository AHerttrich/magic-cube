/**
 * FaceEditor — manual color correction for a single face.
 * Tapping a tile cycles through the 6 Rubik's colors.
 * Exits via CONFIRM_EDIT or CANCEL.
 */
import { stateMachine, Action } from '../core/stateMachine.js';

/** Ordered cycle of the 6 Rubik's cube colors. */
const COLOR_CYCLE = ['white', 'red', 'blue', 'orange', 'green', 'yellow'];

/** Display names for the color legend. */
const COLOR_NAMES = {
  white:  'White',
  yellow: 'Yellow',
  red:    'Red',
  orange: 'Orange',
  blue:   'Blue',
  green:  'Green',
};

/**
 * @param {string} current
 * @returns {string} next color in cycle
 */
function nextColor(current) {
  const idx = COLOR_CYCLE.indexOf(current);
  return COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length];
}

/**
 * @param {{
 *   colors: string[][],
 *   face: { label: string, name: string, icon: string, index: number },
 * }} params
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createFaceEditorView({ colors: initialColors, face }) {
  const container = document.createElement('div');
  container.className = 'face-editor';
  container.setAttribute('data-testid', 'face-editor-root');

  // Deep-copy working state so we don't mutate the source
  const working = initialColors.map((row) => [...row]);

  container.innerHTML = `
    <div class="face-editor-header">
      <h2 class="face-editor-title" data-testid="face-editor-title">
        Edit ${face.icon} ${face.name} (${face.label})
      </h2>
    </div>
    <p class="face-editor-subtitle">
      Tap each square to cycle through the 6 colours.
    </p>

    <div class="face-editor-grid" data-testid="face-editor-grid" role="grid"
         aria-label="Colour editor grid">
    </div>

    <p class="face-editor-hint">
      Tap once to step forward · All 6 Rubik's colours available
    </p>

    <div class="face-editor-legend" data-testid="face-editor-legend">
      ${COLOR_CYCLE.map((c) => `
        <span class="face-editor-legend-item">
          <span class="face-editor-legend-swatch" data-color="${c}"></span>
          <span>${COLOR_NAMES[c]}</span>
        </span>
      `).join('')}
    </div>

    <div class="face-editor-actions">
      <button class="face-editor-btn-cancel"
              data-testid="face-editor-btn-cancel"
              type="button">
        Cancel
      </button>
      <button class="face-editor-btn-done btn btn-primary"
              data-testid="face-editor-btn-done"
              type="button">
        Done ✓
      </button>
    </div>
  `;

  // Build the 3×3 tile grid
  const gridEl = container.querySelector('.face-editor-grid');

  /** @type {HTMLElement[]} */
  const tileEls = [];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const tile = document.createElement('button');
      tile.className = 'face-editor-tile';
      tile.type = 'button';
      tile.setAttribute('data-row', String(r));
      tile.setAttribute('data-col', String(c));
      tile.setAttribute('data-testid', `face-editor-tile-${r}-${c}`);
      tile.setAttribute('data-color', working[r][c]);
      tile.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}: ${COLOR_NAMES[working[r][c]]}`);
      tile.setAttribute('role', 'gridcell');

      // Tooltip
      const tooltip = document.createElement('span');
      tooltip.className = 'face-editor-tooltip';
      tooltip.setAttribute('aria-hidden', 'true');
      tooltip.textContent = COLOR_NAMES[working[r][c]];
      tile.appendChild(tooltip);

      gridEl.appendChild(tile);
      tileEls.push(tile);
    }
  }

  /** @type {Array<() => void>} */
  const cleanups = [];

  /**
   * Apply the current working color to a tile element.
   * @param {HTMLElement} tile
   * @param {number} r
   * @param {number} c
   */
  function applyColor(tile, r, c) {
    const color = working[r][c];
    tile.setAttribute('data-color', color);
    tile.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}: ${COLOR_NAMES[color]}`);
    const tt = tile.querySelector('.face-editor-tooltip');
    if (tt) { tt.textContent = COLOR_NAMES[color]; }

    // Flash animation
    tile.classList.remove('is-flashing');
    // Force reflow to restart animation
    void tile.offsetWidth;
    tile.classList.add('is-flashing');
    tile.addEventListener('animationend', () => tile.classList.remove('is-flashing'), { once: true });
  }

  function mount() {
    // Wire tile clicks
    for (const tile of tileEls) {
      const r = Number(tile.dataset.row);
      const c = Number(tile.dataset.col);

      const onClick = () => {
        working[r][c] = nextColor(working[r][c]);
        applyColor(tile, r, c);
      };

      tile.addEventListener('click', onClick);
      cleanups.push(() => tile.removeEventListener('click', onClick));
    }

    // Done
    const btnDone = container.querySelector('[data-testid="face-editor-btn-done"]');
    const onDone = () => {
      stateMachine.transition(Action.CONFIRM_EDIT, {
        colors: working.map((row) => [...row]),
        face,
      });
    };
    btnDone.addEventListener('click', onDone);
    cleanups.push(() => btnDone.removeEventListener('click', onDone));

    // Cancel
    const btnCancel = container.querySelector('[data-testid="face-editor-btn-cancel"]');
    const onCancel = () => {
      stateMachine.transition(Action.CANCEL, { face });
    };
    btnCancel.addEventListener('click', onCancel);
    cleanups.push(() => btnCancel.removeEventListener('click', onCancel));
  }

  function unmount() {
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
