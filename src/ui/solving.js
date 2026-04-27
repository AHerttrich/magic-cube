/**
 * Solving — runs the Kociemba solver and waits for the solution.
 * Enters on SOLVING state (receives stateString from VALIDATING via params).
 * Exits via SOLVED (→ Solution) or ERROR (→ Landing).
 */
import { stateMachine, Action } from '../core/stateMachine.js';
import { eventBus, Events } from '../core/eventBus.js';
import { solverEngine } from '../solver/solver.js';

/**
 * @param {{ stateString: string }} params
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createSolvingView({ stateString } = {}) {
  const container = document.createElement('div');
  container.className = 'solving-view';
  container.setAttribute('data-testid', 'solving-root');

  container.innerHTML = `
    <div class="solving-card">
      <div class="solving-spinner" aria-hidden="true"></div>
      <h2 class="solving-title" data-testid="solving-title">Calculating optimal solution…</h2>
      <p class="solving-status" data-testid="solving-status"
         aria-live="polite" aria-atomic="true">
        Initializing solver…
      </p>
    </div>
  `;

  const statusEl = container.querySelector('[data-testid="solving-status"]');

  /** @type {Array<() => void>} */
  const cleanups = [];
  let solved = false;

  function mount() {
    if (!stateString) {
      stateMachine.transition(Action.ERROR, {
        error: { code: 'SOL_INIT_FAILED', message: 'No cube state available to solve.' },
      });
      return;
    }

    // Show init progress from the event bus
    const unsubProgress = eventBus.on(Events.SOLVER_INIT_PROGRESS, ({ stage }) => {
      if (!solved && statusEl) {
        statusEl.textContent = stage || 'Working…';
      }
    });

    const unsubReady = eventBus.on(Events.SOLVER_READY, () => {
      if (!solved && statusEl) {
        statusEl.textContent = 'Solver ready — computing solution…';
      }
    });

    cleanups.push(unsubProgress, unsubReady);

    // Kick off solve (init() is called internally if not yet started)
    solverEngine.solve(stateString).then((solution) => {
      solved = true;
      stateMachine.transition(Action.SOLVED, { solution });
    }).catch((err) => {
      solved = true;
      const message = err.message || 'An unexpected solver error occurred.';
      stateMachine.transition(Action.ERROR, {
        error: { code: err.code || 'SOL_UNSOLVABLE', message },
      });
    });
  }

  function unmount() {
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
