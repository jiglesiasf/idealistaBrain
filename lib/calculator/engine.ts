export interface CalculatorInput {
  price: number;
  monthlyRent: number;
  itpRate: number;
  notaryRegistry: number;
  mortgageFees: number;
  renovationCost: number;
  purchaseCommission: number;
  furnitureOther: number;
  loanToValue: number;
  interestRate: number;
  mortgageTermYears: number;
  ibiBasuras: number;
  insurance: number;
  community: number;
  maintenance: number;
  vacancyMonths: number;
}

export interface CalculatorOutput {
  acquisitionCosts: {
    itp: number;
    notaryRegistry: number;
    mortgageFees: number;
    renovationCost: number;
    purchaseCommission: number;
    furnitureOther: number;
    total: number;
  };
  mortgage: {
    loanToValue: number;
    interestRate: number;
    termYears: number;
    principal: number;
    downPayment: number;
    monthlyPayment: number;
    annualCost: number;
  };
  cashBreakdown: {
    downPayment: number;
    totalAcquisitionCosts: number;
    totalCashNeeded: number;
    pendingFinancing: number;
  };
  annualCosts: {
    ibiBasuras: number;
    insurance: number;
    community: number;
    maintenance: number;
    vacancyLoss: number;
    total: number;
  };
  monthlyCosts: {
    mortgage: number;
    operating: number;
    total: number;
  };
  income: {
    monthlyRent: number;
    annualGrossRent: number;
    annualEffectiveRent: number;
    annualNetCashFlow: number;
    monthlyNetCashFlow: number;
  };
  roi: {
    grossYield: number | null;
    netYield: number | null;
    cashOnCashRoi: number | null;
    cashOnCashNetRoi: number | null;
  };
}

function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  const totalPayments = Math.round(termYears * 12);
  if (totalPayments <= 0) return 0;
  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    return principal / totalPayments;
  }
  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, totalPayments);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function roundMoney(value: number): number {
  return Math.round(value);
}

export type TargetPrice = {
  targetPrice: number;
  roi: number | null;
} | null;

export type TargetRent = {
  targetRent: number;
  roi: number | null;
} | null;

export function calculateTargetPrice(input: CalculatorInput): TargetPrice {
  const monthly = input.monthlyRent;
  if (monthly <= 0) return null;

  const price = findTargetDown(input, "price", 0.07);
  if (price === null) return null;

  const result = calculate({ ...input, price });
  return {
    targetPrice: price,
    roi: result.roi.cashOnCashNetRoi,
  };
}

export function calculateTargetRent(input: CalculatorInput): TargetRent {
  const p = input.price;
  if (p <= 0) return null;

  const rent = findTargetUp(input, "monthlyRent", 0.07);
  if (rent === null) return null;

  const result = calculate({ ...input, monthlyRent: rent });
  return {
    targetRent: rent as number,
    roi: result.roi.cashOnCashNetRoi,
  };
}

function findTargetDown(input: CalculatorInput, field: "price", target: number): number | null {
  const monthly = input.monthlyRent;
  if (monthly <= 0) return null;

  const currentResult = calculate(input);
  if (currentResult.roi.cashOnCashNetRoi === null) return null;

  if (currentResult.roi.cashOnCashNetRoi >= target) {
    return input[field];
  }

  const lowerBound = roundMoney(monthly * 12 / 0.30);
  const resultAtLow = calculate({ ...input, [field]: lowerBound });

  if (resultAtLow.roi.cashOnCashNetRoi === null || resultAtLow.roi.cashOnCashNetRoi < target) {
    return null;
  }

  let low = lowerBound;
  let high = input[field];

  for (let i = 0; i < 50; i++) {
    const mid = roundMoney((low + high) / 2);
    const result = calculate({ ...input, [field]: mid });

    if (result.roi.cashOnCashNetRoi === null) return null;

    if (result.roi.cashOnCashNetRoi >= target) {
      low = mid;
    } else {
      high = mid;
    }

    if (high - low <= 1) break;
  }

  return roundMoney((low + high) / 2);
}

function findTargetUp(input: CalculatorInput, field: "monthlyRent", target: number): number | null {
  const p = input.price;
  if (p <= 0) return null;

  const currentResult = calculate(input);
  if (currentResult.roi.cashOnCashNetRoi === null) return null;

  if (currentResult.roi.cashOnCashNetRoi >= target) {
    return input[field];
  }

  const upperBound = roundMoney(p * 0.30 / 12);
  const resultAtHigh = calculate({ ...input, [field]: upperBound });

  if (resultAtHigh.roi.cashOnCashNetRoi === null || resultAtHigh.roi.cashOnCashNetRoi < target) {
    return null;
  }

  let low = input[field];
  let high = upperBound;

  for (let i = 0; i < 50; i++) {
    const mid = roundMoney((low + high) / 2);
    const result = calculate({ ...input, [field]: mid });

    if (result.roi.cashOnCashNetRoi === null) return null;

    if (result.roi.cashOnCashNetRoi >= target) {
      high = mid;
    } else {
      low = mid;
    }

    if (high - low <= 1) break;
  }

  return roundMoney((low + high) / 2);
}

export function calculate(input: CalculatorInput): CalculatorOutput {
  const p = input.price;
  const monthly = input.monthlyRent;

  const downPayment = roundMoney(p * (1 - input.loanToValue));
  const mortgagePrincipal = roundMoney(p * input.loanToValue);

  const itp = roundMoney(p * input.itpRate);
  const acquisitionTotal =
    itp +
    input.notaryRegistry +
    input.mortgageFees +
    input.renovationCost +
    input.purchaseCommission +
    input.furnitureOther;

  const monthlyMortgage = roundMoney(
    calculateMonthlyPayment(mortgagePrincipal, input.interestRate, input.mortgageTermYears)
  );

  const annualRentGross = monthly * 12;
  const vacancyLoss = roundMoney(annualRentGross * (input.vacancyMonths / 12));
  const annualEffectiveRent = annualRentGross - vacancyLoss;

  const annualOperatingTotal =
    input.ibiBasuras +
    input.insurance +
    input.community +
    input.maintenance +
    vacancyLoss;

  const annualMortgage = monthlyMortgage * 12;
  const annualNet = annualEffectiveRent - annualOperatingTotal - annualMortgage;

  const cashNeeded = downPayment + acquisitionTotal;

  return {
    acquisitionCosts: {
      itp,
      notaryRegistry: input.notaryRegistry,
      mortgageFees: input.mortgageFees,
      renovationCost: input.renovationCost,
      purchaseCommission: input.purchaseCommission,
      furnitureOther: input.furnitureOther,
      total: acquisitionTotal,
    },
    mortgage: {
      loanToValue: input.loanToValue,
      interestRate: input.interestRate,
      termYears: input.mortgageTermYears,
      principal: mortgagePrincipal,
      downPayment,
      monthlyPayment: monthlyMortgage,
      annualCost: annualMortgage,
    },
    cashBreakdown: {
      downPayment,
      totalAcquisitionCosts: acquisitionTotal,
      totalCashNeeded: cashNeeded,
      pendingFinancing: mortgagePrincipal,
    },
    annualCosts: {
      ibiBasuras: input.ibiBasuras,
      insurance: input.insurance,
      community: input.community,
      maintenance: input.maintenance,
      vacancyLoss,
      total: annualOperatingTotal,
    },
    monthlyCosts: {
      mortgage: monthlyMortgage,
      operating: roundMoney(annualOperatingTotal / 12),
      total: roundMoney(annualOperatingTotal / 12 + monthlyMortgage),
    },
    income: {
      monthlyRent: monthly,
      annualGrossRent: annualRentGross,
      annualEffectiveRent,
      annualNetCashFlow: annualNet,
      monthlyNetCashFlow: roundMoney(annualNet / 12),
    },
    roi: {
      grossYield:
        p > 0 ? annualRentGross / p : null,
      netYield:
        p > 0 ? (annualEffectiveRent - annualOperatingTotal) / p : null,
      cashOnCashRoi:
        cashNeeded > 0
          ? (annualEffectiveRent - annualOperatingTotal) / cashNeeded
          : null,
      cashOnCashNetRoi:
        cashNeeded > 0 ? annualNet / cashNeeded : null,
    },
  };
}
