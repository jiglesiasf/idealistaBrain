# Renta Estimation Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve rent estimation accuracy with weighted comparable scores, outlier detection, state-based adjustment, and a richer confidence system.

**Architecture:** Add pure utility functions (`weightedPercentile`, `detectOutliers`, `computeStateAdjustment`, `computeConfidenceScore`) to the existing IIFE module in `src/core/domain-core.cjs`, then refactor `buildRentEstimate()` to use them. Tests use vitest.

**Tech Stack:** Node.js CJS, vitest (TDD), Chrome Extension IIFE pattern

## Global Constraints

- All source code changes go in `src/core/domain-core.cjs` (canonical source); `extension/core/domain-core.js` is auto-synced
- New functions must be added to the module's return statement (line 631-647) for testability
- Existing exported API must remain backward-compatible (additive changes only)
- State factors are configurable constants, not hardcoded magic numbers
- Score max for normalization = 75 (40 zone + 15 rooms + 15 area + 5 state)

---

### Task 1: Setup vitest and test infrastructure

**Files:**
- Modify: `package.json` (add vitest devDependency, add test script)
- Create: `vitest.config.mjs` (minimal vitest config)
- Create: `src/core/__tests__/domain-core.test.cjs` (test scaffolding)

**Interfaces:**
- Consumes: nothing
- Produces: working test runner

- [ ] **Step 1: Install vitest**

```bash
npm install vitest --save-dev
```

Expected: vitest added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create vitest.config.mjs**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/core/__tests__/**/*.test.cjs'],
  },
});
```

- [ ] **Step 4: Create test scaffolding + first placeholder test**

```js
const { describe, it, expect } = require('vitest');
const core = require('../domain-core.cjs');

describe('weightedPercentile', () => {
  it('is exported from the module', () => {
    expect(typeof core.weightedPercentile).toBe('function');
  });
});
```

- [ ] **Step 5: Verify test runs and fails (weightedPercentile not yet exported)**

```bash
npm test
```

Expected: FAIL — `core.weightedPercentile is not a function` or similar.

- [ ] **Step 6: Add weightedPercentile placeholder export**

In `src/core/domain-core.cjs`, add a stub function and export it:

```js
// Place after the percentile function (line 171):
function weightedPercentile(sortedValues, weights, q) {
  return null; // stub
}
```

Add to the return object (around line 631):
```js
weightedPercentile,
```

- [ ] **Step 7: Re-run test — now it passes the existence check**

```bash
npm test
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add package.json vitest.config.mjs src/core/domain-core.cjs src/core/__tests__/domain-core.test.cjs
git commit -m "test: setup vitest and scaffold weightedPercentile test"
```

---

### Task 2: Implement weightedPercentile

**Files:**
- Modify: `src/core/domain-core.cjs` (replace stub with real implementation)
- Test: `src/core/__tests__/domain-core.test.cjs` (add weightedPercentile tests)

**Interfaces:**
- Produces: `weightedPercentile(sortedValues, weights, q)` → `number | null`
- Consumes: nothing
- `percentile(sortedValues, q)` is refactored to call `weightedPercentile(sortedValues, uniformWeights, q)`

- [ ] **Step 1: Write test for weightedPercentile with uniform weights = percentile**

```js
describe('weightedPercentile', () => {
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
    const weights = [1, 1, 100]; // 100 has 98% weight
    const result = core.weightedPercentile(values, weights, 0.5);
    // At p=0.5, cumulative normalized weight of first 2 values = 2/102 ≈ 0.0196
    // So p=0.5 lands in the 100 range
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
```

- [ ] **Step 2: Run tests — expect failures except the stub check**

```bash
npm test
```

Expected: 5 FAIL (weightedPercentile returns null for all)

- [ ] **Step 3: Implement weightedPercentile in domain-core.cjs**

Replace the stub:

```js
function weightedPercentile(sortedValues, weights, q) {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return null;

  const target = q * totalWeight;
  let cumulative = 0;

  for (let i = 0; i < sortedValues.length; i++) {
    cumulative += weights[i];
    if (cumulative >= target) {
      if (i === 0 || weights[i] === 0) return sortedValues[i];
      const prevCumulative = cumulative - weights[i];
      const fraction = (target - prevCumulative) / weights[i];
      return sortedValues[i - 1] + (sortedValues[i] - sortedValues[i - 1]) * fraction;
    }
  }

  return sortedValues[sortedValues.length - 1];
}
```

- [ ] **Step 4: Refactor percentile to delegate to weightedPercentile**

```js
function percentile(sortedValues, q) {
  const uniformWeights = sortedValues.map(() => 1);
  return weightedPercentile(sortedValues, uniformWeights, q);
}
```

- [ ] **Step 5: Run tests — all weightedPercentile tests pass**

```bash
npm test
```

Expected: 6 PASS (5 weightedPercentile + 1 export check)

- [ ] **Step 6: Commit**

```bash
git add src/core/domain-core.cjs src/core/__tests__/domain-core.test.cjs
git commit -m "feat: implement weightedPercentile and refactor percentile to delegate to it"
```

---

### Task 3: Implement detectOutliers

**Files:**
- Modify: `src/core/domain-core.cjs` (add `detectOutliers` function)
- Test: `src/core/__tests__/domain-core.test.cjs` (add outlier detection tests)

**Interfaces:**
- Produces: `detectOutliers(values)` → `number[]` (indices of outliers to remove)
- Consumes: nothing

- [ ] **Step 1: Write tests for detectOutliers**

```js
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: 6 FAIL (detectOutliers is undefined)

- [ ] **Step 3: Implement detectOutliers and export it**

```js
function median(sortedValues) {
  if (sortedValues.length === 0) return null;
  return percentile(sortedValues, 0.5);
}

function detectOutliers(values) {
  if (values.length < 3) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);

  if (sorted.length >= 8) {
    // MAD method
    const deviations = sorted.map(v => Math.abs(v - med));
    const mad = median(deviations.sort((a, b) => a - b));
    const threshold = 3 * mad * 1.4826;
    if (threshold <= 0) return [];
    return values.reduce((indices, v, i) => {
      if (Math.abs(v - med) > threshold) indices.push(i);
      return indices;
    }, []);
  }

  // IQR fence
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return [];
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.reduce((indices, v, i) => {
    if (v < lower || v > upper) indices.push(i);
    return indices;
  }, []);
}
```

Add to return object:
```js
detectOutliers,
```

- [ ] **Step 4: Run tests — all pass**

```bash
npm test
```

Expected: 12 PASS (6 weightedPercentile + 1 export + 5 outlier + 0 failures)

- [ ] **Step 5: Commit**

```bash
git add src/core/domain-core.cjs src/core/__tests__/domain-core.test.cjs
git commit -m "feat: add detectOutliers with MAD and IQR fence methods"
```

---

### Task 4: Implement computeStateAdjustment

**Files:**
- Modify: `src/core/domain-core.cjs` (add `computeStateAdjustment` function + state factor constants)
- Test: `src/core/__tests__/domain-core.test.cjs` (add state adjustment tests)

**Interfaces:**
- Produces: `computeStateAdjustment(subjectState, comparableStates)` → `number` (multiplicative factor)

- [ ] **Step 1: Write tests for computeStateAdjustment**

```js
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: 7 FAIL (computeStateAdjustment is undefined)

- [ ] **Step 3: Implement computeStateAdjustment and export it**

Add constants near the top of the IIFE (after `DEFAULT_PROFITABILITY_ASSUMPTIONS`, line 26):

```js
const STATE_FACTORS = Object.freeze({
  nuevo: 1.10,
  reformado: 1.08,
  "buen estado": 1.0,
  regular: 0.92,
  "para reformar": 0.82,
});

const STATE_ALIASES = Object.freeze({
  "nueva construccion": "nuevo",
  "nuevo construccion": "nuevo",
  "reacondicionado": "reformado",
  "recien reformado": "reformado",
  "a reformar": "para reformar",
  "a rehabilitar": "para reformar",
  "reforma": "para reformar",
});

function normalizeState(state) {
  const key = normalizeForCompare(state);
  return STATE_ALIASES[key] || key;
}
```

Add function (before `buildRentEstimate`):

```js
function computeStateAdjustment(subjectState, comparableStates) {
  if (!subjectState || !comparableStates || comparableStates.length === 0) return 1.0;

  const normalizedSubject = normalizeState(subjectState);
  const subjectFactor = STATE_FACTORS[normalizedSubject];
  if (subjectFactor === undefined) return 1.0;

  // Find modal state among comparables
  const normalizedComparables = comparableStates
    .filter(Boolean)
    .map(normalizeState);

  if (normalizedComparables.length === 0) return 1.0;

  const freq = {};
  let maxFreq = 0;
  let modeState = null;
  for (const s of normalizedComparables) {
    freq[s] = (freq[s] || 0) + 1;
    if (freq[s] > maxFreq) {
      maxFreq = freq[s];
      modeState = s;
    }
  }

  const modeFactor = STATE_FACTORS[modeState];
  if (modeFactor === undefined || modeFactor === 0) return 1.0;

  return subjectFactor / modeFactor;
}
```

Add to return object:
```js
computeStateAdjustment,
```

- [ ] **Step 4: Run tests — all pass**

```bash
npm test
```

Expected: 19 PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/domain-core.cjs src/core/__tests__/domain-core.test.cjs
git commit -m "feat: add computeStateAdjustment with state factors and alias normalization"
```

---

### Task 5: Implement computeConfidenceScore

**Files:**
- Modify: `src/core/domain-core.cjs` (add `computeConfidenceScore` function)
- Test: `src/core/__tests__/domain-core.test.cjs` (add confidence score tests)

**Interfaces:**
- Produces: `computeConfidenceScore(comparables, cv, referenceDeviationPct, method)` → `{ score, effectiveSampleSize, coefficientOfVariation, dispersionLabel }`

- [ ] **Step 1: Write tests for computeConfidenceScore**

```js
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
    const comparables = Array.from({ length: 5 }, () => makeComparable(45));
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: 7 FAIL

- [ ] **Step 3: Implement computeConfidenceScore and export it**

```js
const CONFIDENCE_WEIGHTS = Object.freeze({
  SAMPLE_SIZE: 0.35,
  DISPERSION: 0.30,
  COVERAGE: 0.20,
  REFERENCE: 0.15,
});

const MAX_SCORE = 75;

function computeConfidenceScore(comparables, coefficientOfVariation, referenceDeviationPct, method) {
  if (comparables.length === 0) {
    return { score: 0, effectiveSampleSize: 0, coefficientOfVariation: 0, dispersionLabel: 'alta' };
  }

  // Effective sample size component (35%)
  const totalScore = comparables.reduce((sum, c) => sum + (c.score || 0), 0);
  const effectiveSampleSize = totalScore / MAX_SCORE;
  const sizeScore = Math.min(effectiveSampleSize / 10, 1) * 100; // 10 effective = 100%

  // Dispersion component (30%)
  const cv = Math.abs(coefficientOfVariation || 0);
  let dispersionLabel;
  let dispersionScore;
  if (cv < 0.15) {
    dispersionLabel = 'baja';
    dispersionScore = 100;
  } else if (cv < 0.30) {
    dispersionLabel = 'moderada';
    dispersionScore = 60;
  } else {
    dispersionLabel = 'alta';
    dispersionScore = 20;
  }

  // Coverage component (20%)
  const goodMatches = comparables.filter(c => (c.score || 0) >= 50).length;
  const coverageScore = (goodMatches / comparables.length) * 100;

  // Reference support component (15%)
  let refScore = 0;
  if (Number.isFinite(referenceDeviationPct) && referenceDeviationPct !== null) {
    const absDev = Math.abs(referenceDeviationPct);
    if (absDev < 10) refScore = 100;
    else if (absDev < 20) refScore = 50;
    else refScore = 20;
  }

  let rawScore =
    sizeScore * CONFIDENCE_WEIGHTS.SAMPLE_SIZE +
    dispersionScore * CONFIDENCE_WEIGHTS.DISPERSION +
    coverageScore * CONFIDENCE_WEIGHTS.COVERAGE +
    refScore * CONFIDENCE_WEIGHTS.REFERENCE;

  // Fallback method caps at 74 (medium)
  if (method === 'direct') {
    rawScore = Math.min(rawScore, 74);
  }

  return {
    score: Math.round(rawScore),
    effectiveSampleSize: Math.round(effectiveSampleSize * 10) / 10,
    coefficientOfVariation: cv,
    dispersionLabel,
  };
}
```

Add to return object:
```js
computeConfidenceScore,
```

- [ ] **Step 4: Run tests — all pass**

```bash
npm test
```

Expected: 26 PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/domain-core.cjs src/core/__tests__/domain-core.test.cjs
git commit -m "feat: add computeConfidenceScore with composite scoring"
```

---

### Task 6: Refactor buildRentEstimate

**Files:**
- Modify: `src/core/domain-core.cjs` (refactor `buildRentEstimate` to use new utilities)
- Test: `src/core/__tests__/domain-core.test.cjs` (add buildRentEstimate integration tests)

**Interfaces:**
- Consumes: `weightedPercentile`, `detectOutliers`, `computeStateAdjustment`, `computeConfidenceScore`, `percentile`, `roundMoney`
- Produces: Refactored `buildRentEstimate(subject, comparables)` with enhanced return object

- [ ] **Step 1: Write tests for refactored buildRentEstimate**

```js
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
    // Rent should be in the ~880-1040 range, not near 8000
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
    expect(result.referenceMonthlyRentEur).toBe(roundMoney(16.7 * 80));
  });
});
```

- [ ] **Step 2: Run tests — most integration tests will fail because buildRentEstimate hasn't changed yet**

```bash
npm test
```

Expected: Mixture of passes (from utility tests) and failures (from new integration tests)

- [ ] **Step 3: Refactor buildRentEstimate in domain-core.cjs**

Replace the existing function (lines 394-469) with:

```js
function buildRentEstimate(subject, comparables) {
  const pricedComparables = comparables.filter((item) => Number.isFinite(item.priceEur));

  const referencePrice = lookupReferencePrice(
    subject.targetAsset?.municipality || subject.location?.city,
    subject.targetAsset?.district || subject.location?.district
  );

  const referenceMonthlyRentEur =
    referencePrice && Number.isFinite(subject.targetAsset?.areaM2)
      ? roundMoney(referencePrice.rentPerM2 * subject.targetAsset.areaM2)
      : null;

  function addReference(common) {
    const result = {
      ...common,
      referencePricePerM2: referencePrice?.rentPerM2 ?? null,
      referenceMonthlyRentEur,
      referenceSource: referencePrice?.source ?? null,
      referenceDeviationPct: null,
    };

    if (referenceMonthlyRentEur && Number.isFinite(common.monthlyRentEur) && referenceMonthlyRentEur > 0) {
      result.referenceDeviationPct = roundMoney(
        ((common.monthlyRentEur - referenceMonthlyRentEur) / referenceMonthlyRentEur) * 100
      );
    }

    return result;
  }

  if (pricedComparables.length === 0) {
    return addReference({
      confidence: 'low',
      comparablesUsed: 0,
      monthlyRentEur: null,
      lowEur: null,
      highEur: null,
      method: 'Sin comparables validos con precio.',
      confidenceSignals: {
        score: 0,
        effectiveSampleSize: 0,
        coefficientOfVariation: 0,
        dispersionLabel: 'alta',
        stateAdjusted: false,
        adjustmentFactor: null,
        comparablesAfterOutlierRemoval: 0,
        outliersRemoved: 0,
      },
    });
  }

  const perM2Comparables = pricedComparables.filter((item) => Number.isFinite(item.rentPerM2));
  const subjectArea = subject.targetAsset?.areaM2;

  if (perM2Comparables.length >= 3 && Number.isFinite(subjectArea)) {
    // Sort values and scores together
    const paired = perM2Comparables
      .map((item, i) => ({ value: item.rentPerM2, score: item.score || 0 }))
      .sort((a, b) => a.value - b.value);
    const sortedValues = paired.map(p => p.value);
    const sortedScores = paired.map(p => p.score);

    // Remove outliers
    const outlierIndices = detectOutliers(sortedValues);
    const outlierValues = new Set(outlierIndices);
    const cleanedValues = sortedValues.filter((_, i) => !outlierValues.has(i));
    const cleanedScores = sortedScores.filter((_, i) => !outlierValues.has(i));

    if (cleanedValues.length >= 3) {
      const weights = cleanedScores.map(s => Math.max(s, 1)); // minimum weight of 1
      const basePerM2 = weightedPercentile(cleanedValues, weights, 0.5);
      const lowPerM2 = weightedPercentile(cleanedValues, weights, 0.25);
      const highPerM2 = weightedPercentile(cleanedValues, weights, 0.75);

      // State adjustment
      const subjectState = subject.targetAsset?.state;
      const comparableStates = perM2Comparables.map(c => c.state);
      const stateFactor = computeStateAdjustment(subjectState, comparableStates);

      // Aggregate comparables for confidence (include all perM2 comparables, not just after outlier)
      const allPairedRents = perM2Comparables.map(c => c.rentPerM2);
      const mean = allPairedRents.reduce((s, v) => s + v, 0) / allPairedRents.length;
      const variance = allPairedRents.reduce((s, v) => s + (v - mean) ** 2, 0) / allPairedRents.length;
      const cv = Math.sqrt(variance) / (mean || 1);

      const baseEstimate = basePerM2 * subjectArea;
      const adjustedEstimate = baseEstimate * stateFactor;
      const refDeviation = referenceMonthlyRentEur
        ? ((adjustedEstimate - referenceMonthlyRentEur) / referenceMonthlyRentEur) * 100
        : null;

      const confidenceResult = computeConfidenceScore(pricedComparables, cv, refDeviation, 'perM2');

      const labelMap = confidenceResult.score >= 75 ? 'high' : confidenceResult.score >= 40 ? 'medium' : 'low';

      return addReference({
        confidence: labelMap,
        comparablesUsed: pricedComparables.length,
        monthlyRentEur: roundMoney(adjustedEstimate),
        lowEur: roundMoney(lowPerM2 * subjectArea * stateFactor),
        highEur: roundMoney(highPerM2 * subjectArea * stateFactor),
        method: 'Mediana ponderada de €/m2 de comparables validos.',
        confidenceSignals: {
          ...confidenceResult,
          stateAdjusted: stateFactor !== 1.0,
          adjustmentFactor: stateFactor !== 1.0 ? roundMoney(stateFactor * 100) / 100 : null,
          comparablesAfterOutlierRemoval: cleanedValues.length,
          outliersRemoved: outlierIndices.length,
        },
      });
    }
  }

  // Fallback: direct monthly rent
  const rents = pricedComparables.map((item) => item.priceEur).sort((left, right) => left - right);
  const rentScores = pricedComparables.map((item) => item.score || 0);

  const rentPaired = pricedComparables
    .map((item, i) => ({ value: item.priceEur, score: item.score || 0 }))
    .sort((a, b) => a.value - b.value);
  const sortedRents = rentPaired.map(p => p.value);
  const sortedRentScores = rentPaired.map(p => p.score);
  const rentWeights = sortedRentScores.map(s => Math.max(s, 1));

  const directEstimate = weightedPercentile(sortedRents, rentWeights, 0.5);
  const directLow = weightedPercentile(sortedRents, rentWeights, 0.25);
  const directHigh = weightedPercentile(sortedRents, rentWeights, 0.75);

  const directMean = rents.reduce((s, v) => s + v, 0) / rents.length;
  const directVariance = rents.reduce((s, v) => s + (v - directMean) ** 2, 0) / rents.length;
  const directCv = Math.sqrt(directVariance) / (directMean || 1);

  const refDeviationFallback = referenceMonthlyRentEur && directEstimate
    ? ((directEstimate - referenceMonthlyRentEur) / referenceMonthlyRentEur) * 100
    : null;

  const confidenceResultFallback = computeConfidenceScore(pricedComparables, directCv, refDeviationFallback, 'direct');

  const labelMapFallback = confidenceResultFallback.score >= 75 ? 'high' : confidenceResultFallback.score >= 40 ? 'medium' : 'low';

  return addReference({
    confidence: labelMapFallback,
    comparablesUsed: pricedComparables.length,
    monthlyRentEur: roundMoney(directEstimate),
    lowEur: roundMoney(directLow),
    highEur: roundMoney(directHigh),
    method: 'Mediana ponderada directa de rentas mensuales.',
    confidenceSignals: {
      ...confidenceResultFallback,
      stateAdjusted: false,
      adjustmentFactor: null,
      comparablesAfterOutlierRemoval: pricedComparables.length,
      outliersRemoved: 0,
    },
  });
}
```

- [ ] **Step 4: Run all tests — everything passes**

```bash
npm test
```

Expected: 33+ PASS (all utility tests + all integration tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/domain-core.cjs src/core/__tests__/domain-core.test.cjs
git commit -m "feat: refactor buildRentEstimate with weighted percentile, outlier detection, state adjustment, and confidence scoring"
```

---

### Task 7: Sync changes to extension/core/domain-core.js

**Files:**
- Modify: `extension/core/domain-core.js`

**Interfaces:**
- Consumes: synced content from `src/core/domain-core.cjs`

- [ ] **Step 1: Run the sync script**

```bash
npm run sync:core
```

Expected: `extension/core/domain-core.js` is updated to match `src/core/domain-core.cjs`.

- [ ] **Step 2: Verify the sync produced no diff**

```bash
diff <(node -e "require('./src/core/domain-core.cjs')") <(node -e "require('./extension/core/domain-core.js')")
```

Expected: No output (identical exports).

- [ ] **Step 3: Run tests to confirm extension copy works**

```js
// Add a small test file or run via node directly
node -e "
  const core = require('./extension/core/domain-core.js');
  console.assert(typeof core.weightedPercentile === 'function', 'weightedPercentile not found');
  console.assert(typeof core.detectOutliers === 'function', 'detectOutliers not found');
  console.assert(typeof core.computeStateAdjustment === 'function', 'computeStateAdjustment not found');
  console.assert(typeof core.computeConfidenceScore === 'function', 'computeConfidenceScore not found');
  console.log('All exports verified in extension copy');
"
```

Expected: "All exports verified in extension copy"

- [ ] **Step 4: Commit**

```bash
git add extension/core/domain-core.js
git commit -m "chore: sync extension/core/domain-core.js with canonical source"
```

---

### Task 8: Final verification

**Files:**
- Modify: none (pure verification)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All 33+ tests PASS, 0 failures.

- [ ] **Step 2: Verify no existing behavior is broken by running typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Open the complete test file and visually scan for any missing edge cases**

Look for:
- `weightedPercentile` with all zero weights
- `detectOutliers` with values where MAD = 0 (all identical values)
- `computeStateAdjustment` with unknown state (not in the map)
- `computeConfidenceScore` with all scores = 0
- `buildRentEstimate` with `subject.targetAsset` missing entirely

Add any missing tests, run `npm test`, and commit.
