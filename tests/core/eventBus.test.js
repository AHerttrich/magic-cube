/**
 * EventBus unit tests.
 * Covers: subscribe, emit, unsubscribe, multiple handlers, error isolation,
 * memory leak prevention, listener counting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, Events } from '../../src/core/eventBus.js';

describe('EventBus', () => {
  /** @type {EventBus} */
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ── on / emit ──────────────────────────────────────────────────────────────

  it('calls a subscribed handler when the event is emitted', () => {
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', 42);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(42);
  });

  it('passes payload to the handler', () => {
    const handler = vi.fn();
    bus.on('data:event', handler);
    const payload = { foo: 'bar', num: 1 };
    bus.emit('data:event', payload);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('does not call handler for a different event', () => {
    const handler = vi.fn();
    bus.on('event:A', handler);
    bus.emit('event:B', 'payload');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emits without payload (undefined)', () => {
    const handler = vi.fn();
    bus.on('no:payload', handler);
    bus.emit('no:payload');
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('silently ignores emit for events with no subscribers', () => {
    expect(() => bus.emit('nonexistent:event', 'data')).not.toThrow();
  });

  // ── Multiple handlers ──────────────────────────────────────────────────────

  it('calls all registered handlers for the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();
    bus.on('multi:event', h1);
    bus.on('multi:event', h2);
    bus.on('multi:event', h3);
    bus.emit('multi:event', 'hello');
    expect(h1).toHaveBeenCalledWith('hello');
    expect(h2).toHaveBeenCalledWith('hello');
    expect(h3).toHaveBeenCalledWith('hello');
  });

  it('keeps handlers for different events isolated', () => {
    const hA = vi.fn();
    const hB = vi.fn();
    bus.on('event:A', hA);
    bus.on('event:B', hB);
    bus.emit('event:A', 1);
    expect(hA).toHaveBeenCalledTimes(1);
    expect(hB).not.toHaveBeenCalled();
  });

  // ── Unsubscribe ────────────────────────────────────────────────────────────

  it('returns an unsubscribe function from on()', () => {
    const unsub = bus.on('unsub:test', vi.fn());
    expect(typeof unsub).toBe('function');
  });

  it('stops calling handler after unsubscribe', () => {
    const handler = vi.fn();
    const unsub = bus.on('unsub:event', handler);
    bus.emit('unsub:event', 1);
    unsub();
    bus.emit('unsub:event', 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes the handler via off()', () => {
    const handler = vi.fn();
    bus.on('off:event', handler);
    bus.emit('off:event', 1);
    bus.off('off:event', handler);
    bus.emit('off:event', 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing does not affect other handlers on the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = bus.on('shared:event', h1);
    bus.on('shared:event', h2);
    unsub1();
    bus.emit('shared:event', 'data');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledWith('data');
  });

  it('double-unsubscribing does not throw', () => {
    const unsub = bus.on('double:unsub', vi.fn());
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  // ── Memory leak prevention ─────────────────────────────────────────────────

  it('cleans up the event key after the last handler unsubscribes', () => {
    const handler = vi.fn();
    const unsub = bus.on('cleanup:event', handler);
    expect(bus.listenerCount('cleanup:event')).toBe(1);
    unsub();
    expect(bus.listenerCount('cleanup:event')).toBe(0);
  });

  it('listenerCount returns 0 for unknown events', () => {
    expect(bus.listenerCount('never:registered')).toBe(0);
  });

  it('clear() removes all handlers', () => {
    bus.on('a', vi.fn());
    bus.on('b', vi.fn());
    bus.clear();
    expect(bus.listenerCount('a')).toBe(0);
    expect(bus.listenerCount('b')).toBe(0);
  });

  // ── Error isolation ────────────────────────────────────────────────────────

  it('continues calling remaining handlers if one throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = vi.fn(() => { throw new Error('oops'); });
    const safe = vi.fn();

    bus.on('error:test', throwing);
    bus.on('error:test', safe);
    bus.emit('error:test', 'data');

    expect(throwing).toHaveBeenCalled();
    expect(safe).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // ── Typed event catalog ────────────────────────────────────────────────────

  it('Events catalog contains expected keys', () => {
    expect(Events.UI_NAVIGATE).toBe('ui:navigate');
    expect(Events.UI_THEME_CHANGED).toBe('ui:theme-changed');
    expect(Events.CV_FACE_DETECTED).toBe('cv:face-detected');
    expect(Events.SOLVER_SOLUTION).toBe('solver:solution');
  });
});
