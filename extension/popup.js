const analyzeButton = document.querySelector("#analyze-button");
const comparablesButton = document.querySelector("#comparables-button");
const zoneScanButton = document.querySelector("#zone-scan-button");
const copyButton = document.querySelector("#copy-button");
const statusNode = document.querySelector("#status");
const resultNode = document.querySelector("#result");
const zoneResultNode = document.querySelector("#zone-result");
const listingTitleNode = document.querySelector("#listing-title");
const listingMetaNode = document.querySelector("#listing-meta");
const targetAssetNode = document.querySelector("#target-asset");
const locationNameNode = document.querySelector("#location-name");
const locationConfidenceNode = document.querySelector("#location-confidence");
const searchStrategyNode = document.querySelector("#search-strategy");
const comparableRulesNode = document.querySelector("#comparable-rules");
const breadcrumbsNode = document.querySelector("#breadcrumbs");
const candidateLinksNode = document.querySelector("#candidate-links");
const guardrailsNode = document.querySelector("#guardrails");
const coordinatesNode = document.querySelector("#coordinates");
const estimateNode = document.querySelector("#estimate");
const profitabilityNode = document.querySelector("#profitability");
const comparablesNode = document.querySelector("#comparables");
const discardedNode = document.querySelector("#discarded");
const searchTraceNode = document.querySelector("#search-trace");
const zoneSummaryNode = document.querySelector("#zone-summary");
const zoneOpportunitiesNode = document.querySelector("#zone-opportunities");
const zoneFailuresNode = document.querySelector("#zone-failures");
const summaryPriceNode = document.querySelector("#summary-price");
const summaryRentNode = document.querySelector("#summary-rent");
const summaryC2cNode = document.querySelector("#summary-c2c");
const summaryCompsNode = document.querySelector("#summary-comps");
const zoneDetectedNode = document.querySelector("#zone-detected");
const zoneAnalyzedNode = document.querySelector("#zone-analyzed");
const zoneRankedNode = document.querySelector("#zone-ranked");
const zoneBestC2cNode = document.querySelector("#zone-best-c2c");

let lastPayload = null;
let lastComparablesPayload = null;
let lastZoneScanPayload = null;

analyzeButton.addEventListener("click", () => {
  void analyzeCurrentTab();
});

comparablesButton.addEventListener("click", () => {
  void searchComparables();
});

zoneScanButton.addEventListener("click", () => {
  void scanZone();
});

copyButton.addEventListener("click", async () => {
  if (!lastPayload && !lastZoneScanPayload) {
    setStatus("Analiza una ficha o escanea una zona antes de copiar el JSON.", "error");
    return;
  }

  try {
    let payloadToCopy = lastPayload;

    if (lastComparablesPayload) {
      payloadToCopy = {
        analysis: lastPayload,
        comparablesSearch: lastComparablesPayload,
      };
    }

    if (lastZoneScanPayload) {
      payloadToCopy = payloadToCopy
        ? {
            ...payloadToCopy,
            zoneScan: lastZoneScanPayload,
          }
        : {
            zoneScan: lastZoneScanPayload,
          };
    }

    await navigator.clipboard.writeText(JSON.stringify(payloadToCopy, null, 2));
    setStatus("JSON copiado al portapapeles.", "success");
  } catch (_error) {
    setStatus("No he podido copiar el JSON.", "error");
  }
});

clearComparablesSections();
clearZoneSections();
void analyzeCurrentTab({ silent: true });

async function analyzeCurrentTab(options = {}) {
  const silent = Boolean(options.silent);
  setBusy(true);
  hideResult();
  hideZoneResult();
  clearComparablesSections();
  if (!silent) {
    setStatus("Leyendo la ficha real desde la pestaña actual.", "");
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_ACTIVE_TAB",
    });

    if (!response?.ok) {
      throw new Error(response?.error || "No se pudo analizar la ficha actual.");
    }

    lastPayload = response.result;
    lastComparablesPayload = null;
    renderResult(response.result);

    if (!response.result?.targetAsset || !response.result?.searchStrategy) {
      setStatus(
        "La ficha se ha leido, pero parece que esta pestana sigue usando una version antigua del content script. Recarga la pagina y vuelve a probar.",
        "error"
      );
      return;
    }

    if (!silent) {
      setStatus("Ficha analizada. La base geografica ya esta normalizada.", "success");
    }
  } catch (error) {
    if (!silent) {
      setStatus(error.message, "error");
    } else {
      setStatus("Abre una ficha para el modo individual o un listado de venta para escanear zona.", "");
    }
  } finally {
    setBusy(false);
  }
}

async function searchComparables() {
  setBusy(true);
  hideZoneResult();
  setStatus("Buscando comparables de alquiler en la misma sesion real de Idealista.", "");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SEARCH_COMPARABLES_ACTIVE_TAB",
    });

    if (!response?.ok) {
      throw new Error(response?.error || "No se pudo buscar comparables.");
    }

    lastComparablesPayload = response.result;
    if (!lastPayload && response.result?.subject) {
      lastPayload = response.result.subject;
      renderResult(response.result.subject);
    }

    renderComparablesResult(response.result);

    const traceSummary = summarizeSearchTrace(response.result.searchTrace);
    const tone = response.result.comparables.length > 0 ? "success" : "error";
    setStatus(
      `Comparables: ${response.result.comparables.length} validos, ${response.result.discarded.length} descartados. ${traceSummary}`,
      tone
    );
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function scanZone() {
  setBusy(true);
  hideResult();
  hideZoneResult();
  clearComparablesSections();
  clearZoneSections();
  setStatus("Recorriendo los anuncios de venta visibles y calculando su cash on cash uno a uno.", "");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SCAN_ZONE_ACTIVE_TAB",
    });

    if (!response?.ok) {
      throw new Error(response?.error || "No se pudo escanear la zona actual.");
    }

    lastZoneScanPayload = response.result;
    renderZoneScanResult(response.result);

    const ranked = response.result.opportunities?.filter((item) => Number.isFinite(item.cashOnCashRoi)).length || 0;
    const tone = ranked > 0 ? "success" : "error";
    setStatus(
      `Escaner listo: ${response.result.analyzedListings} fichas analizadas, ${ranked} oportunidades con cash on cash calculado.`,
      tone
    );
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderResult(payload) {
  listingTitleNode.textContent = payload.page.title;
  listingMetaNode.textContent = `${payload.targetAsset?.municipality || "Municipio"} · ID ${payload.page.listingId}`;
  renderList(targetAssetNode, buildTargetAssetLines(payload.targetAsset));
  locationNameNode.textContent = payload.location?.displayName || "Ubicacion no resuelta";
  locationConfidenceNode.textContent = `Confianza: ${Math.round((payload.location?.confidence || 0) * 100)}%`;
  coordinatesNode.textContent = payload.coordinates
    ? `${payload.coordinates.latitude}, ${payload.coordinates.longitude}`
    : "No detectadas";
  renderList(searchStrategyNode, buildSearchStrategyLines(payload.searchStrategy));
  renderList(comparableRulesNode, buildComparableRuleLines(payload.comparableRules));

  renderList(
    breadcrumbsNode,
    payload.breadcrumbs?.length > 0 ? payload.breadcrumbs : ["No se han encontrado breadcrumbs claros."]
  );

  renderList(guardrailsNode, buildGuardrailLines(payload.guardrails));
  renderLinks(candidateLinksNode, payload.candidateLinks);
  renderDealSummary(payload, lastComparablesPayload);

  resultNode.classList.remove("hidden");
}

function renderComparablesResult(payload) {
  renderList(estimateNode, buildEstimateLines(payload.estimate));
  renderList(profitabilityNode, buildProfitabilityLines(payload.profitability));
  renderList(comparablesNode, buildComparableLines(payload.comparables));
  renderList(discardedNode, buildDiscardedLines(payload.discarded));
  renderList(searchTraceNode, buildSearchTraceLines(payload.searchTrace));
  renderDealSummary(payload.subject || lastPayload, payload);
}

function renderZoneScanResult(payload) {
  renderList(zoneSummaryNode, buildZoneSummaryLines(payload));
  renderZoneOpportunityCards(zoneOpportunitiesNode, payload.opportunities);
  renderList(zoneFailuresNode, buildZoneFailureLines(payload.failures));
  renderZoneSummary(payload);
  zoneResultNode.classList.remove("hidden");
}

function renderDealSummary(analysisPayload, comparablesPayload) {
  const asset = analysisPayload?.targetAsset || {};
  const estimate = comparablesPayload?.estimate || {};
  const profitability = comparablesPayload?.profitability || {};

  summaryPriceNode.textContent = Number.isFinite(asset.priceEur) ? `${formatNumber(asset.priceEur)} €` : "-";
  summaryRentNode.textContent = Number.isFinite(estimate.monthlyRentEur)
    ? `${formatNumber(estimate.monthlyRentEur)} €/m`
    : "-";
  summaryC2cNode.textContent = Number.isFinite(profitability?.metrics?.cashOnCashRoi)
    ? formatPercent(profitability.metrics.cashOnCashRoi)
    : "-";
  summaryCompsNode.textContent = Number.isFinite(estimate.comparablesUsed) ? `${estimate.comparablesUsed}` : "-";
}

function renderZoneSummary(payload) {
  const opportunities = payload?.opportunities || [];
  const best = opportunities.find((item) => Number.isFinite(item.cashOnCashRoi));

  zoneDetectedNode.textContent = `${payload?.totalListingsDetected || 0}`;
  zoneAnalyzedNode.textContent = `${payload?.analyzedListings || 0}`;
  zoneRankedNode.textContent = `${opportunities.length}`;
  zoneBestC2cNode.textContent = best ? formatPercent(best.cashOnCashRoi) : "-";
}

function buildTargetAssetLines(asset) {
  if (!asset) {
    return [
      "El activo normalizado no esta disponible todavia.",
      "Recarga la pagina de Idealista y vuelve a abrir la extension para inyectar la ultima version del content script.",
    ];
  }

  const lines = [];

  lines.push(`Precio: ${asset.priceEur ? `${formatNumber(asset.priceEur)} €` : "no detectado"}`);
  lines.push(`Superficie: ${asset.areaM2 ? `${asset.areaM2} m²` : "no detectada"}`);
  lines.push(`Habitaciones: ${asset.rooms ?? "no detectadas"}`);
  lines.push(`Banos: ${asset.bathrooms ?? "n/d"}`);
  lines.push(`Tipo: ${asset.propertyType || "no detectado"}`);
  lines.push(`Precio/m²: ${asset.pricePerM2 ? `${formatNumber(asset.pricePerM2)} €/m²` : "no detectado"}`);
  lines.push(`Municipio: ${asset.municipality || "no detectado"}`);

  if (asset.zone) {
    lines.push(`Zona: ${asset.zone}`);
  }

  if (asset.floor) {
    lines.push(`Planta: ${asset.floor}`);
  }

  if (asset.hasElevator !== null) {
    lines.push(`Ascensor: ${asset.hasElevator ? "si" : "no"}`);
  }

  if (asset.isExterior !== null) {
    lines.push(`Exterior: ${asset.isExterior ? "si" : "no"}`);
  }

  if (asset.state) {
    lines.push(`Estado: ${asset.state}`);
  }

  lines.push(`Confianza: ${Math.round((asset.confidence || 0) * 100)}%`);
  return lines;
}

function buildSearchStrategyLines(strategy) {
  if (!strategy?.scopes) {
    return [
      "El plan de comparables no esta disponible todavia.",
      "Recarga la ficha abierta para que la extension use el extractor actualizado.",
    ];
  }

  const lines = [];

  for (const scope of strategy.scopes) {
    if (!scope.active) {
      continue;
    }

    if (scope.id === "zone") {
      lines.push(`1. ${scope.areaName}`);
      lines.push(`Objetivo: ${scope.stopWhenValidComparablesAtLeast} validos`);
      continue;
    }

    if (scope.id === "municipality") {
      lines.push(`2. Expandir a ${scope.areaName} si hay menos de ${scope.activateWhenValidComparablesBelow}`);
    }
  }

  if (strategy.doNotExpandBeyondMunicipality) {
    lines.push("Sin salir del municipio");
  }

  if (strategy.keepCollectingBeyondMinimum) {
    lines.push("Seguir recogiendo comparables aunque ya se alcance el minimo");
  }

  return lines;
}

function buildComparableRuleLines(rules) {
  if (!rules) {
    return [
      "Las reglas de comparabilidad no estan disponibles todavia.",
    ];
  }

  return [
    ...rules.hardFilters.map((rule) => `Duro: ${rule}`),
    ...rules.softFilters.map((rule) => `Suave: ${rule}`),
  ];
}

function buildGuardrailLines(guardrails) {
  if (!guardrails) {
    return [
      "Los guardrails no estan disponibles todavia.",
    ];
  }

  const lines = [];

  if (guardrails.mustMatchProvince) {
    lines.push("Provincia obligatoria");
  } else if (guardrails.detectedProvince) {
    lines.push(`Provincia detectada: ${guardrails.detectedProvince}`);
  } else {
    lines.push("Provincia no resuelta");
  }

  lines.push(
    guardrails.mustMatchCity
      ? "Municipio obligatorio"
      : "Municipio no resuelto"
  );

  if (guardrails.preferredDistrict) {
    lines.push(`Distrito preferente: ${guardrails.preferredDistrict}`);
  }

  if (guardrails.preferredNeighborhood) {
    lines.push(`Barrio o zona preferente: ${guardrails.preferredNeighborhood}`);
  }

  if (guardrails.rejectCrossProvinceResults) {
    lines.push("Sin cruces de provincia");
  }

  if (guardrails.rejectCrossCityResults) {
    lines.push("Sin cruces de municipio");
  }

  return lines;
}

function buildEstimateLines(estimate) {
  if (!estimate || !estimate.monthlyRentEur) {
    return [
      "Sin estimacion usable",
      estimate?.method || "No se encontraron comparables validos suficientes.",
    ];
  }

  return [
    `${formatNumber(estimate.monthlyRentEur)} €/mes`,
    `Rango: ${formatNumber(estimate.lowEur)} € - ${formatNumber(estimate.highEur)} €`,
    `Comparables: ${estimate.comparablesUsed}`,
    `Confianza: ${estimate.confidence}`,
    estimate.method,
  ];
}

function buildProfitabilityLines(profitability) {
  if (!profitability?.ready) {
    return [
      "Sin rentabilidad usable",
      ...(profitability?.notes || ["Hace falta una estimacion de alquiler valida para calcular los ROI."]),
    ];
  }

  const lines = [];
  const { inputs, operatingCosts, metrics, assumptions, notes } = profitability;
  const financing = profitability.financing || {};

  lines.push(`ROI cash on cash: ${formatPercent(metrics.cashOnCashRoi)}`);
  lines.push(`ROI cash on cash neto: ${formatPercent(metrics.cashOnCashNetRoi)}`);
  lines.push(`ROI bruto: ${formatPercent(metrics.grossRoi)}`);
  lines.push(`ROI neto: ${formatPercent(metrics.netRoi)}`);
  lines.push(`Caja aportada: ${formatNumber(inputs.cashInvestedEur)} €`);
  lines.push(`Entrada compra: ${formatNumber(inputs.downPaymentEur || inputs.equityContributionEur)} €`);
  lines.push(`Coste total: ${formatNumber(inputs.totalAcquisitionCostEur)} €`);
  lines.push(`Neto anual: ${formatNumber(operatingCosts.annualNetRentEur)} €`);
  lines.push(`Hipoteca anual: ${formatNumber(financing.annualMortgageCostEur)} €`);
  lines.push(`Flujo post-deuda: ${formatNumber(financing.annualPostDebtCashFlowEur)} €`);
  lines.push(
    `Gastos: vacancia ${formatPercent(assumptions.vacancyRatio)}, gestion ${formatPercent(
      assumptions.managementRatio
    )}, mantenimiento ${formatPercent(assumptions.maintenanceRatio)}, IBI/comunidad ${formatPercent(
      assumptions.localTaxesAndCommunityRatio
    )}, seguro/incidencias ${formatPercent(assumptions.insuranceAndIncidentsRatio)}`
  );

  return [...lines, ...(notes || []).slice(0, 2)];
}

function buildComparableLines(comparables) {
  if (!comparables || comparables.length === 0) {
    return ["Todavia no hay comparables validos."];
  }

  return comparables.slice(0, 8).map((item) => {
    const parts = [
      item.scope === "zone" ? "zona" : "municipio",
      item.priceEur ? `${formatNumber(item.priceEur)} €/mes` : "sin precio",
    ];

    if (item.areaM2) {
      parts.push(`${item.areaM2} m²`);
    }

    if (item.rooms) {
      parts.push(`${item.rooms} hab.`);
    }

    if (item.rentPerM2) {
      parts.push(`${item.rentPerM2} €/m²`);
    }

    return `${item.title} | ${parts.join(" | ")}`;
  });
}

function buildZoneSummaryLines(payload) {
  if (!payload) {
    return ["Todavia no hay un escaneo de zona disponible."];
  }

  return [
    `Pagina origen: ${payload.sourcePage?.title || payload.sourcePage?.url || "no detectada"}`,
    `Anuncios detectados en la pagina: ${payload.totalListingsDetected || 0}`,
    `Fichas puestas en cola: ${payload.listingsQueued || 0}`,
    `Fichas analizadas: ${payload.analyzedListings || 0}`,
    `Oportunidades rankeadas: ${payload.opportunities?.length || 0}`,
  ];
}

function buildZoneOpportunityLines(opportunities) {
  if (!opportunities || opportunities.length === 0) {
    return ["Todavia no hay oportunidades calculadas para esta pagina de venta."];
  }

  return opportunities.slice(0, 10).map((item, index) => {
    const parts = [
      `#${index + 1}`,
      Number.isFinite(item.cashOnCashRoi) ? `cash on cash ${formatPercent(item.cashOnCashRoi)}` : "cash on cash no disponible",
      Number.isFinite(item.cashOnCashNetRoi) ? `cash on cash neto ${formatPercent(item.cashOnCashNetRoi)}` : "cash on cash neto n/d",
      Number.isFinite(item.netRoi) ? `neto ${formatPercent(item.netRoi)}` : "neto n/d",
      Number.isFinite(item.estimatedRentEur) ? `${formatNumber(item.estimatedRentEur)} €/mes` : "sin renta",
      Number.isFinite(item.priceEur) ? `${formatNumber(item.priceEur)} € compra` : "sin precio compra",
    ];

    if (item.areaM2) {
      parts.push(`${item.areaM2} m²`);
    }

    if (item.rooms) {
      parts.push(`${item.rooms} hab.`);
    }

    if (item.comparablesUsed) {
      parts.push(`${item.comparablesUsed} comps`);
    }

    return `${item.title} | ${parts.join(" | ")}`;
  });
}

function renderZoneOpportunityCards(node, opportunities) {
  node.innerHTML = "";

  if (!opportunities || opportunities.length === 0) {
    renderList(node, ["Todavia no hay oportunidades calculadas para esta pagina de venta."]);
    return;
  }

  for (const [index, item] of opportunities.slice(0, 10).entries()) {
    const li = document.createElement("li");
    li.className = `opportunity-card ${getOpportunityToneClass(item.cashOnCashRoi)}`;

    const top = document.createElement("div");
    top.className = "opportunity-top";

    const rank = document.createElement("span");
    rank.className = "opportunity-rank";
    rank.textContent = `#${index + 1}`;
    top.appendChild(rank);

    const badge = document.createElement("span");
    badge.className = "opportunity-badge";
    badge.textContent = Number.isFinite(item.cashOnCashRoi)
      ? `C2C ${formatPercent(item.cashOnCashRoi)}`
      : "C2C n/d";
    top.appendChild(badge);

    const titleLink = document.createElement("a");
    titleLink.href = item.url || "#";
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer noopener";
    titleLink.className = "opportunity-title";
    titleLink.textContent = item.title || "Activo sin titulo";

    const facts = document.createElement("div");
    facts.className = "opportunity-facts";

    appendOpportunityMetric(facts, "Compra", Number.isFinite(item.priceEur) ? `${formatNumber(item.priceEur)} €` : "n/d");
    appendOpportunityMetric(
      facts,
      "Renta estimada",
      Number.isFinite(item.estimatedRentEur) ? `${formatNumber(item.estimatedRentEur)} €/mes` : "n/d"
    );
    appendOpportunityMetric(
      facts,
      "Superficie",
      Number.isFinite(item.areaM2) ? `${item.areaM2} m²` : "n/d"
    );
    appendOpportunityMetric(
      facts,
      "Habitaciones",
      Number.isFinite(item.rooms) ? `${item.rooms}` : "n/d"
    );
    appendOpportunityMetric(
      facts,
      "Comparables",
      Number.isFinite(item.comparablesUsed) ? `${item.comparablesUsed}` : "n/d"
    );

    const roiGrid = document.createElement("div");
    roiGrid.className = "opportunity-roi-grid";

    appendOpportunityMetric(
      roiGrid,
      "ROI cash on cash",
      Number.isFinite(item.cashOnCashRoi) ? formatPercent(item.cashOnCashRoi) : "n/d"
    );
    appendOpportunityMetric(
      roiGrid,
      "ROI cash on cash neto",
      Number.isFinite(item.cashOnCashNetRoi) ? formatPercent(item.cashOnCashNetRoi) : "n/d"
    );
    appendOpportunityMetric(
      roiGrid,
      "ROI bruto",
      Number.isFinite(item.grossRoi) ? formatPercent(item.grossRoi) : "n/d"
    );
    appendOpportunityMetric(
      roiGrid,
      "ROI neto",
      Number.isFinite(item.netRoi) ? formatPercent(item.netRoi) : "n/d"
    );

    li.appendChild(top);
    li.appendChild(titleLink);
    li.appendChild(facts);
    li.appendChild(roiGrid);
    node.appendChild(li);
  }
}

function appendOpportunityMetric(node, label, value) {
  const metric = document.createElement("div");
  metric.className = "opportunity-metric";

  const metricLabel = document.createElement("span");
  metricLabel.className = "opportunity-metric-label";
  metricLabel.textContent = label;

  const metricValue = document.createElement("strong");
  metricValue.className = "opportunity-metric-value";
  metricValue.textContent = value;

  metric.appendChild(metricLabel);
  metric.appendChild(metricValue);
  node.appendChild(metric);
}

function getOpportunityToneClass(cashOnCashRoi) {
  if (!Number.isFinite(cashOnCashRoi)) {
    return "tone-neutral";
  }

  if (cashOnCashRoi > 0.25) {
    return "tone-green";
  }

  if (cashOnCashRoi >= 0.15) {
    return "tone-yellow";
  }

  return "tone-red";
}

function buildZoneFailureLines(failures) {
  if (!failures || failures.length === 0) {
    return ["Sin incidencias registradas en este escaneo."];
  }

  return failures.slice(0, 8).map((item) => `${item.title || item.url} | ${item.reason}`);
}

function buildDiscardedLines(discarded) {
  if (!discarded || discarded.length === 0) {
    return ["Sin descartes registrados por ahora."];
  }

  return discarded.slice(0, 8).map((item) => `${item.title || item.url} | ${item.reason}`);
}

function buildSearchTraceLines(searchTrace) {
  if (!searchTrace || searchTrace.length === 0) {
    return ["Sin traza de busqueda disponible."];
  }

  return searchTrace.flatMap((entry) => {
    const lines = [
      `${entry.scope} | area: ${entry.areaName || "sin area"} | candidatos: ${entry.fetchedCandidates} | validos acumulados: ${entry.validComparables}`,
    ];

    if (entry.triedUrls?.length) {
      lines.push(...entry.triedUrls.slice(0, 2).map((url) => `URL: ${url}`));
    }

    if (entry.note) {
      lines.push(`Nota: ${entry.note}`);
    }

    return lines;
  });
}

function summarizeSearchTrace(searchTrace) {
  if (!searchTrace || searchTrace.length === 0) {
    return "Sin traza de busqueda.";
  }

  const fetched = searchTrace.reduce((sum, entry) => sum + (entry.fetchedCandidates || 0), 0);
  const notes = searchTrace.map((entry) => entry.note).filter(Boolean);

  if (notes.length > 0) {
    return notes[0];
  }

  if (fetched === 0) {
    return "No he detectado tarjetas de alquiler en las URLs visitadas.";
  }

  return `He raspado ${fetched} candidatos antes de validar.`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "no disponible";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function renderList(node, items) {
  node.innerHTML = "";

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    node.appendChild(li);
  }
}

function renderLinks(node, items) {
  node.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No se han detectado links internos utiles en esta ficha.";
    node.appendChild(li);
    return;
  }

  for (const item of items.slice(0, 8)) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.href;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = item.text || item.href;
    li.appendChild(link);
    node.appendChild(li);
  }
}

function setBusy(isBusy) {
  analyzeButton.disabled = isBusy;
  comparablesButton.disabled = isBusy;
  zoneScanButton.disabled = isBusy;
  copyButton.disabled = isBusy;
}

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.className = `status ${tone}`.trim();
}

function hideResult() {
  resultNode.classList.add("hidden");
  renderDealSummary(null, null);
}

function hideZoneResult() {
  zoneResultNode.classList.add("hidden");
  renderZoneSummary(null);
}

function clearComparablesSections() {
  renderList(estimateNode, ["Analiza la ficha y luego lanza la busqueda de comparables."]);
  renderList(profitabilityNode, ["Lanza la busqueda de comparables para calcular la rentabilidad estimada."]);
  renderList(comparablesNode, ["Todavia no hay comparables validos."]);
  renderList(discardedNode, ["Sin descartes registrados por ahora."]);
  renderList(searchTraceNode, ["Sin traza de busqueda disponible."]);
}

function clearZoneSections() {
  renderList(zoneSummaryNode, ["Abre un listado de venta de Idealista y pulsa Escanear zona."]);
  renderList(zoneOpportunitiesNode, ["Todavia no hay ranking de oportunidades."]);
  renderList(zoneFailuresNode, ["Sin incidencias registradas en este escaneo."]);
}
