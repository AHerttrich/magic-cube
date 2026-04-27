/**
 * StateMachine — application flow FSM from ARCH §3.2.
 * Emits `ui:navigate` via EventBus on every valid state transition.
 *
 * States: Landing → PuzzleSelect → Scanning → FaceConfirm → FaceEdit
 *       → Validating → Solving → Solution
 */
import { eventBus, Events } from './eventBus.js';

/**
 * Valid application states.
 * @enum {string}
 */
export const AppState = {
  LANDING: 'Landing',
  PUZZLE_SELECT: 'PuzzleSelect',
  SCANNING: 'Scanning',
  FACE_CONFIRM: 'FaceConfirm',
  FACE_EDIT: 'FaceEdit',
  VALIDATING: 'Validating',
  SOLVING: 'Solving',
  SOLUTION: 'Solution',
};

/**
 * Valid action tokens for transitions.
 * @enum {string}
 */
export const Action = {
  SELECT_PUZZLE: 'SELECT_PUZZLE',
  START_SCAN: 'START_SCAN',
  BACK: 'BACK',
  FACE_DETECTED: 'FACE_DETECTED',
  RESCAN: 'RESCAN',
  EDIT: 'EDIT',
  CONFIRM_EDIT: 'CONFIRM_EDIT',
  NEXT_FACE: 'NEXT_FACE',
  ALL_FACES_DONE: 'ALL_FACES_DONE',
  VALID: 'VALID',
  INVALID: 'INVALID',
  SOLVED: 'SOLVED',
  ERROR: 'ERROR',
  SOLVE_ANOTHER: 'SOLVE_ANOTHER',
  HOME: 'HOME',
  CANCEL: 'CANCEL',
};

/**
 * Transition table: state → action → nextState.
 * @type {Record<string, Record<string, string>>}
 */
const TRANSITIONS = {
  [AppState.LANDING]: {
    [Action.SELECT_PUZZLE]: AppState.PUZZLE_SELECT,
  },
  [AppState.PUZZLE_SELECT]: {
    [Action.START_SCAN]: AppState.SCANNING,
    [Action.BACK]: AppState.LANDING,
  },
  [AppState.SCANNING]: {
    [Action.FACE_DETECTED]: AppState.FACE_CONFIRM,
    [Action.CANCEL]: AppState.LANDING,
  },
  [AppState.FACE_CONFIRM]: {
    [Action.RESCAN]: AppState.SCANNING,
    [Action.EDIT]: AppState.FACE_EDIT,
    [Action.NEXT_FACE]: AppState.SCANNING,
    [Action.ALL_FACES_DONE]: AppState.VALIDATING,
  },
  [AppState.FACE_EDIT]: {
    [Action.CONFIRM_EDIT]: AppState.FACE_CONFIRM,
    [Action.CANCEL]: AppState.FACE_CONFIRM,
  },
  [AppState.VALIDATING]: {
    [Action.VALID]: AppState.SOLVING,
    [Action.INVALID]: AppState.SCANNING,
  },
  [AppState.SOLVING]: {
    [Action.SOLVED]: AppState.SOLUTION,
    [Action.ERROR]: AppState.LANDING,
  },
  [AppState.SOLUTION]: {
    [Action.SOLVE_ANOTHER]: AppState.SCANNING,
    [Action.HOME]: AppState.LANDING,
  },
};

class StateMachine {
  constructor() {
    /** @type {string} */
    this._state = AppState.LANDING;
  }

  /**
   * Returns the current application state.
   * @returns {string}
   */
  getState() {
    return this._state;
  }

  /**
   * Checks whether the given action is valid from the current state.
   * @param {string} action
   * @returns {boolean}
   */
  canTransition(action) {
    return Boolean(TRANSITIONS[this._state]?.[action]);
  }

  /**
   * Performs a state transition if the action is valid.
   * Emits `ui:navigate` with `{ view, params }` on success.
   * @param {string} action - One of the Action enum values
   * @param {object} [params] - Optional payload forwarded in the navigate event
   * @returns {string} The new state
   * @throws {Error} If the action is not valid from the current state
   */
  transition(action, params = {}) {
    const next = TRANSITIONS[this._state]?.[action];
    if (!next) {
      throw new Error(
        `[StateMachine] Invalid transition: "${action}" from state "${this._state}"`
      );
    }

    const prev = this._state;
    this._state = next;

    eventBus.emit(Events.UI_NAVIGATE, { view: next, prev, params });

    return next;
  }

  /**
   * Resets the machine to its initial state (Landing).
   * Does NOT emit a navigate event.
   */
  reset() {
    this._state = AppState.LANDING;
  }
}

/** Singleton instance. */
export const stateMachine = new StateMachine();

/** Named export for testing. */
export { StateMachine };
