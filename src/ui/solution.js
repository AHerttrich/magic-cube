/**
 * Solution — displays the optimal move sequence after solving.
 * Enters on SOLUTION state (receives solution from SOLVING via params).
 * Exits via SOLVE_ANOTHER (→ Scanning) or HOME (→ Landing).
 */
import { stateMachine, Action } from '../core/stateMachine.js';

const GOD_NUMBER = 20;

/**
 * @param {{ solution: import('../solver/solver.js').Solution }} params
 * @returns {{ container: HTMLElement, mount(): void, unmount(): void }}
 */
export function createSolutionView({ solution } = {}) {
  const container = document.createElement('div');
  container.className = 'solution-view';
  container.setAttribute('data-testid', 'solution-root');

  const moves = solution?.moves ?? [];
  const moveCount = solution?.moveCount ?? moves.length;
  const solveTimeMs = solution?.solveTimeMs ?? 0;
  const efficiency = solution?.stats?.efficiency ?? Math.round((moveCount / GOD_NUMBER) * 100);

  const solveTimeSec = (solveTimeMs / 1000).toFixed(2);

  container.innerHTML = `
    <div class="solution-header">
      <h2 class="solution-title" data-testid="solution-title">
        Solution found!
      </h2>
      <div class="solution-stats" data-testid="solution-stats">
        <span class="solution-stat solution-stat--moves" data-testid="solution-stat-moves">
          ${moveCount} moves
        </span>
        <span class="solution-stat solution-stat--gods" data-testid="solution-stat-gods">
          God's Number ≤ ${GOD_NUMBER}
        </span>
        <span class="solution-stat solution-stat--time" data-testid="solution-stat-time">
          Solved in ${solveTimeSec}s
        </span>
      </div>
      <div class="solution-efficiency" data-testid="solution-efficiency">
        <div class="solution-efficiency-bar">
          <div class="solution-efficiency-fill" style="width: ${Math.min(efficiency, 100)}%"></div>
        </div>
        <span class="solution-efficiency-label">Efficiency: ${efficiency}% of God's Number</span>
      </div>
    </div>

    <div class="solution-moves-section">
      <h3 class="solution-moves-heading">Move Sequence</h3>
      <div class="solution-moves" data-testid="solution-moves" role="list" aria-label="Solution moves">
        ${moves.length > 0
          ? moves.map((move, i) => `
            <span class="solution-move" data-testid="solution-move-${i}" role="listitem"
                  title="Move ${i + 1} of ${moveCount}">
              ${move}
            </span>
          `).join('')
          : '<span class="solution-move solution-move--empty">Already solved!</span>'
        }
      </div>
      <p class="solution-moves-notation" data-testid="solution-notation">
        <code>${moves.join(' ') || '—'}</code>
      </p>
    </div>

    <div class="solution-actions">
      <button class="btn btn-secondary solution-btn-home"
              data-testid="solution-btn-home"
              type="button">
        Home
      </button>
      <button class="btn btn-primary solution-btn-another"
              data-testid="solution-btn-another"
              type="button">
        Solve Another Cube
      </button>
    </div>
  `;

  /** @type {Array<() => void>} */
  const cleanups = [];

  function mount() {
    const btnHome    = container.querySelector('[data-testid="solution-btn-home"]');
    const btnAnother = container.querySelector('[data-testid="solution-btn-another"]');

    const onHome = () => {
      stateMachine.transition(Action.HOME);
    };

    const onAnother = () => {
      stateMachine.transition(Action.SOLVE_ANOTHER);
    };

    btnHome.addEventListener('click', onHome);
    btnAnother.addEventListener('click', onAnother);

    cleanups.push(
      () => btnHome.removeEventListener('click', onHome),
      () => btnAnother.removeEventListener('click', onAnother),
    );
  }

  function unmount() {
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
