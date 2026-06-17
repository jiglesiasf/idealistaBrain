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
