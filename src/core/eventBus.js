/**
 * EventBus — typed singleton pub/sub for inter-module communication.
 * Pattern from ARCH §3.3. All inter-module events flow through this bus.
 *
 * Usage:
 *   const unsub = eventBus.on('ui:theme-changed', handler);
 *   eventBus.emit('ui:theme-changed', 'dark');
 *   unsub(); // cleanup
 */

/**
 * @typedef {function(*): void} EventHandler
 */

class EventBus {
  constructor() {
    /** @type {Map<string, Set<EventHandler>>} */
    this._handlers = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name (e.g. 'ui:theme-changed')
   * @param {EventHandler} handler - Callback invoked with the event payload
   * @returns {function(): void} Unsubscribe function — call to remove this handler
   */
  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event).add(handler);

    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe a handler from an event.
   * @param {string} event
   * @param {EventHandler} handler
   */
  off(event, handler) {
    const handlers = this._handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._handlers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const handlers = this._handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }
    // Copy to avoid mutation during iteration
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  /**
   * Remove all handlers for all events. Useful for testing.
   */
  clear() {
    this._handlers.clear();
  }

  /**
   * Returns the number of active subscribers for a given event.
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    return this._handlers.get(event)?.size ?? 0;
  }
}

/** Singleton instance shared across the entire application. */
export const eventBus = new EventBus();

/** Named export of the class for testing and advanced use. */
export { EventBus };

/**
 * Typed event catalog — all valid event names.
 * Emitters and consumers should reference these constants.
 */
export const Events = {
  // Computer Vision
  CV_INIT_PROGRESS: 'cv:init-progress',
  CV_INIT_COMPLETE: 'cv:init-complete',
  CV_FACE_DETECTED: 'cv:face-detected',
  CV_LIGHTING_WARNING: 'cv:lighting-warning',

  // Solver
  SOLVER_INIT_PROGRESS: 'solver:init-progress',
  SOLVER_READY: 'solver:ready',
  SOLVER_SOLUTION: 'solver:solution',
  SOLVER_ERROR: 'solver:error',

  // Cube State
  STATE_FACE_SCANNED: 'state:face-scanned',
  STATE_FACE_EDITED: 'state:face-edited',
  STATE_ALL_FACES_COMPLETE: 'state:all-faces-complete',
  STATE_VALIDATION_PASS: 'state:validation-pass',
  STATE_VALIDATION_FAIL: 'state:validation-fail',

  // Visualization
  VIZ_MOVE_STARTED: 'viz:move-started',
  VIZ_MOVE_COMPLETED: 'viz:move-completed',
  VIZ_PLAYBACK_COMPLETE: 'viz:playback-complete',

  // UI
  UI_THEME_CHANGED: 'ui:theme-changed',
  UI_NAVIGATE: 'ui:navigate',
};
