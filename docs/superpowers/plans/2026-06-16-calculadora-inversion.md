# Calculadora de Inversión Inmobiliaria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side "what-if" calculator that lets users simulate all financial variables affecting a buy-to-rent property investment and see ROI metrics update in real time.

**Architecture:** Pure client-side React with a TypeScript calculation engine. No server required. The calculator uses the same profitability logic as the existing `domain-core.cjs` but makes every assumption editable.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing CSS variables and layout patterns.

## Global Constraints

- All calculations run in the browser (no API calls)
- All monetary values formatted with `Intl.NumberFormat("es-ES")`
- All text in Spanish (matches existing UI)
- Use existing CSS variables (`--accent`, `--good`, `--warn`, `--bad`, `--surface`, etc.)
- Follow existing `.field`, `.field-grid`, `.card`, `.card-header`, `.action-row`, `.stack` patterns
- No auth required for the calculator page
- All inputs are editable — outputs update instantly via `useMemo`
- Annual costs show both annual amount and monthly equivalent

---

## Tasks

### Task 1: ITP rates lookup table

**Files:** `lib/calculator/itp.ts`

- Create a map of Spanish autonomous communities → ITP transfer tax rates
- Export sorted list of community names for `<select>` dropdown
- Export `getItpRate(community)` function (default 6% for unknown)

Rates:
```
Andalucía 8%, Aragón 8%, Asturias 8%, Baleares 8%, Canarias 6.5%, Cantabria 10%,
Castilla - La Mancha 9%, Castilla León 8%, Cataluña 10%, Ceuta 6%,
Comunidad de Madrid 6%, Comunidad Valenciana 10%, Extremadura 8%, Galicia 9%,
La Rioja 7%, Melilla 6%, Murcia 8%, Navarra 6%, País Vasco 4%
```

### Task 2: Calculation engine

**Files:** `lib/calculator/engine.ts`

Pure function `calculate(input: CalculatorInput): CalculatorOutput` that computes:

**Inputs:**
- Property: `price`, `monthlyRent`
- Acquisition costs: `itpRate`, `notaryRegistry`, `mortgageFees`, `renovationCost`, `purchaseCommission`, `furnitureOther`
- Mortgage: `loanToValue` (default 0.7), `interestRate` (default 0.022), `mortgageTermYears` (default 25)
- Annual costs: `ibiBasuras`, `insurance`, `community`, `maintenance`, `vacancyMonths`

**Outputs:**
- `acquisitionCosts` breakdown + total
- `mortgage` principal, down payment, monthly payment (fixed amortization), annual cost
- `cashBreakdown` down payment, acquisition total, total cash needed, pending financing
- `annualCosts` breakdown + total (including vacancy loss)
- `monthlyCosts` mortgage, operating, total
- `income` monthly rent, annual gross, annual effective (after vacancy), annual net cash flow, monthly net cash flow
- `roi` gross yield, net yield, cash-on-cash, cash-on-cash net (null when incalculable)

### Task 3: Calculator UI component

**Files:** `components/property-calculator.tsx`

Client component with sections:

1. **Property card** — price + estimated monthly rent inputs (side by side)
2. **Acquisition costs card** — ITP community selector + editable rate, ITP calculated output, notary, mortgage fees, commission, furniture, renovation toggle (Sí/No, cost default 3000€)
3. **Mortgage card** — LTV %, interest rate %, term years, calculated outputs (capital pendiente, monthly payment)
4. **Annual costs card** — Grid with rows per concept showing annual input + monthly reference; vacancy in months/year
5. **Cash needed card** — Down payment, acquisition costs, total cash needed
6. **ROI metrics card** — 4 ROI cards with tone colors (green/yellow/red)
7. **Monthly cash flow card** — Income, mortgage, operating costs, net flow

All wired with `useState` + `useMemo` for instant recalculation.

### Task 4: Page and navigation

**Files:** `app/calculator/page.tsx`, `app/layout.tsx`

- Server component page rendering the `PropertyCalculator` client component
- Add "Calculadora" nav link in the site header
- Descriptive copy explaining the simulator

### Task 5: Styles

**File:** `app/globals.css`

Add calculator-specific classes using existing CSS variable system:
- `.calc-field-grid` — auto-fill grid for form fields
- `.calc-output` — read-only output field
- `.calc-toggle-row` / `.calc-toggle` — toggle buttons
- `.calc-cost-row` — annual cost line items (concept, annual, monthly)
- `.calc-cash-item` / `.calc-cash-total` — cash breakdown
- `.calc-roi-grid` / `.calc-roi-card` — ROI metric cards with tone variants
- `.calc-flow-grid` / `.calc-flow-item` — monthly cash flow with positive/negative states
- Responsive overrides for mobile

### Task 6 (optional): Plan document

Create this plan document at `docs/superpowers/plans/2026-06-16-calculadora-inversion.md`
