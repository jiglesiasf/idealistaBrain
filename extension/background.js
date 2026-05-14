const LAST_ANALYSIS_KEY = "lastAnalysis";
const LAST_ZONE_SCAN_KEY = "lastZoneScan";
const ZONE_SCAN_LIMIT = 12;
const EXTERNAL_JOB_MESSAGE_TYPE = "IDEALISTA_BRAIN_EXECUTE_JOB";
const EXTERNAL_PING_MESSAGE_TYPE = "IDEALISTA_BRAIN_PING";
const COMPANION_API_BASE_PATH = "/api/companion";
const SUPPORTED_EXTERNAL_JOB_TYPES = new Set(["listing-analysis", "zone-scan"]);
const IDEALISTA_URL_PATTERN = /^https:\/\/www\.idealista\.com\//i;
const LISTING_URL_PATTERN = /^https:\/\/www\.idealista\.com\/inmueble\/\d+/i;
const ZONE_URL_PATTERN = /^https:\/\/www\.idealista\.com\/venta-viviendas\//i;

let activeExternalJobId = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ANALYZE_ACTIVE_TAB") {
    analyzeActiveTab()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "SEARCH_COMPARABLES_ACTIVE_TAB") {
    searchComparablesInActiveTab()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "SCAN_ZONE_ACTIVE_TAB") {
    scanZoneOpportunitiesInActiveTab()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "OPEN_IDEALISTA_SEARCH_PAGE") {
    openIdealistaPageAndScrape(message.url, {
      type: "SCRAPE_COMPARABLE_LIST_PAGE",
      scopeId: message.scopeId || null,
    })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  return false;
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === EXTERNAL_PING_MESSAGE_TYPE) {
    sendResponse({
      ok: true,
      companionVersion: chrome.runtime.getManifest().version,
      busy: Boolean(activeExternalJobId),
      activeJobId: activeExternalJobId,
    });
    return false;
  }

  if (message?.type !== EXTERNAL_JOB_MESSAGE_TYPE) {
    return false;
  }

  let job;

  try {
    job = normalizeExternalJobPayload(message.payload);
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Companion payload validation failed.",
    });
    return false;
  }

  if (activeExternalJobId) {
    sendResponse({
      ok: false,
      error: `El companion ya esta ejecutando el job ${activeExternalJobId}. Espera a que termine antes de lanzar otro.`,
    });
    return false;
  }

  activeExternalJobId = job.jobId;

  runExternalJob(job)
    .catch((error) => {
      console.error("External companion job failed.", {
        jobId: job.jobId,
        jobType: job.jobType,
        error: error instanceof Error ? error.message : error,
      });
    })
    .finally(() => {
      if (activeExternalJobId === job.jobId) {
        activeExternalJobId = null;
      }
    });

  sendResponse({
    ok: true,
    accepted: true,
    jobId: job.jobId,
  });

  return false;
});

async function getActiveIdealistaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No he podido localizar la pestaña activa.");
  }

  if (!tab.url || !/^https:\/\/www\.idealista\.com\//i.test(tab.url)) {
    throw new Error("Abre primero una pagina de Idealista en la pestaña actual.");
  }

  return tab;
}

async function analyzeActiveTab() {
  const tab = await getActiveIdealistaTab();

  const payload = buildStoredListingAnalysisPayload(
    await getContentScriptResult(tab.id, {
      type: "EXTRACT_IDEALISTA_CONTEXT",
    }),
    {
      analyzedAt: new Date().toISOString(),
      tabId: tab.id,
    }
  );

  await chrome.storage.local.set({
    [LAST_ANALYSIS_KEY]: payload,
  });

  return payload;
}

async function searchComparablesInActiveTab() {
  const tab = await getActiveIdealistaTab();

  return {
    ...await getContentScriptResult(tab.id, {
      type: "SEARCH_IDEALISTA_COMPARABLES",
    }),
    tabId: tab.id,
    searchedAt: new Date().toISOString(),
  };
}

async function scanZoneOpportunitiesInActiveTab() {
  const tab = await getActiveIdealistaTab();
  const listPage = await getContentScriptResult(tab.id, {
    type: "SCRAPE_SALE_LIST_PAGE",
  });
  const listings = (listPage.listings || []).slice(0, ZONE_SCAN_LIMIT);
  const analyses = [];
  const failures = [];

  for (let index = 0; index < listings.length; index += 1) {
    const listing = listings[index];

    try {
      const analysis = await openIdealistaPageAndScrape(listing.url, {
        type: "RUN_FULL_DEAL_ANALYSIS_CURRENT_PAGE",
      });

      analyses.push({
        index: index + 1,
        sourceListing: listing,
        analysis,
      });
    } catch (error) {
      failures.push({
        index: index + 1,
        listingId: listing.listingId,
        title: listing.title,
        url: listing.url,
        reason: error.message,
      });
    }

    if (index < listings.length - 1) {
      await wait(450 + Math.round(Math.random() * 650));
    }
  }

  const payload = buildZoneScanPayload({
    listPage,
    listingsQueued: listings.length,
    analyses,
    failures,
  });

  await chrome.storage.local.set({
    [LAST_ZONE_SCAN_KEY]: payload,
  });

  return payload;
}

async function runExternalJob(job) {
  try {
    const resolvedJobType = canonicalizeExternalJobType(job.jobType, job.targetUrl);
    const inferredJobType = inferJobTypeFromIdealistaUrl(job.targetUrl);
    const shouldRunListing = resolvedJobType === "listing-analysis" || inferredJobType === "listing-analysis";
    const shouldRunZone = resolvedJobType === "zone-scan" || inferredJobType === "zone-scan";

    await reportJobAccepted(job);

    if (shouldRunListing && !shouldRunZone) {
      await executeExternalListingAnalysisJob(job);
      return;
    }

    if (shouldRunZone) {
      await executeExternalZoneScanJob(job);
      return;
    }

    throw new Error(
      `Unsupported external job type after normalization: resolved=${String(resolvedJobType)} inferred=${String(inferredJobType)} url=${job.targetUrl}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected companion execution error.";
    const stage = inferFailureStage(job.jobType);

    try {
      await reportJobFailure(job, {
        stage,
        message,
      });
    } catch (reportError) {
      console.error("Companion could not report the job failure.", {
        jobId: job.jobId,
        jobType: job.jobType,
        originalError: message,
        reportError: describeUnknownError(reportError),
      });
    }

    console.error("External companion job failed.", {
      jobId: job.jobId,
      jobType: job.jobType,
      targetUrl: job.targetUrl,
      error: message,
    });

    throw error;
  }
}

async function executeExternalListingAnalysisJob(job) {
  await reportJobProgress(job, {
    stage: "opening-target",
    message: "Opening the target Idealista listing in a background tab.",
    progress: 6,
  });

  const result = await withIdealistaTab(job.targetUrl, async (tabId) => {
    await reportJobProgress(job, {
      stage: "extracting-context",
      message: "Reading the canonical listing context from the live page.",
      progress: 18,
    });

    const subject = await getContentScriptResult(tabId, {
      type: "EXTRACT_IDEALISTA_CONTEXT",
    });

    await reportJobProgress(job, {
      stage: "searching-comparables",
      message: "Searching validated rental comparables inside the live browser session.",
      progress: 44,
    });

    const analysis = await getContentScriptResult(tabId, {
      type: "RUN_FULL_DEAL_ANALYSIS_CURRENT_PAGE",
    });

    return buildStoredListingAnalysisPayload(
      analysis?.subject
        ? analysis
        : {
            ...analysis,
            subject,
          },
      {
        companionJob: buildCompanionJobMetadata(job),
      }
    );
  });

  await chrome.storage.local.set({
    [LAST_ANALYSIS_KEY]: result,
  });

  await reportJobProgress(job, {
    stage: "estimating-rent",
    message: "Rent estimate assembled from the shared comparable rules.",
    progress: 74,
  });

  await reportJobProgress(job, {
    stage: "estimating-profitability",
    message: "Profitability metrics computed in the shared core.",
    progress: 88,
  });

  await reportJobProgress(job, {
    stage: "persisting-result",
    message: "Uploading the final listing analysis to the web app.",
    progress: 96,
  });

  await reportJobCompleted(job, "listing-analysis", result);
}

async function executeExternalZoneScanJob(job) {
  await reportJobProgress(job, {
    stage: "opening-target",
    message: "Opening the target Idealista results page in a background tab.",
    progress: 5,
  });

  const listPage = await openIdealistaPageAndScrape(job.targetUrl, {
    type: "SCRAPE_SALE_LIST_PAGE",
  });

  const listings = (listPage.listings || []).slice(0, ZONE_SCAN_LIMIT);
  const analyses = [];
  const failures = [];

  await reportJobProgress(job, {
    stage: "scanning-zone",
    message: `Queued ${listings.length} listings from the visible results page.`,
    progress: listings.length > 0 ? 12 : 30,
  });

  for (let index = 0; index < listings.length; index += 1) {
    const listing = listings[index];
    const progress = listings.length > 0 ? 12 + Math.round(((index + 1) / listings.length) * 78) : 90;

    await reportJobProgress(job, {
      stage: "scanning-zone",
      message: `Analysing listing ${index + 1}/${listings.length}: ${listing.title || listing.url}`,
      progress,
    });

    try {
      const analysis = await openIdealistaPageAndScrape(listing.url, {
        type: "RUN_FULL_DEAL_ANALYSIS_CURRENT_PAGE",
      });

      analyses.push({
        index: index + 1,
        sourceListing: listing,
        analysis,
      });
    } catch (error) {
      failures.push({
        index: index + 1,
        listingId: listing.listingId,
        title: listing.title,
        url: listing.url,
        reason: error instanceof Error ? error.message : "Unexpected listing scan error.",
      });
    }

    if (index < listings.length - 1) {
      await wait(450 + Math.round(Math.random() * 650));
    }
  }

  const payload = buildZoneScanPayload({
    listPage,
    listingsQueued: listings.length,
    analyses,
    failures,
    extra: {
      companionJob: buildCompanionJobMetadata(job),
    },
  });

  await chrome.storage.local.set({
    [LAST_ZONE_SCAN_KEY]: payload,
  });

  await reportJobProgress(job, {
    stage: "persisting-result",
    message: "Uploading the ranked zone scan to the web app.",
    progress: 96,
  });

  await reportJobCompleted(job, "zone-scan", payload);
}

function buildZoneOpportunity(entry) {
  const analysis = entry.analysis;
  const subject = analysis.subject || {};
  const asset = subject.targetAsset || {};
  const profitability = analysis.profitability || {};
  const estimate = analysis.estimate || {};
  const metrics = profitability.metrics || {};

  return {
    listingId: subject.page?.listingId || entry.sourceListing.listingId,
    title: subject.page?.title || entry.sourceListing.title,
    url: subject.page?.canonicalUrl || entry.sourceListing.url,
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

function buildZoneScanPayload({ listPage, listingsQueued, analyses, failures, extra = {} }) {
  return {
    sourcePage: {
      title: listPage.title,
      url: listPage.currentUrl,
    },
    scannedAt: new Date().toISOString(),
    totalListingsDetected: listPage.listings?.length || 0,
    listingsQueued,
    analyzedListings: analyses.length,
    opportunities: rankZoneOpportunities(analyses.map((entry) => buildZoneOpportunity(entry))),
    failures,
    ...extra,
  };
}

function rankZoneOpportunities(opportunities) {
  return [...opportunities].sort((left, right) => {
    const leftValue = Number.isFinite(left.cashOnCashRoi) ? left.cashOnCashRoi : -Infinity;
    const rightValue = Number.isFinite(right.cashOnCashRoi) ? right.cashOnCashRoi : -Infinity;
    return rightValue - leftValue;
  });
}

function buildStoredListingAnalysisPayload(payload, extra = {}) {
  return {
    ...payload,
    ...extra,
  };
}

function buildCompanionJobMetadata(job) {
  return {
    jobId: job.jobId,
    jobType: job.jobType,
    backendBaseUrl: job.backendBaseUrl,
    completedBy: "browser-companion",
    companionVersion: chrome.runtime.getManifest().version,
    executedAt: new Date().toISOString(),
  };
}

async function openIdealistaPageAndScrape(url, message) {
  return withIdealistaTab(url, async (tabId) => getContentScriptResult(tabId, message));
}

async function withIdealistaTab(url, callback) {
  assertIdealistaUrl(url);

  const tab = await chrome.tabs.create({
    url,
    active: false,
  });

  if (!tab?.id) {
    throw new Error("No se ha podido abrir una pestaña temporal de Idealista.");
  }

  try {
    await waitForTabComplete(tab.id);
    return await callback(tab.id, tab);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function getContentScriptResult(tabId, message) {
  const response = await sendMessageWithRetry(tabId, message);

  if (!response?.ok) {
    throw new Error(response?.error || "No se pudo leer la pagina cargada de Idealista.");
  }

  return response.result;
}

function normalizeExternalJobPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new Error("The companion did not receive a valid job payload.");
  }

  const payload = rawPayload;
  const jobId = typeof payload.jobId === "string" ? payload.jobId.trim() : "";
  const rawJobType = typeof payload.jobType === "string" ? payload.jobType.trim() : "";
  const targetUrl = typeof payload.targetUrl === "string" ? payload.targetUrl.trim() : "";
  const executionToken = typeof payload.executionToken === "string" ? payload.executionToken.trim() : "";
  const backendBaseUrl = typeof payload.backendBaseUrl === "string" ? payload.backendBaseUrl.trim() : "";
  const apiBasePath = normalizeApiBasePath(
    typeof payload.apiBasePath === "string" ? payload.apiBasePath.trim() : COMPANION_API_BASE_PATH
  );

  if (!jobId) {
    throw new Error("The companion payload is missing the job id.");
  }

  assertIdealistaUrl(targetUrl);
  const jobType = canonicalizeExternalJobType(rawJobType, targetUrl);

  if (jobType === "listing-analysis" && !LISTING_URL_PATTERN.test(targetUrl)) {
    throw new Error("A listing-analysis job requires an Idealista listing URL.");
  }

  if (jobType === "zone-scan" && !ZONE_URL_PATTERN.test(targetUrl)) {
    throw new Error("A zone-scan job requires an Idealista sale-results URL.");
  }

  if (executionToken.length < 16) {
    throw new Error("The companion payload is missing a valid execution token.");
  }

  try {
    new URL(backendBaseUrl);
  } catch (_error) {
    throw new Error("The companion payload is missing a valid backend base URL.");
  }

  return {
    jobId,
    jobType,
    targetUrl,
    executionToken,
    backendBaseUrl,
    apiBasePath,
  };
}

function normalizeApiBasePath(value) {
  const trimmed = value || COMPANION_API_BASE_PATH;
  const withoutTrailingSlash = trimmed.replace(/\/+$/g, "");
  return withoutTrailingSlash.startsWith("/") ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
}

function assertIdealistaUrl(url) {
  if (!url || !IDEALISTA_URL_PATTERN.test(url)) {
    throw new Error("La URL solicitada no es una pagina valida de Idealista.");
  }
}

function inferJobTypeFromIdealistaUrl(url) {
  if (LISTING_URL_PATTERN.test(url)) {
    return "listing-analysis";
  }

  if (ZONE_URL_PATTERN.test(url)) {
    return "zone-scan";
  }

  return null;
}

function canonicalizeExternalJobType(rawJobType, targetUrl) {
  const normalized = String(rawJobType || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (SUPPORTED_EXTERNAL_JOB_TYPES.has(normalized)) {
    return normalized;
  }

  if (normalized === "listing" || normalized === "listinganalysis" || normalized === "listing-analysis-job") {
    return "listing-analysis";
  }

  if (normalized === "zone" || normalized === "zonescan" || normalized === "zone-scan-job") {
    return "zone-scan";
  }

  const inferredFromUrl = inferJobTypeFromIdealistaUrl(targetUrl);

  if (inferredFromUrl) {
    return inferredFromUrl;
  }

  throw new Error(`Unsupported job type: ${rawJobType || "<empty>"}.`);
}

function describeUnknownError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (_jsonError) {
    return String(error);
  }
}

function buildCompanionEndpoint(job, eventType) {
  const url = new URL(job.backendBaseUrl);
  url.pathname = `${job.apiBasePath}/jobs/${encodeURIComponent(job.jobId)}/${eventType}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function postCompanionEvent(job, eventType, payload) {
  const response = await fetch(buildCompanionEndpoint(job, eventType), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      executionToken: job.executionToken,
      payload,
    }),
  });

  if (response.ok) {
    return;
  }

  let errorMessage = `Companion backend request failed with status ${response.status}.`;

  try {
    const body = await response.json();
    if (typeof body?.error === "string" && body.error.trim()) {
      errorMessage = body.error;
    }
  } catch (_error) {
    // Ignore malformed error bodies and surface the fallback message.
  }

  throw new Error(errorMessage);
}

async function reportJobAccepted(job) {
  await postCompanionEvent(job, "accepted", {
    companionVersion: chrome.runtime.getManifest().version,
  });
}

async function reportJobProgress(job, payload) {
  await postCompanionEvent(job, "progress", payload);
}

async function reportJobCompleted(job, resultType, result) {
  await postCompanionEvent(job, "completed", {
    resultType,
    result,
  });
}

async function reportJobFailure(job, payload) {
  await postCompanionEvent(job, "failed", payload);
}

function inferFailureStage(jobType) {
  if (jobType === "zone-scan") {
    return "scanning-zone";
  }

  return "opening-target";
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("La pagina de Idealista ha tardado demasiado en cargar."));
    }, timeoutMs);

    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      cleanup();
      resolve(tab);
    };

    const cleanup = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || settled) {
        return;
      }

      if (tab?.status === "complete") {
        cleanup();
        resolve(tab);
      }
    });
  });
}

async function sendMessageWithRetry(tabId, message, attempts = 12, delayMs = 350) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      lastError = error;
      await wait(delayMs);
    }
  }

  throw new Error(lastError?.message || "No he podido comunicarme con la pagina de Idealista.");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
