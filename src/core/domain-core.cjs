(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.IdealistaBrainCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TARGET_COMPARABLES = 10;
  const MAX_CANDIDATES_PER_SCOPE_URL = 36;
  const COMPARABLE_AREA_TOLERANCE = 0.7;
  const COMPARABLE_ROOMS_TOLERANCE = 2;
  const DEFAULT_PROFITABILITY_ASSUMPTIONS = Object.freeze({
    buyerCashContributionRatio: 0.3,
    downPaymentRatio: 0.2,
    acquisitionCostRatio: 0.1,
    loanToValueRatio: 0.8,
    fixedMortgageInterestRate: 0.028,
    mortgageTermYears: 25,
    vacancyRatio: 0.083,
    managementRatio: 0.08,
    maintenanceRatio: 0.026,
    localTaxesAndCommunityRatio: 0.069,
    insuranceAndIncidentsRatio: 0.031,
  });
  const STATE_FACTORS = Object.freeze({
    nuevo: 1.10,
    reformado: 1.08,
    "buen-estado": 1.0,
    regular: 0.92,
    "para-reformar": 0.82,
  });

  const STATE_ALIASES = Object.freeze({
    "nueva-construccion": "nuevo",
    "nuevo-construccion": "nuevo",
    "reacondicionado": "reformado",
    "recien-reformado": "reformado",
    "a-reformar": "para-reformar",
    "a-rehabilitar": "para-reformar",
    "reforma": "para-reformar",
  });

  const CONFIDENCE_WEIGHTS = Object.freeze({
    SAMPLE_SIZE: 0.35,
    DISPERSION: 0.30,
    COVERAGE: 0.20,
    REFERENCE: 0.15,
  });

  const MAX_SCORE = 75;

  function normalizeState(state) {
    const key = normalizeForCompare(state);
    return STATE_ALIASES[key] || key;
  }

  const REFERENCE_RENTAL_PRICES = Object.freeze({
    valencia: {
      cityAvg: { rentPerM2: 15.5, source: "idealista/data" },
      districts: Object.freeze({
        "ciutat-vella": { rentPerM2: 19.0, source: "idealista/data" },
        "eixample": { rentPerM2: 16.7, source: "idealista/data" },
        "l-eixample": { rentPerM2: 16.7, source: "idealista/data" },
        "el-pla-del-real": { rentPerM2: 14.0, source: "idealista/data" },
        "pla-del-real": { rentPerM2: 14.0, source: "idealista/data" },
        "extramurs": { rentPerM2: 15.6, source: "idealista/data" },
        "campanar": { rentPerM2: 15.4, source: "idealista/data" },
        "camins-al-grau": { rentPerM2: 14.9, source: "idealista/data" },
        "quatre-carreres": { rentPerM2: 15.0, source: "idealista/data" },
        "algiron": { rentPerM2: 14.0, source: "idealista/data" },
        "algiron-s": { rentPerM2: 14.0, source: "idealista/data" },
        "benimaclet": { rentPerM2: 13.2, source: "idealista/data" },
        "poblats-maritims": { rentPerM2: 16.2, source: "idealista/data" },
        "la-saidia": { rentPerM2: 14.3, source: "idealista/data" },
        "la-saïdia": { rentPerM2: 14.3, source: "idealista/data" },
        "patraix": { rentPerM2: 13.1, source: "idealista/data" },
        "jesus": { rentPerM2: 13.7, source: "idealista/data" },
        "benicalap": { rentPerM2: 14.7, source: "idealista/data" },
        "l-olivereta": { rentPerM2: 13.8, source: "idealista/data" },
        "olivereta": { rentPerM2: 13.8, source: "idealista/data" },
        "rascanya": { rentPerM2: 14.0, source: "idealista/data" },
        "pobles-de-l-oest": { rentPerM2: 17.6, source: "idealista/data" },
        "pobles-del-nord": { rentPerM2: 11.4, source: "idealista/data" },
        "pobles-del-sud": { rentPerM2: 13.1, source: "idealista/data" },
      }),
    },
    xativa: { cityAvg: { rentPerM2: 8.3, source: "idealista/data" } },
    gandia: { cityAvg: { rentPerM2: 12.6, source: "idealista/data" } },
    torrent: { cityAvg: { rentPerM2: 12.5, source: "idealista/data" } },
    sagunt: { cityAvg: { rentPerM2: 13.1, source: "idealista/data" } },
    "sagunto-sagunt": { cityAvg: { rentPerM2: 13.1, source: "idealista/data" } },
    alzira: { cityAvg: { rentPerM2: 7.5, source: "idealista/data" } },
    burjassot: { cityAvg: { rentPerM2: 11.2, source: "idealista/data" } },
    "burriana": { cityAvg: { rentPerM2: 7.3, source: "idealista/data" } },
    "elda": { cityAvg: { rentPerM2: 8.1, source: "idealista/data" } },
    "alcoi": { cityAvg: { rentPerM2: 8.2, source: "idealista/data" } },
    "alcoy": { cityAvg: { rentPerM2: 8.2, source: "idealista/data" } },
    "benidorm": { cityAvg: { rentPerM2: 18.8, source: "idealista/data" } },
    "alboraia": { cityAvg: { rentPerM2: 17.3, source: "idealista/data" } },
    "alboraya": { cityAvg: { rentPerM2: 17.3, source: "idealista/data" } },
    "alcoy-alcoi": { cityAvg: { rentPerM2: 8.2, source: "idealista/data" } },
  });

  function lookupReferencePrice(municipality, district) {
    const cityKey = slugify(municipality || "");
    const cityData = REFERENCE_RENTAL_PRICES[cityKey];

    if (!cityData) return null;

    if (district) {
      const districtKey = slugify(district);
      if (cityData.districts[districtKey]) {
        return cityData.districts[districtKey];
      }
      for (const [key, value] of Object.entries(cityData.districts)) {
        if (key.includes(districtKey) || districtKey.includes(key)) {
          return value;
        }
      }
    }

    return cityData.cityAvg;
  }

  const ROI_SORT_OPTIONS = Object.freeze({
    cashOnCashRoi: "ROI cash to cash",
    cashOnCashNetRoi: "ROI cash to cash neto",
    grossRoi: "ROI bruto",
    netRoi: "ROI neto",
  });

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function slugify(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeForCompare(value) {
    return slugify(value || "");
  }

  function getPropertyFamily(type) {
    const normalized = normalizeForCompare(type || "");
    if (!normalized) {
      return null;
    }

    if (normalized.includes("casa") || normalized.includes("chalet")) {
      return "house";
    }

    if (
      normalized.includes("piso") ||
      normalized.includes("apartamento") ||
      normalized.includes("atico") ||
      normalized.includes("duplex") ||
      normalized.includes("estudio") ||
      normalized.includes("loft")
    ) {
      return "flat";
    }

    return normalized;
  }

  function isWithinRelativeRange(candidateValue, targetValue, tolerance) {
    if (!Number.isFinite(candidateValue) || !Number.isFinite(targetValue) || targetValue === 0) {
      return false;
    }

    const ratio = Math.abs(candidateValue - targetValue) / targetValue;
    return ratio <= tolerance;
  }

  function weightedPercentile(sortedValues, weights, q) {
    if (sortedValues.length === 0) return null;

    const pairs = [];
    for (let i = 0; i < sortedValues.length; i++) {
      if (weights[i] > 0) {
        pairs.push({ value: sortedValues[i], weight: weights[i] });
      }
    }

    if (pairs.length === 0) return null;
    if (pairs.length === 1) return pairs[0].value;

    const totalWeight = pairs.reduce((sum, p) => sum + p.weight, 0);
    const target = q * totalWeight;
    let cumulative = 0;

    for (let i = 0; i < pairs.length; i++) {
      cumulative += pairs[i].weight;
      if (cumulative >= target) {
        return pairs[i].value;
      }
    }

    return pairs[pairs.length - 1].value;
  }

  function percentile(sortedValues, q) {
    const uniformWeights = sortedValues.map(() => 1);
    return weightedPercentile(sortedValues, uniformWeights, q);
  }

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

  function roundMoney(value) {
    return Math.round(value);
  }

  function buildSearchStrategy(targetAsset) {
    const zone = targetAsset.zone || targetAsset.neighborhood || targetAsset.district || null;
    const municipality = targetAsset.municipality || null;

    return {
      minimumValidComparables: TARGET_COMPARABLES,
      keepCollectingBeyondMinimum: true,
      scopes: [
        {
          id: "zone",
          order: 1,
          label: "misma zona",
          active: Boolean(zone),
          areaName: zone,
          municipality,
          stopWhenValidComparablesAtLeast: TARGET_COMPARABLES,
        },
        {
          id: "municipality",
          order: 2,
          label: "mismo municipio",
          active: Boolean(municipality),
          areaName: municipality,
          municipality,
          activateWhenValidComparablesBelow: TARGET_COMPARABLES,
        },
      ],
      doNotExpandBeyondMunicipality: true,
    };
  }

  function buildComparableRules() {
    return {
      hardFilters: [
        "mismo municipio",
        "misma tipologia",
        "excluir 404",
        "excluir alquiler temporal",
        "excluir habitaciones",
        "excluir locales, garajes y trasteros",
      ],
      softFilters: [
        "priorizar misma zona",
        "habitaciones iguales o +/-2",
        "superficie dentro de +/-70%",
        "estado parecido cuando este disponible",
      ],
      scoringWeights: {
        sameZone: 40,
        sameMunicipality: 25,
        similarRooms: 15,
        similarArea: 15,
        similarCondition: 5,
      },
    };
  }

  function buildGuardrails(location, searchStrategy, comparableRules) {
    return {
      knownProvince: Boolean(location.province),
      detectedProvince: location.province || null,
      mustMatchProvince: false,
      mustMatchCity: Boolean(location.city),
      preferredDistrict: location.district || null,
      preferredNeighborhood: location.neighborhood || null,
      rejectCrossProvinceResults: false,
      rejectCrossCityResults: Boolean(location.city),
      minimumValidComparables: searchStrategy.minimumValidComparables,
      searchOrder: searchStrategy.scopes.filter((scope) => scope.active).map((scope) => scope.label),
      hardFilters: comparableRules.hardFilters,
    };
  }

  function buildComparableScore(subjectAsset, comparableAsset, scopeId) {
    let score = 0;

    if (scopeId === "zone") {
      score += 40;
    } else {
      score += 20;
    }

    if (subjectAsset.rooms && comparableAsset.rooms && Math.abs(subjectAsset.rooms - comparableAsset.rooms) === 0) {
      score += 15;
    } else if (
      subjectAsset.rooms &&
      comparableAsset.rooms &&
      Math.abs(subjectAsset.rooms - comparableAsset.rooms) === 1
    ) {
      score += 10;
    } else if (
      subjectAsset.rooms &&
      comparableAsset.rooms &&
      Math.abs(subjectAsset.rooms - comparableAsset.rooms) === 2
    ) {
      score += 5;
    }

    if (
      subjectAsset.areaM2 &&
      comparableAsset.areaM2 &&
      isWithinRelativeRange(comparableAsset.areaM2, subjectAsset.areaM2, 0.1)
    ) {
      score += 15;
    } else if (
      subjectAsset.areaM2 &&
      comparableAsset.areaM2 &&
      isWithinRelativeRange(comparableAsset.areaM2, subjectAsset.areaM2, COMPARABLE_AREA_TOLERANCE)
    ) {
      score += 8;
    }

    if (
      subjectAsset.state &&
      comparableAsset.state &&
      normalizeForCompare(subjectAsset.state) === normalizeForCompare(comparableAsset.state)
    ) {
      score += 5;
    }

    return score;
  }

  function getComparableRejectionReason(subject, candidateContext, scopeId) {
    const subjectAsset = subject.targetAsset || {};
    const candidateAsset = candidateContext.targetAsset || {};
    const candidateText = normalizeText(
      `${candidateContext.page?.title || ""} ${candidateContext.rawSignals?.pageTextSample || ""}`
    ).toLowerCase();

    if (candidateAsset.operation !== "rent") {
      return "No es una ficha de alquiler.";
    }

    if (/\btemporada\b|\balquiler temporal\b/i.test(candidateText)) {
      return "Alquiler temporal.";
    }

    if (/\bhabitaci[oó]n\b/i.test(candidateText)) {
      return "Habitacion suelta.";
    }

    if (/\blocal\b|\bgaraje\b|\btrastero\b/i.test(candidateText)) {
      return "Activo no residencial comparable.";
    }

    if (
      subjectAsset.municipality &&
      candidateAsset.municipality &&
      normalizeForCompare(subjectAsset.municipality) !== normalizeForCompare(candidateAsset.municipality)
    ) {
      return "Municipio distinto.";
    }

    if (scopeId === "zone" && subjectAsset.zone && candidateAsset.zone) {
      const subjectZone = normalizeForCompare(subjectAsset.zone);
      const candidateZone = normalizeForCompare(candidateAsset.zone);

      if (!candidateZone.includes(subjectZone) && !subjectZone.includes(candidateZone)) {
        return "Fuera de la zona base.";
      }
    }

    const subjectFamily = getPropertyFamily(subjectAsset.propertyType);
    const candidateFamily = getPropertyFamily(candidateAsset.propertyType);

    if (subjectFamily && candidateFamily && subjectFamily !== candidateFamily) {
      return "Tipologia distinta.";
    }

    if (
      Number.isFinite(subjectAsset.rooms) &&
      Number.isFinite(candidateAsset.rooms) &&
      Math.abs(subjectAsset.rooms - candidateAsset.rooms) > COMPARABLE_ROOMS_TOLERANCE
    ) {
      return "Habitaciones fuera de +/-2.";
    }

    if (
      Number.isFinite(subjectAsset.areaM2) &&
      Number.isFinite(candidateAsset.areaM2) &&
      !isWithinRelativeRange(candidateAsset.areaM2, subjectAsset.areaM2, COMPARABLE_AREA_TOLERANCE)
    ) {
      return "Superficie fuera de +/-70%.";
    }

    if (!candidateAsset.priceEur) {
      return "No se ha detectado renta mensual.";
    }

    return null;
  }

  function buildComparableRecord(subject, context, candidate, scopeId) {
    const asset = context.targetAsset || {};
    const distanceScore = buildComparableScore(subject.targetAsset || {}, asset, scopeId);

    return {
      listingId: asset.listingId,
      scope: scopeId,
      url: context.page?.canonicalUrl,
      title: context.page?.title,
      propertyType: asset.propertyType,
      priceEur: asset.priceEur,
      areaM2: asset.areaM2,
      rentPerM2: asset.priceEur && asset.areaM2 ? Number((asset.priceEur / asset.areaM2).toFixed(2)) : null,
      rooms: asset.rooms,
      bathrooms: asset.bathrooms,
      zone: asset.zone,
      municipality: asset.municipality,
      province: asset.province,
      state: asset.state,
      score: distanceScore,
      sourceSearchUrl: candidate.sourceSearchUrl,
    };
  }

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
      const paired = perM2Comparables
        .map((item, i) => ({ value: item.rentPerM2, score: item.score || 0 }))
        .sort((a, b) => a.value - b.value);
      const sortedValues = paired.map(p => p.value);
      const sortedScores = paired.map(p => p.score);

      const outlierIndices = detectOutliers(sortedValues);
      const outlierValues = new Set(outlierIndices);
      const cleanedValues = sortedValues.filter((_, i) => !outlierValues.has(i));
      const cleanedScores = sortedScores.filter((_, i) => !outlierValues.has(i));

      if (cleanedValues.length >= 3) {
        const weights = cleanedScores.map(s => Math.max(s, 1));
        const basePerM2 = weightedPercentile(cleanedValues, weights, 0.5);
        const lowPerM2 = weightedPercentile(cleanedValues, weights, 0.25);
        const highPerM2 = weightedPercentile(cleanedValues, weights, 0.75);

        const subjectState = subject.targetAsset?.state;
        const comparableStates = perM2Comparables.map(c => c.state);
        const stateFactor = computeStateAdjustment(subjectState, comparableStates);

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

  function calculateFixedMonthlyMortgagePayment(principalEur, annualRate, termYears) {
    if (!Number.isFinite(principalEur) || principalEur <= 0) {
      return null;
    }

    const totalPayments = Math.round(termYears * 12);

    if (!Number.isFinite(totalPayments) || totalPayments <= 0) {
      return null;
    }

    if (!Number.isFinite(annualRate) || annualRate <= 0) {
      return principalEur / totalPayments;
    }

    const monthlyRate = annualRate / 12;
    const factor = Math.pow(1 + monthlyRate, totalPayments);

    return (principalEur * monthlyRate * factor) / (factor - 1);
  }

  function buildProfitabilityEstimate(subject, rentEstimate, overrides) {
    const assumptions = {
      ...DEFAULT_PROFITABILITY_ASSUMPTIONS,
      ...(overrides || {}),
    };
    const purchasePriceEur = subject?.targetAsset?.priceEur;
    const monthlyRentEur = rentEstimate?.monthlyRentEur;

    if (!Number.isFinite(purchasePriceEur) || !Number.isFinite(monthlyRentEur)) {
      return {
        ready: false,
        assumptions,
        notes: [
          "Hace falta precio de compra y estimacion de alquiler para calcular rentabilidad.",
          "El ROI cash to cash neto usa una hipoteca fija simplificada, no una oferta bancaria real.",
        ],
      };
    }

    const annualGrossRentEur = monthlyRentEur * 12;
    const acquisitionCostEur = roundMoney(purchasePriceEur * assumptions.acquisitionCostRatio);
    const totalAcquisitionCostEur = purchasePriceEur + acquisitionCostEur;
    const downPaymentEur = roundMoney(purchasePriceEur * assumptions.downPaymentRatio);
    const financedPrincipalEur = roundMoney(purchasePriceEur * assumptions.loanToValueRatio);
    const cashInvestedEur = downPaymentEur + acquisitionCostEur;
    const monthlyMortgagePaymentEur = roundMoney(
      calculateFixedMonthlyMortgagePayment(
        financedPrincipalEur,
        assumptions.fixedMortgageInterestRate,
        assumptions.mortgageTermYears
      )
    );
    const annualMortgageCostEur = monthlyMortgagePaymentEur * 12;

    const vacancyCostEur = roundMoney(annualGrossRentEur * assumptions.vacancyRatio);
    const managementCostEur = roundMoney(annualGrossRentEur * assumptions.managementRatio);
    const maintenanceCostEur = roundMoney(annualGrossRentEur * assumptions.maintenanceRatio);
    const localTaxesAndCommunityCostEur = roundMoney(
      annualGrossRentEur * assumptions.localTaxesAndCommunityRatio
    );
    const insuranceAndIncidentsCostEur = roundMoney(annualGrossRentEur * assumptions.insuranceAndIncidentsRatio);
    const totalOperatingCostsEur =
      vacancyCostEur +
      managementCostEur +
      maintenanceCostEur +
      localTaxesAndCommunityCostEur +
      insuranceAndIncidentsCostEur;
    const annualNetRentEur = annualGrossRentEur - totalOperatingCostsEur;
    const annualPostDebtCashFlowEur = annualNetRentEur - annualMortgageCostEur;

    return {
      ready: true,
      assumptions,
      inputs: {
        purchasePriceEur,
        monthlyRentEur,
        annualGrossRentEur,
        acquisitionCostEur,
        totalAcquisitionCostEur,
        downPaymentEur,
        equityContributionEur: downPaymentEur,
        financedPrincipalEur,
        cashInvestedEur,
      },
      financing: {
        fixedMortgageInterestRate: assumptions.fixedMortgageInterestRate,
        mortgageTermYears: assumptions.mortgageTermYears,
        monthlyMortgagePaymentEur,
        annualMortgageCostEur,
        annualPostDebtCashFlowEur,
      },
      operatingCosts: {
        vacancyCostEur,
        managementCostEur,
        maintenanceCostEur,
        localTaxesAndCommunityCostEur,
        insuranceAndIncidentsCostEur,
        totalOperatingCostsEur,
        annualNetRentEur,
      },
      metrics: {
        cashOnCashRoi: cashInvestedEur > 0 ? annualNetRentEur / cashInvestedEur : null,
        cashOnCashNetRoi: cashInvestedEur > 0 ? annualPostDebtCashFlowEur / cashInvestedEur : null,
        grossRoi: totalAcquisitionCostEur > 0 ? annualGrossRentEur / totalAcquisitionCostEur : null,
        netRoi: totalAcquisitionCostEur > 0 ? annualNetRentEur / totalAcquisitionCostEur : null,
      },
      notes: [
        "ROI cash to cash: flujo anual neto sobre caja aportada por el comprador.",
        "ROI cash to cash neto: flujo anual tras hipoteca sobre caja aportada.",
        "ROI bruto: renta anual bruta sobre coste total estimado de adquisicion.",
        "ROI neto: renta anual neta tras gastos operativos sobre coste total estimado de adquisicion.",
        "Todavia no se descuenta reforma inicial, fiscalidad real de compra ni condiciones bancarias personalizadas.",
      ],
    };
  }

  function buildZoneOpportunityFromAnalysis(entry) {
    const analysis = entry.analysis || {};
    const subject = analysis.subject || {};
    const asset = subject.targetAsset || {};
    const profitability = analysis.profitability || {};
    const estimate = analysis.estimate || {};
    const metrics = profitability.metrics || {};

    return {
      listingId: subject.page?.listingId || entry.sourceListing?.listingId,
      title: subject.page?.title || entry.sourceListing?.title,
      url: subject.page?.canonicalUrl || entry.sourceListing?.url,
      zone: asset.zone || null,
      municipality: asset.municipality || null,
      priceEur: asset.priceEur || null,
      areaM2: asset.areaM2 || null,
      rooms: asset.rooms || null,
      estimatedRentEur: estimate.monthlyRentEur || null,
      comparablesUsed: estimate.comparablesUsed || 0,
      estimateConfidence: estimate.confidence || "low",
      cashOnCashRoi: metrics.cashOnCashRoi ?? null,
      cashOnCashNetRoi: metrics.cashOnCashNetRoi ?? null,
      grossRoi: metrics.grossRoi ?? null,
      netRoi: metrics.netRoi ?? null,
      profitabilityReady: Boolean(profitability.ready),
    };
  }

  function getOpportunityMetricValue(opportunity, metricKey) {
    const value = opportunity?.[metricKey];
    return Number.isFinite(value) ? value : -Infinity;
  }

  function computeConfidenceScore(comparables, coefficientOfVariation, referenceDeviationPct, method) {
    if (comparables.length === 0) {
      return { score: 0, effectiveSampleSize: 0, coefficientOfVariation: 0, dispersionLabel: 'alta' };
    }

    const totalScore = comparables.reduce((sum, c) => sum + (c.score || 0), 0);
    const effectiveSampleSize = totalScore / MAX_SCORE;
    const sizeScore = Math.min(effectiveSampleSize / 10, 1) * 100;

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

    const goodMatches = comparables.filter(c => (c.score || 0) >= 50).length;
    const coverageScore = (goodMatches / comparables.length) * 100;

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

  function sortZoneOpportunities(opportunities, metricKey) {
    const selectedMetric = ROI_SORT_OPTIONS[metricKey] ? metricKey : "cashOnCashRoi";

    return [...(opportunities || [])].sort((left, right) => {
      const leftValue = getOpportunityMetricValue(left, selectedMetric);
      const rightValue = getOpportunityMetricValue(right, selectedMetric);
      return rightValue - leftValue;
    });
  }

  return {
    TARGET_COMPARABLES,
    MAX_CANDIDATES_PER_SCOPE_URL,
    COMPARABLE_AREA_TOLERANCE,
    COMPARABLE_ROOMS_TOLERANCE,
    DEFAULT_PROFITABILITY_ASSUMPTIONS,
    ROI_SORT_OPTIONS,
    buildSearchStrategy,
    weightedPercentile,
    detectOutliers,
    computeStateAdjustment,
    computeConfidenceScore,
    buildComparableRules,
    buildGuardrails,
    getComparableRejectionReason,
    buildComparableRecord,
    buildRentEstimate,
    buildProfitabilityEstimate,
    buildZoneOpportunityFromAnalysis,
    sortZoneOpportunities,
  };
});
