/**
 * FaceConfirm — shows the detected color grid and lets the user
 * confirm, edit, or rescan the current face.
 *
 * Enters on FaceConfirm state; exits via RESCAN / EDIT / NEXT_FACE / ALL_FACES_DONE.
 */
import { stateMachine } from '../core/stateMachine.js';
import { Action } from '../core/stateMachine.js';
import { faceSequence } from '../scanner/faceSequence.js';
import { eventBus, Events } from '../core/eventBus.js';

/**
 * @param {{
 *   result: import('../cv/detector.js').DetectionResult,
 *   face: ReturnType<import('../scanner/faceSequence.js').FaceSequence['getCurrentFace']>,
 * }} params
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createFaceConfirmView({ result, face }) {
  const container = document.createElement('div');
  container.className = 'face-confirm';
  container.setAttribute('data-testid', 'face-confirm-root');

  const colors   = result?.colors   ?? Array.from({ length: 3 }, () => ['white', 'white', 'white']);
  const confidence = result?.overallConfidence ?? 0;
  const warnings   = result?.warnings ?? [];

  const pct = Math.round(confidence * 100);
  const confClass = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'low';
  const total = 6;
  const current = face.index + 1;

  container.innerHTML = `
    <div class="face-confirm-header">
      <h2 class="face-confirm-title" data-testid="face-confirm-title">
        ${face.icon} ${face.name} (${face.label}) — Face ${current} of ${total}
      </h2>
      <p class="face-confirm-confidence face-confirm-confidence--${confClass}"
         data-testid="face-confirm-confidence">
        Detection confidence: ${pct}%
      </p>
    </div>

    <div class="face-confirm-grid" data-testid="face-confirm-grid" aria-label="Detected colors">
    </div>

    ${warnings.length > 0 ? `
      <div class="face-confirm-warnings" data-testid="face-confirm-warnings">
        ${warnings.map((w) => `<p class="face-confirm-warning-item">⚠️ ${w}</p>`).join('')}
      </div>
    ` : ''}

    <div class="face-confirm-actions">
      <button class="face-confirm-btn-rescan btn btn-secondary"
              data-testid="face-confirm-btn-rescan"
              type="button">
        🔄 Rescan
      </button>
      <button class="face-confirm-btn-edit btn btn-secondary"
              data-testid="face-confirm-btn-edit"
              type="button">
        ✏️ Edit
      </button>
      <button class="face-confirm-btn-confirm btn btn-primary"
              data-testid="face-confirm-btn-confirm"
              type="button">
        ${face.index < 5 ? '✅ Confirm' : '🎉 All Done!'}
      </button>
    </div>
  `;

  // Build the color grid
  const gridEl = container.querySelector('.face-confirm-grid');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const tile = document.createElement('div');
      tile.className = 'face-confirm-tile';
      const color = colors[r]?.[c] ?? 'white';
      tile.setAttribute('data-color', color);
      tile.setAttribute('data-testid', `face-confirm-tile-${r}-${c}`);
      tile.setAttribute('title', color);
      gridEl.appendChild(tile);
    }
  }

  /** @type {Array<() => void>} */
  const cleanups = [];

  function mount() {
    const btnRescan  = container.querySelector('[data-testid="face-confirm-btn-rescan"]');
    const btnEdit    = container.querySelector('[data-testid="face-confirm-btn-edit"]');
    const btnConfirm = container.querySelector('[data-testid="face-confirm-btn-confirm"]');

    const onRescan = () => {
      faceSequence.rescan();
      stateMachine.transition(Action.RESCAN);
    };

    const onEdit = () => {
      stateMachine.transition(Action.EDIT, { colors, face });
    };

    const onConfirm = () => {
      faceSequence.confirmFace(colors);
      eventBus.emit(Events.SCANNER_FACE_CONFIRMED, { face, colors });

      if (faceSequence.isComplete()) {
        eventBus.emit(Events.SCANNER_SEQUENCE_COMPLETE, { results: faceSequence.getResults() });
        stateMachine.transition(Action.ALL_FACES_DONE);
      } else {
        stateMachine.transition(Action.NEXT_FACE);
      }
    };

    btnRescan.addEventListener('click', onRescan);
    btnEdit.addEventListener('click', onEdit);
    btnConfirm.addEventListener('click', onConfirm);

    cleanups.push(
      () => btnRescan.removeEventListener('click', onRescan),
      () => btnEdit.removeEventListener('click', onEdit),
      () => btnConfirm.removeEventListener('click', onConfirm),
    );
  }

  function unmount() {
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
