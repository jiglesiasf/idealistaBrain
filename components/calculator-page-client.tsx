"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PropertyCalculator } from "@/components/property-calculator";
import type { CalculatorInput } from "@/lib/calculator/engine";

function CalculatorWithParams() {
  const searchParams = useSearchParams();

  const initialValues: Partial<CalculatorInput> = {};

  const price = searchParams.get("price");
  const monthlyRent = searchParams.get("monthlyRent");

  if (price) {
    const parsed = Number.parseInt(price, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      initialValues.price = parsed;
    }
  }

  if (monthlyRent) {
    const parsed = Number.parseInt(monthlyRent, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      initialValues.monthlyRent = parsed;
    }
  }

  return <PropertyCalculator initialValues={initialValues} />;
}

export function CalculatorPageClient() {
  return (
    <Suspense fallback={<div className="stack"><section className="card"><p className="muted">Cargando calculadora...</p></section></div>}>
      <CalculatorWithParams />
    </Suspense>
  );
}
