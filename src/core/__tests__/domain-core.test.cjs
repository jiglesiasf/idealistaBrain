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

describe('buildRentEstimate', () => {
  const makeSubject = (overrides = {}) => ({
    targetAsset: {
      areaM2: 80,
      municipality: 'valencia',
      district: 'eixample',
      rooms: 3,
      propertyType: 'piso',
      state: 'buen estado',
      ...overrides,
    },
    location: { city: 'valencia', district: 'eixample' },
  });

  const makeComparable = (overrides = {}) => ({
    priceEur: 1000,
    areaM2: 80,
    rentPerM2: 12.5,
    rooms: 3,
    propertyType: 'piso',
    municipality: 'valencia',
    zone: 'eixample',
    state: 'buen estado',
    score: 70,
    ...overrides,
  });

  it('returns low confidence with null rent when no comparables', () => {
    const result = core.buildRentEstimate(makeSubject(), []);
    expect(result.confidence).toBe('low');
    expect(result.monthlyRentEur).toBeNull();
    expect(result.comparablesUsed).toBe(0);
  });

  it('returns estimate with perM2 method when >=3 comparables with area', () => {
    const comparables = [
      makeComparable({ rentPerM2: 12 }),
      makeComparable({ rentPerM2: 13 }),
      makeComparable({ rentPerM2: 14 }),
    ];
    const result = core.buildRentEstimate(makeSubject(), comparables);
    expect(result.monthlyRentEur).toBeGreaterThan(0);
    expect(result.method).toContain('€/m2');
    expect(result.confidenceSignals).toBeDefined();
    expect(result.confidenceSignals.effectiveSampleSize).toBeGreaterThan(0);
  });

  it('falls back to direct rent method when <3 perM2 comparables', () => {
    const comparables = [
      makeComparable({ rentPerM2: null, areaM2: null, priceEur: 900 }),
      makeComparable({ rentPerM2: null, areaM2: null, priceEur: 1000 }),
    ];
    const result = core.buildRentEstimate(makeSubject(), comparables);
    expect(result.monthlyRentEur).toBeGreaterThan(0);
    expect(result.method).toContain('directa');
  });

  it('removes outliers and does not include them in estimate', () => {
    const comparables = [
      makeComparable({ rentPerM2: 10, priceEur: 800, areaM2: 80 }),
      makeComparable({ rentPerM2: 11, priceEur: 880, areaM2: 80 }),
      makeComparable({ rentPerM2: 12, priceEur: 960, areaM2: 80 }),
      makeComparable({ rentPerM2: 13, priceEur: 1040, areaM2: 80 }),
      makeComparable({ rentPerM2: 12, priceEur: 960, areaM2: 80 }),
      makeComparable({ rentPerM2: 11, priceEur: 880, areaM2: 80 }),
      makeComparable({ rentPerM2: 12, priceEur: 960, areaM2: 80 }),
      makeComparable({ rentPerM2: 13, priceEur: 1040, areaM2: 80 }),
      makeComparable({ rentPerM2: 100, priceEur: 8000, areaM2: 80 }), // outlier
    ];
    const result = core.buildRentEstimate(makeSubject(), comparables);
    expect(result.confidenceSignals.outliersRemoved).toBeGreaterThanOrEqual(1);
    expect(result.monthlyRentEur).toBeLessThan(2000);
  });

  it('applies state adjustment when subject state differs from comparable mode', () => {
    const comparables = [
      makeComparable({ state: 'buen estado', rentPerM2: 12, priceEur: 960, areaM2: 80 }),
      makeComparable({ state: 'buen estado', rentPerM2: 13, priceEur: 1040, areaM2: 80 }),
      makeComparable({ state: 'buen estado', rentPerM2: 12, priceEur: 960, areaM2: 80 }),
    ];
    const subject = makeSubject({ state: 'reformado' });
    const result = core.buildRentEstimate(subject, comparables);
    expect(result.confidenceSignals.stateAdjusted).toBe(true);
    expect(result.confidenceSignals.adjustmentFactor).toBeCloseTo(1.08, 2);
  });

  it('assigns confidence label high with sufficient data', () => {
    const comparables = Array.from({ length: 12 }, (_, i) =>
      makeComparable({ rentPerM2: 11 + (i % 3), score: 70 })
    );
    const subject = makeSubject({ areaM2: 80 });
    const result = core.buildRentEstimate(subject, comparables);
    expect(result.confidence).toBe('high');
  });

  it('includes reference price when available', () => {
    const comparables = [makeComparable({ rentPerM2: 16 }), makeComparable({ rentPerM2: 17 }), makeComparable({ rentPerM2: 15 })];
    const subject = makeSubject({ municipality: 'valencia', district: 'eixample', areaM2: 80 });
    const result = core.buildRentEstimate(subject, comparables);
    expect(result.referencePricePerM2).toBe(16.7);
    expect(result.referenceMonthlyRentEur).toBe(Math.round(16.7 * 80));
  });
});
