import { describe, it, expect, beforeEach } from 'vitest';
import { CalibrationEngine, DEFAULT_REFERENCES } from '../../src/cv/calibration.js';

describe('DEFAULT_REFERENCES', () => {
  it('contains all 6 Rubik\'s cube colors', () => {
    const names = Object.keys(DEFAULT_REFERENCES);
    expect(names).toContain('white');
    expect(names).toContain('yellow');
    expect(names).toContain('red');
    expect(names).toContain('orange');
    expect(names).toContain('blue');
    expect(names).toContain('green');
    expect(names).toHaveLength(6);
  });

  it('white reference matches SPEC §4.2: L=95, a=0, b=0', () => {
    expect(DEFAULT_REFERENCES.white).toEqual({ L: 95.0, a: 0.0, b: 0.0 });
  });

  it('yellow reference matches SPEC §4.2: L=90, a=-5, b=85', () => {
    expect(DEFAULT_REFERENCES.yellow).toEqual({ L: 90.0, a: -5.0, b: 85.0 });
  });

  it('red reference matches SPEC §4.2: L=45, a=60, b=35', () => {
    expect(DEFAULT_REFERENCES.red).toEqual({ L: 45.0, a: 60.0, b: 35.0 });
  });

  it('orange reference matches SPEC §4.2: L=65, a=40, b=65', () => {
    expect(DEFAULT_REFERENCES.orange).toEqual({ L: 65.0, a: 40.0, b: 65.0 });
  });

  it('blue reference matches SPEC §4.2: L=30, a=15, b=-55', () => {
    expect(DEFAULT_REFERENCES.blue).toEqual({ L: 30.0, a: 15.0, b: -55.0 });
  });

  it('green reference matches SPEC §4.2: L=50, a=-45, b=30', () => {
    expect(DEFAULT_REFERENCES.green).toEqual({ L: 50.0, a: -45.0, b: 30.0 });
  });
});

describe('CalibrationEngine', () => {
  /** @type {CalibrationEngine} */
  let engine;

  beforeEach(() => {
    engine = new CalibrationEngine();
  });

  // ────────────────────────────────────────────────
  // addReference + getReferences
  // ────────────────────────────────────────────────

  it('starts with default references', () => {
    const refs = engine.getReferences();
    expect(refs.white).toEqual(DEFAULT_REFERENCES.white);
    expect(refs.green).toEqual(DEFAULT_REFERENCES.green);
  });

  it('addReference stores the new color', () => {
    engine.addReference('white', { L: 93, a: -0.5, b: 2 });
    expect(engine.getReferences().white).toEqual({ L: 93, a: -0.5, b: 2 });
  });

  it('addReference does not mutate the input', () => {
    const lab = { L: 93, a: -0.5, b: 2 };
    engine.addReference('white', lab);
    lab.L = 99; // mutate original
    expect(engine.getReferences().white.L).toBe(93); // engine copy unchanged
  });

  // ────────────────────────────────────────────────
  // buildPalette
  // ────────────────────────────────────────────────

  it('buildPalette sets thresholds based on inter-color distances', () => {
    engine.buildPalette(); // uses default 6 references
    const thr = engine.getThresholds();
    expect(thr.maxDelta).toBeGreaterThan(0);
    expect(thr.maxDelta).toBeLessThanOrEqual(25);
    expect(thr.ambiguityGap).toBeGreaterThanOrEqual(3);
  });

  it('buildPalette with custom close references yields small maxDelta', () => {
    // Put two very similar references
    engine.addReference('colorA', { L: 50, a: 10, b: 10 });
    engine.addReference('colorB', { L: 50, a: 11, b: 11 }); // ΔE ≈ 1.4
    engine.buildPalette();
    const thr = engine.getThresholds();
    // maxDelta should be half the min inter-color distance ≈ 0.7
    expect(thr.maxDelta).toBeLessThan(10);
  });

  // ────────────────────────────────────────────────
  // getProfile / loadProfile round-trip
  // ────────────────────────────────────────────────

  it('getProfile returns a valid CalibrationProfile shape', () => {
    const profile = engine.getProfile();
    expect(profile.version).toBe(1);
    expect(typeof profile.timestamp).toBe('string');
    expect(profile.references).toBeDefined();
    expect(profile.thresholds.maxDelta).toBeDefined();
    expect(profile.thresholds.ambiguityGap).toBeDefined();
    expect(profile.illuminant).toBeDefined();
  });

  it('loadProfile restores a profile exactly', () => {
    engine.addReference('white', { L: 93, a: -0.5, b: 2 });
    engine.buildPalette();
    const profile = engine.getProfile();

    const engine2 = new CalibrationEngine();
    engine2.loadProfile(profile);

    expect(engine2.getReferences().white).toEqual({ L: 93, a: -0.5, b: 2 });
    expect(engine2.getThresholds()).toEqual(engine.getThresholds());
  });

  it('loadProfile throws on unsupported version', () => {
    const badProfile = { ...engine.getProfile(), version: 99 };
    expect(() => engine.loadProfile(badProfile)).toThrow(/unsupported.*version/i);
  });

  it('getProfile → loadProfile round-trip preserves all 6 default references', () => {
    const profile = engine.getProfile();
    const engine2 = new CalibrationEngine();
    engine2.reset();
    engine2.loadProfile(profile);

    for (const [name, lab] of Object.entries(DEFAULT_REFERENCES)) {
      expect(engine2.getReferences()[name]).toEqual(lab);
    }
  });

  // ────────────────────────────────────────────────
  // saveProfile / loadSavedProfile (localStorage mock)
  // ────────────────────────────────────────────────

  it('saveProfile and loadSavedProfile round-trip via localStorage', () => {
    // Provide a minimal localStorage stub for the test environment
    const store = {};
    global.localStorage = {
      getItem:    (k)    => store[k] ?? null,
      setItem:    (k, v) => { store[k] = v; },
      removeItem: (k)    => { delete store[k]; },
    };

    engine.addReference('red', { L: 42, a: 58, b: 33 });
    engine.saveProfile();

    const engine2 = new CalibrationEngine();
    const loaded = engine2.loadSavedProfile();
    expect(loaded).toBe(true);
    expect(engine2.getReferences().red).toEqual({ L: 42, a: 58, b: 33 });

    // Cleanup
    delete global.localStorage;
  });

  it('loadSavedProfile returns false when nothing is stored', () => {
    const store = {};
    global.localStorage = {
      getItem: () => null,
      setItem: (k, v) => { store[k] = v; },
    };
    const loaded = engine.loadSavedProfile();
    expect(loaded).toBe(false);
    delete global.localStorage;
  });

  // ────────────────────────────────────────────────
  // reset
  // ────────────────────────────────────────────────

  it('reset restores default references', () => {
    engine.addReference('white', { L: 10, a: 0, b: 0 });
    engine.reset();
    expect(engine.getReferences().white).toEqual(DEFAULT_REFERENCES.white);
  });

  // ────────────────────────────────────────────────
  // applyWhiteBalance (Von Kries adaptation)
  // ────────────────────────────────────────────────

  it('applyWhiteBalance with neutral illuminant makes no change', () => {
    engine.setIlluminant({ L: 100, a: 0, b: 0 });
    const lab = { L: 50, a: 10, b: -20 };
    const adapted = engine.applyWhiteBalance(lab);
    expect(adapted.a).toBeCloseTo(10, 5);
    expect(adapted.b).toBeCloseTo(-20, 5);
  });

  it('applyWhiteBalance shifts a and b channels by illuminant offset', () => {
    engine.setIlluminant({ L: 100, a: 5, b: -10 }); // warm tint
    const lab = { L: 60, a: 30, b: 40 };
    const adapted = engine.applyWhiteBalance(lab);
    // Adaptation should subtract the illuminant chrominance
    expect(adapted.a).toBeCloseTo(30 - 5, 5);
    expect(adapted.b).toBeCloseTo(40 + 10, 5);
  });

  // ────────────────────────────────────────────────
  // assessLightingQuality
  // ────────────────────────────────────────────────

  it('assessLightingQuality returns good for ideal conditions', () => {
    const { quality } = engine.assessLightingQuality({
      brightness: 140, contrast: 40, colorCast: 5,
    });
    expect(quality).toBe('good');
  });

  it('assessLightingQuality returns poor for very dark image', () => {
    const { quality, recommendation } = engine.assessLightingQuality({
      brightness: 30, contrast: 40, colorCast: 5,
    });
    expect(quality).toBe('poor');
    expect(recommendation.toLowerCase()).toMatch(/bright|light/);
  });

  it('assessLightingQuality returns poor for overexposed image', () => {
    const { quality } = engine.assessLightingQuality({
      brightness: 240, contrast: 40, colorCast: 5,
    });
    expect(quality).toBe('poor');
  });

  it('assessLightingQuality returns acceptable for low contrast', () => {
    const { quality } = engine.assessLightingQuality({
      brightness: 140, contrast: 10, colorCast: 5,
    });
    expect(quality).toBe('acceptable');
  });

  it('assessLightingQuality returns acceptable for high color cast', () => {
    const { quality } = engine.assessLightingQuality({
      brightness: 140, contrast: 40, colorCast: 20,
    });
    expect(quality).toBe('acceptable');
  });
});
