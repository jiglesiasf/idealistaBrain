# Renta Estimation Optimization Design

**Date:** 2026-06-19
**Status:** Draft

## Problem

The current rent estimation system uses a simple median of comparable rents per m² (or direct monthly rent as fallback) with equal weighting for all comparables. This ignores the existing comparable quality scoring system, has no outlier detection, no adjustment for property condition, and a simplistic confidence label based solely on count.

## Goals

1. **Accuracy**: Produce more precise estimates by weighting comparables by their similarity score
2. **Robustness**: Remove outlier comparables that skew results
3. **Nuance**: Adjust estimate based on property condition (state)
4. **Transparency**: Provide richer confidence signals beyond a simple high/medium/low label
5. **Correctness**: Add automated tests for all estimation logic

Non-goals: UI changes to popup, scraping flow changes, web calculator changes, reference price expansion.

## Design

### 1. Weighted Percentile (replaces simple percentile)

A new `weightedPercentile(values, weights, p)` function where comparables with higher similarity scores contribute more to the estimate.

- Values and weights are sorted together by value
- Weights are normalized to sum to 1
- The weighted percentile is the value at which the cumulative normalized weight reaches `p`
- Existing `percentile(values, p)` is preserved and calls `weightedPercentile(values, uniformWeights, p)` for backward compatibility

### 2. Outlier Detection (MAD + IQR fence)

Applied to `rentPerM2` values before estimation:

- **MAD method** (n >= 8): `MAD = median(|xi - median(x)|)`. Remove values where `|xi - median| > 3 * MAD * 1.4826`
- **IQR fence** (n < 8): Remove values outside `[Q1 - 1.5*IQR, Q3 + 1.5*IQR]`

Only applied to the per-m² method path. The direct rent fallback is too heterogeneous for reliable outlier detection.

### 3. State/Condition Adjustment

Applies a multiplicative factor based on the subject property's condition relative to the comparable set's modal condition.

**State factors:**
| State | Factor |
|---|---|
| nuevo | 1.10 |
| reformado | 1.08 |
| buen estado (or undetected) | 1.0 |
| regular | 0.92 |
| para reformar | 0.82 |

**Logic:**
- If subject state is unknown or missing → no adjustment (factor = 1.0)
- Find modal (most frequent) state among comparables
- `factor = subjectFactor / modeFactor`
- Apply after weighted median: `adjustedRent = weightedMedian * factor`

### 4. Confidence System

A composite confidence score (0-100) replaces the simple count-based label:

| Component | Weight | Measure |
|---|---|---|
| Effective sample size | 35% | `sum(normalizedScores)` donde cada score se normaliza a [0,1] dividiendo por 75 (máximo alcanzable) |
| Dispersion | 30% | CV of rentPerM2 (or direct rents in fallback): <0.15=baja, <0.30=moderada, >=0.30=alta. Fallback caps at "medium" |
| Coverage | 20% | % of comparables with score >= 50 |
| Reference support | 15% | If referencePrice exists and deviation < 20% |

**Mapping to labels (backward compatible):**
| Score | Label |
|---|---|
| >= 75 | high |
| 40-74 | medium |
| < 40 | low |

**New output fields:**
```js
confidenceSignals: {
  score: number,            // 0-100
  effectiveSampleSize: number,
  coefficientOfVariation: number,
  dispersionLabel: "baja" | "moderada" | "alta",
  stateAdjusted: boolean,
  adjustmentFactor: number | null,
  comparablesAfterOutlierRemoval: number,
  outliersRemoved: number,
}
```

### 5. Tests (vitest)

Test file: `src/core/__tests__/domain-core.test.cjs`

**Test cases:**
- `weightedPercentile` with uniform weights = simple percentile
- `weightedPercentile` with dominant weight
- `weightedPercentile` edge cases (p=0, p=1, empty arrays)
- `buildRentEstimate` with 0 comparables → null estimate, low confidence
- `buildRentEstimate` with >=3 per-m² comparables → uses weighted percentile of rentPerM2
- `buildRentEstimate` with <3 per-m² comparables → fallback to direct rent
- `buildRentEstimate` with outlier present → outlier removed
- `buildRentEstimate` with state adjustment → factor applied
- `detectOutliers` with MAD method
- `detectOutliers` with IQR fence
- `getComparableRejectionReason` for each filter type
- `buildComparableScore` exact match
- `buildComparableScore` partial match

## Implementation Plan

### Step 1: Implement core functions in domain-core.cjs

1.1 Add `weightedPercentile(values, weights, p)` 
1.2 Refactor `percentile(values, p)` to delegate to `weightedPercentile`
1.3 Add `detectOutliers(values)` using MAD (n>=8) and IQR fence (n<8)
1.4 Add `computeStateAdjustment(subjectState, comparableStates)` with state factors — handle alias normalization ("nueva construccion"→"nuevo", "reacondicionado"→"reformado")
1.5 Add `computeConfidenceScore(comparables, cv, referenceDeviationPct)` 
1.6 Refactor `buildRentEstimate()`:
    - Use weightedPercentile instead of percentile
    - Apply outlier detection before estimation
    - Apply state adjustment after estimation
    - Compute and return confidenceSignals

### Step 2: Sync to extension copy

2.1 Copy changes from `src/core/domain-core.cjs` to `extension/core/domain-core.js`

### Step 3: Add tests

3.1 `npm install vitest --save-dev`
3.2 Create `src/core/__tests__/domain-core.test.cjs`
3.3 Add test script to `package.json`
3.4 Implement test cases from the list above

## Files Changed

| File | Change |
|---|---|
| `src/core/domain-core.cjs` | Add weightedPercentile, detectOutliers, computeStateAdjustment, computeConfidenceScore; refactor buildRentEstimate |
| `extension/core/domain-core.js` | Sync of above |
| `package.json` | Add vitest devDep, add "test" script |
| `src/core/__tests__/domain-core.test.cjs` | New file, all tests |
