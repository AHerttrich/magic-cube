/**
 * StateMachine unit tests.
 * Covers: initial state, valid transitions, invalid transitions,
 * getState, canTransition, event emission, reset.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine, AppState, Action } from '../../src/core/stateMachine.js';
import { eventBus, Events } from '../../src/core/eventBus.js';

describe('StateMachine', () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts in Landing state', () => {
    const sm = new StateMachine();
    expect(sm.getState()).toBe(AppState.LANDING);
    expect(sm.getState()).toBe('Landing');
  });

  // ── Valid transitions ──────────────────────────────────────────────────────

  it('transitions Landing → PuzzleSelect on SELECT_PUZZLE', () => {
    const sm = new StateMachine();
    const next = sm.transition(Action.SELECT_PUZZLE);
    expect(next).toBe(AppState.PUZZLE_SELECT);
    expect(sm.getState()).toBe(AppState.PUZZLE_SELECT);
  });

  it('transitions PuzzleSelect → Scanning on START_SCAN', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    expect(sm.getState()).toBe(AppState.SCANNING);
  });

  it('transitions PuzzleSelect → Landing on BACK', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.BACK);
    expect(sm.getState()).toBe(AppState.LANDING);
  });

  it('transitions Scanning → FaceConfirm on FACE_DETECTED', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    expect(sm.getState()).toBe(AppState.FACE_CONFIRM);
  });

  it('transitions FaceConfirm → FaceEdit on EDIT', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.EDIT);
    expect(sm.getState()).toBe(AppState.FACE_EDIT);
  });

  it('transitions FaceEdit → FaceConfirm on CONFIRM_EDIT', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.EDIT);
    sm.transition(Action.CONFIRM_EDIT);
    expect(sm.getState()).toBe(AppState.FACE_CONFIRM);
  });

  it('transitions FaceEdit → FaceConfirm on CANCEL', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.EDIT);
    sm.transition(Action.CANCEL);
    expect(sm.getState()).toBe(AppState.FACE_CONFIRM);
  });

  it('transitions FaceConfirm → Validating on ALL_FACES_DONE', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.ALL_FACES_DONE);
    expect(sm.getState()).toBe(AppState.VALIDATING);
  });

  it('transitions Validating → Solving → Solution', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.ALL_FACES_DONE);
    sm.transition(Action.VALID);
    sm.transition(Action.SOLVED);
    expect(sm.getState()).toBe(AppState.SOLUTION);
  });

  it('transitions Validating → Scanning on INVALID', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.ALL_FACES_DONE);
    sm.transition(Action.INVALID);
    expect(sm.getState()).toBe(AppState.SCANNING);
  });

  it('transitions Solution → Scanning on SOLVE_ANOTHER', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.ALL_FACES_DONE);
    sm.transition(Action.VALID);
    sm.transition(Action.SOLVED);
    sm.transition(Action.SOLVE_ANOTHER);
    expect(sm.getState()).toBe(AppState.SCANNING);
  });

  it('transitions Solution → Landing on HOME', () => {
    const sm = new StateMachine();
    sm.transition(Action.SELECT_PUZZLE);
    sm.transition(Action.START_SCAN);
    sm.transition(Action.FACE_DETECTED);
    sm.transition(Action.ALL_FACES_DONE);
    sm.transition(Action.VALID);
    sm.transition(Action.SOLVED);
    sm.transition(Action.HOME);
    expect(sm.getState()).toBe(AppState.LANDING);
  });

  it('transition() returns the new state', () => {
    const sm = new StateMachine();
    const returned = sm.transition(Action.SELECT_PUZZLE);
    expect(returned).toBe(AppState.PUZZLE_SELECT);
  });

  // ── Invalid transitions ────────────────────────────────────────────────────

  it('throws on an action invalid from the current state', () => {
    const sm = new StateMachine();
    // SOLVED is not valid from Landing
    expect(() => sm.transition(Action.SOLVED)).toThrow(/Invalid transition/);
    expect(() => sm.transition(Action.FACE_DETECTED)).toThrow(/Invalid transition/);
  });

  it('throws on an unknown action string', () => {
    const sm = new StateMachine();
    expect(() => sm.transition('NOT_A_REAL_ACTION')).toThrow(/Invalid transition/);
  });

  it('does not mutate state when transition throws', () => {
    const sm = new StateMachine();
    try {
      sm.transition(Action.SOLVED);
    } catch {
      // expected to throw
    }
    expect(sm.getState()).toBe(AppState.LANDING);
  });

  // ── canTransition() ────────────────────────────────────────────────────────

  describe('canTransition()', () => {
    it('returns true for a valid action from Landing', () => {
      const sm = new StateMachine();
      expect(sm.canTransition(Action.SELECT_PUZZLE)).toBe(true);
    });

    it('returns false for an invalid action from Landing', () => {
      const sm = new StateMachine();
      expect(sm.canTransition(Action.SOLVED)).toBe(false);
      expect(sm.canTransition(Action.FACE_DETECTED)).toBe(false);
      expect(sm.canTransition(Action.HOME)).toBe(false);
    });

    it('reflects the available transitions after a state change', () => {
      const sm = new StateMachine();
      sm.transition(Action.SELECT_PUZZLE);
      expect(sm.canTransition(Action.START_SCAN)).toBe(true);
      expect(sm.canTransition(Action.SELECT_PUZZLE)).toBe(false);
    });

    it('returns false for an empty string', () => {
      const sm = new StateMachine();
      expect(sm.canTransition('')).toBe(false);
    });
  });

  // ── reset() ────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('returns the machine to Landing after transitions', () => {
      const sm = new StateMachine();
      sm.transition(Action.SELECT_PUZZLE);
      sm.transition(Action.START_SCAN);
      sm.reset();
      expect(sm.getState()).toBe(AppState.LANDING);
    });

    it('allows valid Landing transitions after reset', () => {
      const sm = new StateMachine();
      sm.transition(Action.SELECT_PUZZLE);
      sm.reset();
      expect(sm.canTransition(Action.SELECT_PUZZLE)).toBe(true);
    });
  });

  // ── Event emission ─────────────────────────────────────────────────────────

  describe('event emission', () => {
    let emitSpy;

    beforeEach(() => {
      emitSpy = vi.spyOn(eventBus, 'emit');
    });

    afterEach(() => {
      emitSpy.mockRestore();
    });

    it('emits ui:navigate after a valid transition', () => {
      const sm = new StateMachine();
      sm.transition(Action.SELECT_PUZZLE);
      expect(emitSpy).toHaveBeenCalledWith(
        Events.UI_NAVIGATE,
        expect.objectContaining({ view: AppState.PUZZLE_SELECT })
      );
    });

    it('includes prev state in the navigate payload', () => {
      const sm = new StateMachine();
      sm.transition(Action.SELECT_PUZZLE);
      expect(emitSpy).toHaveBeenCalledWith(
        Events.UI_NAVIGATE,
        expect.objectContaining({ prev: AppState.LANDING })
      );
    });

    it('does NOT emit when transition throws', () => {
      const sm = new StateMachine();
      try {
        sm.transition(Action.SOLVED);
      } catch {
        // expected
      }
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // ── AppState enum ──────────────────────────────────────────────────────────

  describe('AppState enum', () => {
    it('defines all 8 states', () => {
      const states = Object.values(AppState);
      expect(states).toHaveLength(8);
    });

    it('has expected state names', () => {
      expect(AppState.LANDING).toBe('Landing');
      expect(AppState.PUZZLE_SELECT).toBe('PuzzleSelect');
      expect(AppState.SCANNING).toBe('Scanning');
      expect(AppState.FACE_CONFIRM).toBe('FaceConfirm');
      expect(AppState.FACE_EDIT).toBe('FaceEdit');
      expect(AppState.VALIDATING).toBe('Validating');
      expect(AppState.SOLVING).toBe('Solving');
      expect(AppState.SOLUTION).toBe('Solution');
    });
  });

  // ── Action enum ────────────────────────────────────────────────────────────

  describe('Action enum', () => {
    it('defines all expected actions', () => {
      expect(Action.SELECT_PUZZLE).toBe('SELECT_PUZZLE');
      expect(Action.START_SCAN).toBe('START_SCAN');
      expect(Action.FACE_DETECTED).toBe('FACE_DETECTED');
      expect(Action.ALL_FACES_DONE).toBe('ALL_FACES_DONE');
      expect(Action.HOME).toBe('HOME');
      expect(Action.SOLVE_ANOTHER).toBe('SOLVE_ANOTHER');
    });
  });
});
