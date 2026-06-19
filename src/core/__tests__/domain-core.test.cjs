const core = require('../domain-core.cjs');

describe('weightedPercentile', () => {
  it('is exported from the module', () => {
    expect(typeof core.weightedPercentile).toBe('function');
  });

  it('returns same result as percentile with uniform weights', () => {
    const values = [10, 20, 30, 40, 50];
    const weights = [1, 1, 1, 1, 1];
    expect(core.weightedPercentile(values, weights, 0.5)).toBe(30);
    expect(core.weightedPercentile(values, weights, 0.25)).toBe(20);
    expect(core.weightedPercentile(values, weights, 0.75)).toBe(40);
  });

  it('returns null for empty arrays', () => {
    expect(core.weightedPercentile([], [], 0.5)).toBeNull();
  });

  it('returns single value for single-element array', () => {
    expect(core.weightedPercentile([42], [1], 0.5)).toBe(42);
  });

  it('skews toward the value with dominant weight', () => {
    const values = [10, 20, 100];
    const weights = [1, 1, 100];
    const result = core.weightedPercentile(values, weights, 0.5);
    expect(result).toBeGreaterThan(90);
  });

  it('ignores zero-weight entries', () => {
    const values = [10, 50, 100];
    const weights = [0, 0, 1];
    expect(core.weightedPercentile(values, weights, 0.5)).toBe(100);
  });

  it('preserves percentile behavior with equal non-unit weights', () => {
    const values = [10, 20, 30, 40, 50];
    const weights = [5, 5, 5, 5, 5];
    expect(core.weightedPercentile(values, weights, 0.5)).toBe(30);
  });
});

describe('detectOutliers', () => {
  it('returns empty array when no outliers (tight cluster)', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 17];
    const result = core.detectOutliers(values);
    expect(result).toEqual([]);
  });

  it('detects a clear outlier with MAD method (n >= 8)', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 100];
    const result = core.detectOutliers(values);
    expect(result).toEqual([7]); // index of 100
  });

  it('uses IQR fence for small samples (n < 8)', () => {
    const values = [5, 6, 7, 8, 9, 50];
    const result = core.detectOutliers(values);
    expect(result).toEqual([5]); // index of 50
  });

  it('returns empty for small sample without outliers', () => {
    const values = [5, 6, 7, 8, 9, 10];
    const result = core.detectOutliers(values);
    expect(result).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(core.detectOutliers([])).toEqual([]);
  });

  it('returns empty for single-element array', () => {
    expect(core.detectOutliers([42])).toEqual([]);
  });
});

describe('computeStateAdjustment', () => {
  it('returns 1.0 (no adjustment) when subject state is missing', () => {
    expect(core.computeStateAdjustment(null, ['buen estado', 'buen estado'])).toBe(1.0);
    expect(core.computeStateAdjustment(undefined, [])).toBe(1.0);
  });

  it('returns 1.0 when no comparable states provided', () => {
    expect(core.computeStateAdjustment('reformado', [])).toBe(1.0);
  });

  it('adjusts up when subject is reformado and comparables are buen estado', () => {
    const factor = core.computeStateAdjustment('reformado', ['buen estado', 'buen estado', 'buen estado']);
    expect(factor).toBeCloseTo(1.08, 2);
  });

  it('adjusts down when subject is para reformar and comparables are buen estado', () => {
    const factor = core.computeStateAdjustment('para reformar', ['buen estado', 'buen estado']);
    expect(factor).toBeCloseTo(0.82, 2);
  });

  it('returns 1.0 when subject and modal comparable state match', () => {
    const factor = core.computeStateAdjustment('reformado', ['reformado', 'reformado', 'buen estado']);
    expect(factor).toBe(1.0);
  });

  it('handles state aliasing (nueva construccion -> nuevo)', () => {
    const factor = core.computeStateAdjustment('nueva construccion', ['nuevo', 'nuevo']);
    expect(factor).toBe(1.0);
  });

  it('handles state aliasing (reacondicionado -> reformado)', () => {
    const factor = core.computeStateAdjustment('reacondicionado', ['reformado', 'reformado']);
    expect(factor).toBe(1.0);
  });
});

describe('computeConfidenceScore', () => {
  const makeComparable = (score) => ({ score });

  it('returns high score with abundant high-quality data', () => {
    const comparables = Array.from({ length: 15 }, () => makeComparable(70));
    const result = core.computeConfidenceScore(comparables, 0.12, -5, 'perM2');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('returns low score with few low-quality comparables', () => {
    const comparables = [makeComparable(20), makeComparable(25)];
    const result = core.computeConfidenceScore(comparables, 0.35, null, 'perM2');
    expect(result.score).toBeLessThan(40);
  });

  it('returns medium score with moderate data', () => {
    const comparables = Array.from({ length: 5 }, () => makeComparable(70));
    const result = core.computeConfidenceScore(comparables, 0.2, null, 'perM2');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(75);
  });

  it('categorizes dispersion correctly', () => {
    const comparables = [makeComparable(50)];
    const low = core.computeConfidenceScore(comparables, 0.10, null, 'perM2');
    expect(low.dispersionLabel).toBe('baja');

    const mod = core.computeConfidenceScore(comparables, 0.20, null, 'perM2');
    expect(mod.dispersionLabel).toBe('moderada');

    const high = core.computeConfidenceScore(comparables, 0.35, null, 'perM2');
    expect(high.dispersionLabel).toBe('alta');
  });

  it('boosts score with close reference price match', () => {
    const comparables = Array.from({ length: 3 }, () => makeComparable(50));
    const withoutRef = core.computeConfidenceScore(comparables, 0.15, null, 'perM2');
    const withRef = core.computeConfidenceScore(comparables, 0.15, 5, 'perM2');
    expect(withRef.score).toBeGreaterThan(withoutRef.score);
  });

  it('caps fallback method at medium', () => {
    const comparables = Array.from({ length: 20 }, () => makeComparable(75));
    const result = core.computeConfidenceScore(comparables, 0.1, -3, 'direct');
    expect(result.score).toBeLessThan(75);
  });

  it('returns 0 score for empty comparables', () => {
    const result = core.computeConfidenceScore([], 0, null, 'perM2');
    expect(result.score).toBe(0);
  });
});
