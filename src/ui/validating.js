/**
 * Validating — verifies 6 scanned faces form a valid cube state.
 * Enters on VALIDATING state; exits via VALID (→ Solving) or INVALID (→ Scanning).
 */
import { stateMachine, Action } from '../core/stateMachine.js';
import { faceSequence } from '../scanner/faceSequence.js';
import { validateColors, buildStateString } from '../solver/validator.js';

/**
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createValidatingView() {
  const container = document.createElement('div');
  container.className = 'validating-view';
  container.setAttribute('data-testid', 'validating-root');

  container.innerHTML = `
    <div class="validating-card">
      <div class="validating-spinner" aria-hidden="true"></div>
      <h2 class="validating-title" data-testid="validating-title">Validating cube state…</h2>
      <p class="validating-subtitle" data-testid="validating-subtitle"
         aria-live="polite" aria-atomic="true">
        Checking color counts and piece validity
      </p>
    </div>
  `;

  let rafId = null;

  function mount() {
    // Defer one frame so the spinner renders before CPU work starts
    rafId = requestAnimationFrame(() => {
      _runValidation();
    });
  }

  function _runValidation() {
    const faces = faceSequence.getResults();

    // Ensure all faces are scanned
    if (faces.some((f) => f === null)) {
      stateMachine.transition(Action.INVALID, {
        errors: [{
          type: 'COLOR_COUNT',
          message: 'Not all faces have been scanned. Please complete the scanning process.',
        }],
      });
      return;
    }

    const result = validateColors(faces);

    if (!result.valid) {
      stateMachine.transition(Action.INVALID, { errors: result.errors });
      return;
    }

    let stateString;
    try {
      stateString = buildStateString(faces);
    } catch (err) {
      stateMachine.transition(Action.INVALID, {
        errors: [{
          type: 'INVALID_PIECE',
          message: `State encoding failed: ${err.message}`,
        }],
      });
      return;
    }

    stateMachine.transition(Action.VALID, { stateString });
  }

  function unmount() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return { container, mount, unmount };
}
