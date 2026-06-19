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
