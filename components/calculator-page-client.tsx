"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PropertyCalculator } from "@/components/property-calculator";
import type { CalculatorInput } from "@/lib/calculator/engine";

function parseNum(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function CalculatorWithParams() {
  const searchParams = useSearchParams();

  const initialValues: Partial<CalculatorInput> = {};

  const price = parseNum(searchParams.get("price"));
  const monthlyRent = parseNum(searchParams.get("monthlyRent"));
  const itpRate = parseNum(searchParams.get("itpRate"));
  const notaryRegistry = parseNum(searchParams.get("notaryRegistry"));
  const mortgageFees = parseNum(searchParams.get("mortgageFees"));
  const renovationCost = parseNum(searchParams.get("renovationCost"));
  const purchaseCommission = parseNum(searchParams.get("purchaseCommission"));
  const furnitureOther = parseNum(searchParams.get("furnitureOther"));
  const loanToValue = parseNum(searchParams.get("loanToValue"));
  const interestRate = parseNum(searchParams.get("interestRate"));
  const mortgageTermYears = parseNum(searchParams.get("mortgageTermYears"));
  const ibiBasuras = parseNum(searchParams.get("ibiBasuras"));
  const insurance = parseNum(searchParams.get("insurance"));
  const community = parseNum(searchParams.get("community"));
  const maintenance = parseNum(searchParams.get("maintenance"));
  const vacancyMonths = parseNum(searchParams.get("vacancyMonths"));
  const idealistaUrl = searchParams.get("idealistaUrl");

  if (price && price > 0) initialValues.price = price;
  if (monthlyRent && monthlyRent > 0) initialValues.monthlyRent = monthlyRent;
  if (itpRate && itpRate > 0) initialValues.itpRate = itpRate;
  if (notaryRegistry && notaryRegistry > 0) initialValues.notaryRegistry = notaryRegistry;
  if (mortgageFees && mortgageFees > 0) initialValues.mortgageFees = mortgageFees;
  if (renovationCost && renovationCost > 0) initialValues.renovationCost = renovationCost;
  if (purchaseCommission) initialValues.purchaseCommission = purchaseCommission;
  if (furnitureOther && furnitureOther > 0) initialValues.furnitureOther = furnitureOther;
  if (loanToValue && loanToValue > 0 && loanToValue <= 1) initialValues.loanToValue = loanToValue;
  if (interestRate && interestRate > 0) initialValues.interestRate = interestRate;
  if (mortgageTermYears && mortgageTermYears > 0) initialValues.mortgageTermYears = mortgageTermYears;
  if (ibiBasuras && ibiBasuras > 0) initialValues.ibiBasuras = ibiBasuras;
  if (insurance && insurance > 0) initialValues.insurance = insurance;
  if (community && community > 0) initialValues.community = community;
  if (maintenance && maintenance > 0) initialValues.maintenance = maintenance;
  if (vacancyMonths && vacancyMonths > 0) initialValues.vacancyMonths = vacancyMonths;

  return <PropertyCalculator initialValues={initialValues} initialIdealistaUrl={idealistaUrl ?? undefined} />;
}

export function CalculatorPageClient() {
  return (
    <Suspense fallback={<div className="stack"><section className="card"><p className="muted">Cargando calculadora...</p></section></div>}>
      <CalculatorWithParams />
    </Suspense>
  );
}
