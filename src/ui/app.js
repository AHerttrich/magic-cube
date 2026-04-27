/**
 * App — application shell.
 * Renders the header (logo + theme toggle) and a <main> content area.
 * Listens to ui:navigate events from the state machine and swaps views.
 */
import { eventBus, Events } from '../core/eventBus.js';
import { stateMachine } from '../core/stateMachine.js';
import { createThemeToggle } from './themeToggle.js';
import { createLandingView } from './landing.js';
import { createScannerView } from './scanner.js';
import { createFaceConfirmView } from './faceConfirm.js';
import { createFaceEditorView } from './faceEditor.js';
import { createValidatingView } from './validating.js';
import { createSolvingView } from './solving.js';
import { createSolutionView } from './solution.js';
import { faceSequence } from '../scanner/faceSequence.js';

/**
 * Mounts the full application into the given root element.
 * @param {HTMLElement} root
 * @returns {{ dispose: function(): void }}
 */
export function createApp(root) {
  // ── Build shell ──────────────────────────────────────────────────────────

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header" role="banner">
        <div class="app-header-inner">
          <a href="/" class="app-logo" data-testid="app-logo" aria-label="Magic Cube Solver home">
            <span class="app-logo-icon" aria-hidden="true">🧊</span>
            <span class="app-logo-text">Magic Cube Solver</span>
          </a>
          <div class="app-header-actions" id="header-actions"></div>
        </div>
      </header>
      <main class="app-main" id="app-main" role="main"></main>
    </div>
  `;

  const headerActions = root.querySelector('#header-actions');
  const mainEl = root.querySelector('#app-main');

  // ── Theme toggle ──────────────────────────────────────────────────────────

  const themeToggle = createThemeToggle();
  headerActions.appendChild(themeToggle.element);

  // ── View management ───────────────────────────────────────────────────────

  /** @type {{ unmount?: function(): void }|null} */
  let currentView = null;

  /**
   * Replaces the current view with the view for the given state name.
   * @param {string} stateName
   * @param {object} [_params]
   */
  function setView(stateName, _params = {}) {
    // Unmount previous view
    if (currentView && typeof currentView.unmount === 'function') {
      currentView.unmount();
    }
    mainEl.innerHTML = '';
    currentView = null;

    switch (stateName) {
      case 'Landing': {
        const view = createLandingView();
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      case 'Scanning': {
        const validationError = _params.errors
          ? _params.errors.map((e) => e.message).join(' ')
          : null;
        const view = createScannerView({ validationError });
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      case 'FaceConfirm': {
        const result = _params.result ?? faceSequence.getPendingResult() ?? { colors: [], overallConfidence: 0, warnings: [] };
        const face   = _params.face   ?? faceSequence.getCurrentFace();
        const view = createFaceConfirmView({ result, face });
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      case 'FaceEdit': {
        const colors = _params.colors ?? [['white','white','white'],['white','white','white'],['white','white','white']];
        const face   = _params.face   ?? faceSequence.getCurrentFace();
        const view = createFaceEditorView({ colors, face });
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      case 'Validating': {
        const view = createValidatingView();
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      case 'Solving': {
        const stateString = _params.stateString ?? '';
        const view = createSolvingView({ stateString });
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      case 'Solution': {
        const solution = _params.solution ?? null;
        const view = createSolutionView({ solution });
        mainEl.appendChild(view.container);
        view.mount();
        currentView = view;
        break;
      }

      default: {
        // Placeholder for views not yet implemented
        const placeholder = document.createElement('div');
        placeholder.className = 'coming-soon';
        placeholder.setAttribute('data-testid', `view-${stateName.toLowerCase()}-placeholder`);
        placeholder.textContent = `🚧 ${stateName} — Coming Soon`;
        mainEl.appendChild(placeholder);
        currentView = null;
        break;
      }
    }

  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  const unsubNavigate = eventBus.on(Events.UI_NAVIGATE, ({ view, params: navParams }) => {
    setView(view, navParams);
  });

  // ── Initial render ────────────────────────────────────────────────────────

  setView(stateMachine.getState());

  // ── Cleanup ───────────────────────────────────────────────────────────────

  return {
    dispose() {
      unsubNavigate();
      themeToggle.dispose();
      if (currentView && typeof currentView.unmount === 'function') {
        currentView.unmount();
      }
    },
  };
}
