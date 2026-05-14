(function () {
  const core = globalThis.IdealistaBrainCore;

  if (!core) {
    throw new Error("No se ha podido cargar el core compartido de Idealista Brain.");
  }

  const {
    MAX_CANDIDATES_PER_SCOPE_URL,
    buildSearchStrategy: buildSharedSearchStrategy,
    buildComparableRules: buildSharedComparableRules,
    buildGuardrails: buildSharedGuardrails,
    getComparableRejectionReason: getSharedComparableRejectionReason,
    buildComparableRecord: buildSharedComparableRecord,
    buildRentEstimate: buildSharedRentEstimate,
    buildProfitabilityEstimate: buildSharedProfitabilityEstimate,
  } = core;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "EXTRACT_IDEALISTA_CONTEXT") {
      try {
        const result = extractIdealistaContext(document, window.location.href);
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }

      return false;
    }

    if (message?.type === "SEARCH_IDEALISTA_COMPARABLES") {
      searchIdealistaComparables(document, window.location.href)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "RUN_FULL_DEAL_ANALYSIS_CURRENT_PAGE") {
      searchIdealistaComparables(document, window.location.href)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "SCRAPE_COMPARABLE_LIST_PAGE") {
      try {
        const result = scrapeComparableListPage(document, window.location.href, message.scopeId || null);
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }

      return false;
    }

    if (message?.type === "SCRAPE_SALE_LIST_PAGE") {
      try {
        const result = scrapeSaleListPage(document, window.location.href);
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }

      return false;
    }

    return false;
  });

  function extractIdealistaContext(doc, currentUrl) {
    const canonicalUrl = getCanonicalUrl(doc, currentUrl);
    const listingId = extractListingId(canonicalUrl || currentUrl);

    if (!listingId) {
      throw new Error("La pestana actual no parece una ficha individual de Idealista.");
    }

    const pageText = getPageText(doc);
    const title = getBestTitle(doc);
    const breadcrumbs = getBreadcrumbs(doc);
    const jsonLd = getJsonLdObjects(doc);
    const location = resolveLocation({ title, breadcrumbs, jsonLd, pageText });
    const coordinates = extractCoordinates(jsonLd);
    const targetAsset = extractTargetAsset({
      doc,
      title,
      pageText,
      jsonLd,
      location,
      listingId,
      canonicalUrl,
    });
    const searchStrategy = buildSearchStrategy(targetAsset);
    const comparableRules = buildComparableRules();
    const candidateLinks = getCandidateLinks(doc);
    const guardrails = buildGuardrails(location, searchStrategy, comparableRules);

    return {
      page: {
        title,
        currentUrl,
        canonicalUrl,
        listingId,
      },
      location,
      coordinates,
      targetAsset,
      searchStrategy,
      comparableRules,
      breadcrumbs,
      candidateLinks,
      guardrails,
      rawSignals: summarizeSignals(title, breadcrumbs, jsonLd, pageText),
    };
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function uniqueStrings(values) {
    return [...new Set(values.map(normalizeText).filter(Boolean))];
  }

  function slugify(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isBlockedIdealistaPageText(text) {
    return /uso indebido|acceso se ha bloqueado|device verification|captcha/i.test(normalizeText(text));
  }

  function isIdealistaNotFoundPage(doc) {
    const title = normalizeText(doc.querySelector("title")?.textContent || "");
    const text = normalizeText(doc.body?.innerText || "");
    return /\b404\b|no se ha encontrado|pagina no encontrada|page not found/i.test(`${title} ${text}`);
  }

  function extractListingId(url) {
    const match = url.match(/\/inmueble\/(\d+)\//i) || url.match(/\/inmueble\/(\d+)/i);
    return match ? match[1] : null;
  }

  function getCanonicalUrl(doc, fallbackUrl) {
    return (
      doc.querySelector('link[rel="canonical"]')?.href ||
      doc.querySelector('meta[property="og:url"]')?.content ||
      fallbackUrl
    );
  }

  function getBestTitle(doc) {
    const candidates = [
      doc.querySelector('meta[property="og:title"]')?.content,
      doc.querySelector("h1")?.textContent,
      doc.querySelector("title")?.textContent,
    ];

    return uniqueStrings(candidates)[0] || "Ficha sin titulo";
  }

  function getPageText(doc) {
    return normalizeText(doc.body?.innerText || "");
  }

  function getBreadcrumbs(doc) {
    const selectors = [
      'nav[aria-label*="breadcrumb" i] a',
      '[class*="breadcrumb" i] a',
      "ol.breadcrumb a",
      "ul.breadcrumb a",
    ];

    const seen = new Set();
    const results = [];

    for (const selector of selectors) {
      for (const node of doc.querySelectorAll(selector)) {
        const text = normalizeText(node.textContent);
        if (!text || seen.has(text.toLowerCase())) {
          continue;
        }

        seen.add(text.toLowerCase());
        results.push(text);
      }
    }

    return results;
  }

  function getJsonLdObjects(doc) {
    const nodes = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    const objects = [];

    for (const node of nodes) {
      const raw = node.textContent || "";

      try {
        const parsed = JSON.parse(raw);
        collectJsonLdObjects(parsed, objects);
      } catch (_error) {
        continue;
      }
    }

    return objects;
  }

  function collectJsonLdObjects(value, target) {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        collectJsonLdObjects(item, target);
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    target.push(value);

    if (Array.isArray(value["@graph"])) {
      collectJsonLdObjects(value["@graph"], target);
    }
  }

  function resolveLocation({ title, breadcrumbs, jsonLd, pageText }) {
    const titleLocation = parseLocationFromTitle(title);
    const breadcrumbLocation = parseLocationFromBreadcrumbs(breadcrumbs);
    const jsonLocation = parseLocationFromJsonLd(jsonLd);
    const pageLocation = parseLocationFromPageText(pageText);

    const province =
      jsonLocation.province ||
      breadcrumbLocation.province ||
      titleLocation.province ||
      pageLocation.province ||
      null;
    const city = jsonLocation.city || breadcrumbLocation.city || titleLocation.city || pageLocation.city || null;
    const district =
      jsonLocation.district || breadcrumbLocation.district || titleLocation.district || pageLocation.district || null;
    const neighborhood =
      jsonLocation.neighborhood ||
      breadcrumbLocation.neighborhood ||
      titleLocation.neighborhood ||
      pageLocation.neighborhood ||
      null;
    const street = jsonLocation.street || titleLocation.street || null;

    const confidence =
      (province ? 0.35 : 0) +
      (city ? 0.3 : 0) +
      (district ? 0.2 : 0) +
      (neighborhood ? 0.1 : 0) +
      (street ? 0.05 : 0);

    return {
      street,
      neighborhood,
      district,
      city,
      province,
      confidence: Math.min(1, Number(confidence.toFixed(2))),
      displayName: [street, neighborhood, district, city, province].filter(Boolean).join(", "),
      zoneLabel: neighborhood || district || city || province || null,
      zoneSlug: slugify(neighborhood || district || city || province || ""),
      municipalitySlug: slugify(city || ""),
      sources: {
        title: titleLocation,
        breadcrumbs: breadcrumbLocation,
        jsonLd: jsonLocation,
        pageText: pageLocation,
      },
    };
  }

  function parseLocationFromPageText(pageText) {
    const text = normalizeText(pageText);
    const compact = text.replace(/\s+/g, " ");

    const result = {
      street: null,
      neighborhood: null,
      district: null,
      city: null,
      province: null,
      rawTokens: [],
    };

    const provincePatterns = [
      /\b(alicante\s*\/\s*alacant)\b/i,
      /\b(valencia\s*\/\s*valència)\b/i,
      /\b(castell[oó]n\s*\/\s*castell[óo])\b/i,
      /\b(a coru[nñ]a|la coru[nñ]a)\b/i,
    ];

    for (const pattern of provincePatterns) {
      const match = compact.match(pattern);
      if (match) {
        result.province = normalizeText(match[1]);
        break;
      }
    }

    return result;
  }

  function parseLocationFromTitle(title) {
    const cleanedTitle = normalizeText(title)
      .replace(/\s+—\s+idealista$/i, "")
      .replace(/\s+-\s+idealista$/i, "");

    const afterEn = cleanedTitle.replace(/^.*\ben\b\s+/i, "");
    const tokens = afterEn.split(",").map(normalizeText).filter(Boolean);

    return tokensToLocation(tokens);
  }

  function parseLocationFromBreadcrumbs(breadcrumbs) {
    const clean = breadcrumbs
      .map(normalizeText)
      .filter(Boolean)
      .filter((item) => !/^(idealista|inicio|home)$/i.test(item));

    const province = clean.at(-1) || null;
    const city = clean.at(-2) || null;
    const district = clean.at(-3) || null;
    const neighborhood = clean.at(-4) || null;

    return {
      street: null,
      neighborhood,
      district,
      city,
      province,
      rawTokens: clean,
    };
  }

  function parseLocationFromJsonLd(objects) {
    const result = {
      street: null,
      neighborhood: null,
      district: null,
      city: null,
      province: null,
      rawTokens: [],
    };

    for (const object of objects) {
      const address = object.address;
      if (!address || typeof address !== "object") {
        continue;
      }

      const street = normalizeText(address.streetAddress || "");
      const city = normalizeText(address.addressLocality || "");
      const province = normalizeText(address.addressRegion || "");

      if (street && !result.street) {
        result.street = street;
      }

      if (city && !result.city) {
        result.city = city;
      }

      if (province && !result.province) {
        result.province = province;
      }

      const extraParts = [
        normalizeText(address.addressCountry || ""),
        normalizeText(address.postalCode || ""),
      ].filter(Boolean);

      result.rawTokens.push(...extraParts);
    }

    return result;
  }

  function tokensToLocation(tokens) {
    const location = {
      street: null,
      neighborhood: null,
      district: null,
      city: null,
      province: null,
      rawTokens: tokens,
    };

    if (tokens.length === 0) {
      return location;
    }

    if (tokens.length === 1) {
      location.city = tokens[0];
      return location;
    }

    if (tokens.length === 2) {
      if (looksLikeStreet(tokens[0])) {
        if (looksLikeCompositeAreaName(tokens[0])) {
          location.neighborhood = tokens[0];
        } else {
          location.street = tokens[0];
        }
      } else {
        location.neighborhood = tokens[0];
      }

      location.city = tokens[1];
      return location;
    }

    if (tokens.length === 3) {
      if (looksLikeStreet(tokens[0])) {
        if (looksLikeCompositeAreaName(tokens[0])) {
          location.neighborhood = tokens[0];
          location.city = tokens[2];
          return sanitizeLocation(location);
        }

        const streetTokens = consumeStreetTokens(tokens);
        location.street = streetTokens.street;
        const rest = streetTokens.rest;

        if (rest.length === 2) {
          location.neighborhood = rest[0];
          location.city = rest[1];
          return sanitizeLocation(location);
        }

        if (rest.length === 1) {
          location.city = rest[0];
          return sanitizeLocation(location);
        }

        location.city = tokens[2];
        return sanitizeLocation(location);
      }

      location.neighborhood = tokens[0];
      location.district = tokens[1];
      location.city = tokens[2];
      return sanitizeLocation(location);
    }

    if (looksLikeStreet(tokens[0])) {
      if (looksLikeCompositeAreaName(tokens[0])) {
        location.neighborhood = tokens[0] || null;
        location.city = tokens.at(-1) || null;

        if (tokens.length >= 3) {
          location.district = tokens.length >= 4 ? tokens.at(-2) : null;
          if (tokens.length >= 5) {
            location.province = tokens.at(-1) || null;
            location.city = tokens.at(-2) || null;
            location.district = tokens.at(-3) || null;
          }
        }

        return sanitizeLocation(location);
      }

      const streetTokens = consumeStreetTokens(tokens);
      const rest = streetTokens.rest;

      location.street = streetTokens.street;

      if (rest.length === 1) {
        location.city = rest[0] || null;
        return sanitizeLocation(location);
      }

      if (rest.length === 2) {
        location.neighborhood = rest[0] || null;
        location.city = rest[1] || null;
        return sanitizeLocation(location);
      }

      if (rest.length === 3) {
        location.neighborhood = rest[0] || null;
        location.district = rest[1] || null;
        location.city = rest[2] || null;
        return sanitizeLocation(location);
      }

      location.neighborhood = rest[0] || null;
      location.district = rest[1] || null;
      location.city = rest[2] || null;
      location.province = rest[3] || null;
      return sanitizeLocation(location);
    }

    location.neighborhood = tokens[0] || null;
    location.district = tokens[1] || null;
    location.city = tokens[2] || null;
    location.province = tokens[3] || null;
    return sanitizeLocation(location);
  }

  function looksLikeStreet(value) {
    return /^(calle|c\/|avenida|avda\.?|plaza|paseo|camino|ronda|traves[ií]a|carretera|glorieta|cuesta|urbanizacion|urbanización)\b/i.test(
      value || ""
    );
  }

  function looksLikeCompositeAreaName(value) {
    const normalized = normalizeText(value || "");

    if (!normalized) {
      return false;
    }

    if (!looksLikeStreet(normalized)) {
      return false;
    }

    if (looksLikeStreetNumber(normalized)) {
      return false;
    }

    if (/\s-\s/.test(normalized)) {
      return true;
    }

    if (/^(plaza|avenida|paseo)\s+de\s+/i.test(normalized) && !/\d/.test(normalized)) {
      return true;
    }

    return false;
  }

  function looksLikeStreetNumber(value) {
    return /^\d+[a-z]?(?:\s|$)/i.test(normalizeText(value || ""));
  }

  function consumeStreetTokens(tokens) {
    const streetParts = [tokens[0]];
    let index = 1;

    while (index < tokens.length && looksLikeStreetNumber(tokens[index])) {
      streetParts.push(tokens[index]);
      index += 1;
    }

    return {
      street: streetParts.join(", "),
      rest: tokens.slice(index),
    };
  }

  function sanitizeLocation(location) {
    const sanitized = { ...location };

    if (sanitized.neighborhood && looksLikeStreetNumber(sanitized.neighborhood)) {
      if (!sanitized.street) {
        sanitized.street = sanitized.neighborhood;
      }
      sanitized.neighborhood = sanitized.district || null;
      sanitized.district = null;
    }

    return sanitized;
  }

  function extractCoordinates(objects) {
    for (const object of objects) {
      const geo = object.geo;
      if (!geo || typeof geo !== "object") {
        continue;
      }

      const latitude = Number.parseFloat(geo.latitude);
      const longitude = Number.parseFloat(geo.longitude);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return {
          latitude,
          longitude,
        };
      }
    }

    return null;
  }

  function extractTargetAsset({ doc, title, pageText, jsonLd, location, listingId, canonicalUrl }) {
    const priceEur = extractSalePrice(doc, pageText, jsonLd);
    const areaM2 = extractAreaM2(pageText, jsonLd);
    const rooms = extractRooms(pageText, jsonLd);
    const bathrooms = extractBathrooms(pageText, jsonLd);
    const propertyType = extractPropertyType(title, pageText);
    const floor = extractFloor(pageText);
    const hasElevator = extractElevator(pageText);
    const isExterior = extractExterior(pageText);
    const state = extractCondition(pageText);
    const operation = extractOperation(title, pageText);

    return {
      listingId,
      canonicalUrl,
      operation,
      propertyType,
      priceEur,
      areaM2,
      pricePerM2: priceEur && areaM2 ? Math.round(priceEur / areaM2) : null,
      rooms,
      bathrooms,
      floor,
      hasElevator,
      isExterior,
      state,
      address: location.street,
      zone: location.zoneLabel,
      neighborhood: location.neighborhood,
      district: location.district,
      municipality: location.city,
      province: location.province,
      coordinates: extractCoordinates(jsonLd),
      confidence: buildAssetConfidence({
        priceEur,
        areaM2,
        rooms,
        propertyType,
        municipality: location.city,
        province: location.province,
      }),
    };
  }

  function buildAssetConfidence(asset) {
    const score =
      (asset.priceEur ? 0.25 : 0) +
      (asset.areaM2 ? 0.2 : 0) +
      (asset.rooms ? 0.15 : 0) +
      (asset.propertyType ? 0.1 : 0) +
      (asset.municipality ? 0.15 : 0) +
      (asset.province ? 0.15 : 0);

    return Math.min(1, Number(score.toFixed(2)));
  }

  function extractOperation(title, pageText) {
    const titleText = normalizeText(title).toLowerCase();

    if (/\ben venta\b/.test(titleText) || /^venta\b/.test(titleText) || /\bpiso en venta\b/.test(titleText)) {
      return "sale";
    }

    if (
      /\ben alquiler\b/.test(titleText) ||
      /^alquiler\b/.test(titleText) ||
      /\bpiso en alquiler\b/.test(titleText)
    ) {
      return "rent";
    }

    const focusedText = normalizeText(pageText).toLowerCase().slice(0, 1800);

    if (/\bhipoteca\b/.test(focusedText) || /\bcomprar\b/.test(focusedText)) {
      return "sale";
    }

    if (/\b\d[\d.]*\s*€\s*\/\s*mes\b/.test(focusedText) || /\btemporada\b/.test(focusedText)) {
      return "rent";
    }

    if (/\bventa\b/.test(focusedText) && !/\balquiler\b/.test(focusedText)) {
      return "sale";
    }

    if (/\balquiler\b/.test(focusedText) && !/\bventa\b/.test(focusedText)) {
      return "rent";
    }

    return "unknown";
  }

  function extractPropertyType(title, pageText) {
    const titleText = normalizeText(title).toLowerCase();
    const pageTextNormalized = normalizeText(pageText).toLowerCase();

    const patterns = [
      { regex: /\bcasa o chalet independiente\b/, value: "casa o chalet independiente" },
      { regex: /\bcasa o chalet adosado\b/, value: "casa o chalet adosado" },
      { regex: /\bcasa o chalet\b/, value: "casa o chalet" },
      { regex: /\bchalet\b/, value: "chalet" },
      { regex: /\b[aá]tico\b/, value: "atico" },
      { regex: /\bapartamento\b/, value: "apartamento" },
      { regex: /\bestudio\b/, value: "estudio" },
      { regex: /\bd[uú]plex\b/, value: "duplex" },
      { regex: /\bloft\b/, value: "loft" },
      { regex: /\bpiso\b/, value: "piso" },
      { regex: /\bcasa\b/, value: "casa" },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(titleText)) {
        return pattern.value;
      }
    }

    for (const pattern of patterns) {
      if (pattern.regex.test(pageTextNormalized)) {
        return pattern.value;
      }
    }

    return null;
  }

  function extractSalePrice(doc, pageText, jsonLd) {
    const selectorCandidates = [
      '[class*="price" i]',
      '[data-testid*="price" i]',
      'meta[property="product:price:amount"]',
    ];

    for (const selector of selectorCandidates) {
      const node = doc.querySelector(selector);
      if (!node) {
        continue;
      }

      const raw = node.content || node.textContent || "";
      const price = parseEuroAmount(raw);
      if (price) {
        return price;
      }
    }

    for (const object of jsonLd) {
      const price = parseEuroAmount(object?.offers?.price || object?.price || "");
      if (price) {
        return price;
      }
    }

    const explicitSaleMatch = pageText.match(/precio[^0-9]{0,30}(\d[\d.]*)\s*€/i);
    if (explicitSaleMatch) {
      return parseEuroAmount(explicitSaleMatch[1]);
    }

    const genericMatches = [...pageText.matchAll(/(\d[\d.]*)\s*€/g)];
    for (const match of genericMatches) {
      const nextWindow = pageText.slice(match.index, match.index + 30).toLowerCase();
      if (nextWindow.includes("/mes")) {
        continue;
      }

      return parseEuroAmount(match[1]);
    }

    return null;
  }

  function parseEuroAmount(value) {
    const normalized = normalizeText(String(value));
    const match = normalized.match(/(\d[\d.]*)/);

    if (!match) {
      return null;
    }

    const parsed = Number.parseInt(match[1].replace(/\./g, ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function extractAreaM2(pageText, jsonLd) {
    for (const object of jsonLd) {
      const floorSize = object.floorSize;
      if (floorSize && typeof floorSize === "object") {
        const value = parseSurfaceAmount(floorSize.value || "");
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }

    const match = pageText.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
    if (!match) {
      return null;
    }

    return parseSurfaceAmount(match[1]);
  }

  function parseSurfaceAmount(value) {
    const raw = normalizeText(String(value));

    if (!raw) {
      return null;
    }

    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) {
      const normalized = raw.replace(/\./g, "").replace(",", ".");
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (/^\d+(?:,\d+)?$/.test(raw)) {
      const parsed = Number.parseFloat(raw.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }

    const fallback = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(fallback) ? fallback : null;
  }

  function extractRooms(pageText, jsonLd) {
    for (const object of jsonLd) {
      const value = Number.parseInt(object.numberOfRooms, 10);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    const match = pageText.match(/(\d+)\s+hab\b/i);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function extractBathrooms(pageText, jsonLd) {
    for (const object of jsonLd) {
      const value = Number.parseInt(object.numberOfBathroomsTotal, 10);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    const match = pageText.match(/(\d+)\s+ba[nñ]os?\b/i);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function extractFloor(pageText) {
    const patterns = [
      /\b(bajo|entreplanta|semisotano|semisótano|sotano|sótano)\b/i,
      /\bplanta\s+(\d+[ªº]?)/i,
      /\b(\d+[ªº])\s+planta\b/i,
    ];

    for (const pattern of patterns) {
      const match = pageText.match(pattern);
      if (!match) {
        continue;
      }

      return normalizeText(match[1] || match[0]);
    }

    return null;
  }

  function extractElevator(pageText) {
    if (/\bcon ascensor\b/i.test(pageText)) {
      return true;
    }

    if (/\bsin ascensor\b/i.test(pageText)) {
      return false;
    }

    return null;
  }

  function extractExterior(pageText) {
    if (/\bexterior\b/i.test(pageText)) {
      return true;
    }

    if (/\binterior\b/i.test(pageText)) {
      return false;
    }

    return null;
  }

  function extractCondition(pageText) {
    const patterns = [
      { regex: /\breformado\b/i, value: "reformado" },
      { regex: /\bpara reformar\b/i, value: "para reformar" },
      { regex: /\bbuen estado\b/i, value: "buen estado" },
      { regex: /\bnuevo\b/i, value: "nuevo" },
      { regex: /\ba estrenar\b/i, value: "a estrenar" },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(pageText)) {
        return pattern.value;
      }
    }

    return null;
  }

  function buildSearchStrategy(targetAsset) {
    return buildSharedSearchStrategy(targetAsset);
  }

  function buildComparableRules() {
    return buildSharedComparableRules();
  }

  function getCandidateLinks(doc) {
    const nodes = [...doc.querySelectorAll('a[href*="/alquiler-viviendas/"], a[href*="/venta-viviendas/"]')];

    return nodes
      .map((node) => ({
        text: normalizeText(node.textContent),
        href: node.href,
      }))
      .filter((item) => item.text && item.href)
      .slice(0, 20);
  }

  function buildGuardrails(location, searchStrategy, comparableRules) {
    return buildSharedGuardrails(location, searchStrategy, comparableRules);
  }

  async function searchIdealistaComparables(doc, currentUrl) {
    const subject = extractIdealistaContext(doc, currentUrl);
    const comparables = [];
    const discarded = [];
    const searchTrace = [];
    const seenListingIds = new Set();
    const zoneSaleLink = subject.candidateLinks.find(
      (item) =>
        /\/venta-viviendas\//.test(item.href) &&
        normalizeForCompare(item.text).includes(normalizeForCompare(subject.location.zoneLabel || ""))
    );
    const inferredProvince = await inferProvinceForSearch(subject, zoneSaleLink?.href || null);

    for (const scope of subject.searchStrategy.scopes) {
      if (!scope.active) {
        continue;
      }

      const scopeUrls = buildScopeUrls(subject, scope, {
        zoneSaleLinkHref: zoneSaleLink?.href || null,
        inferredProvince,
      });
      if (scopeUrls.length === 0) {
        searchTrace.push({
          scope: scope.id,
          areaName: scope.areaName,
          triedUrls: [],
          fetchedCandidates: 0,
          validComparables: comparables.length,
          note: "No se pudo derivar una URL de busqueda para este scope.",
        });
        continue;
      }

      let fetchedCandidates = 0;

      for (const searchUrl of scopeUrls) {
        let pageResult;

        try {
          pageResult = await loadSearchPageViaBackground(searchUrl, scope.id);
        } catch (error) {
          searchTrace.push({
            scope: scope.id,
            areaName: scope.areaName,
            triedUrls: [searchUrl],
            fetchedCandidates: 0,
            validComparables: comparables.length,
            note: error.message,
          });
          continue;
        }

        if (pageResult.note && pageResult.candidates.length === 0) {
          searchTrace.push({
            scope: scope.id,
            areaName: scope.areaName,
            triedUrls: [searchUrl],
            fetchedCandidates: 0,
            validComparables: comparables.length,
            note: pageResult.note,
          });
        }

        const candidates = pageResult.candidates;
        fetchedCandidates += candidates.length;

        for (const candidate of candidates.slice(0, MAX_CANDIDATES_PER_SCOPE_URL)) {
          if (!candidate.listingId || seenListingIds.has(candidate.listingId)) {
            continue;
          }

          seenListingIds.add(candidate.listingId);

          let validation;
          try {
            validation = await validateComparableCandidate(candidate, subject, scope.id);
          } catch (error) {
            discarded.push({
              listingId: candidate.listingId,
              title: candidate.title,
              url: candidate.url,
              scope: scope.id,
              reason: `Error validando ficha: ${error.message}`,
            });
            continue;
          }

          if (!validation.valid) {
            discarded.push({
              listingId: candidate.listingId,
              title: candidate.title,
              url: candidate.url,
              scope: scope.id,
              reason: validation.reason,
            });
            continue;
          }

          comparables.push(validation.comparable);
        }

      }

      searchTrace.push({
        scope: scope.id,
        areaName: scope.areaName,
        triedUrls: scopeUrls,
        fetchedCandidates,
        validComparables: comparables.length,
      });
    }

    const estimate = buildRentEstimate(subject, comparables);
    const profitability = buildProfitabilityEstimate(subject, estimate);

    return {
      subject,
      comparables,
      discarded,
      estimate,
      profitability,
      searchTrace,
      inferredProvince,
    };
  }

  function buildScopeUrls(subject, scope, helpers = {}) {
    const urls = [];
    const zoneSaleLinkHref = helpers.zoneSaleLinkHref || null;
    const inferredProvince = helpers.inferredProvince || null;

    if (scope.id === "zone") {
      if (zoneSaleLinkHref) {
        urls.push(zoneSaleLinkHref.replace("/venta-viviendas/", "/alquiler-viviendas/"));
      } else if (
        subject.location.city &&
        subject.location.zoneSlug &&
        subject.location.zoneSlug !== subject.location.municipalitySlug
      ) {
        urls.push(
          `https://www.idealista.com/alquiler-viviendas/${slugify(subject.location.city)}/${subject.location.zoneSlug}/`
        );
      }
    }

    if (scope.id === "municipality") {
      const primaryProvince = getPrimaryProvinceName(subject.location.province || inferredProvince);
      if (subject.location.city && primaryProvince) {
        urls.push(
          `https://www.idealista.com/alquiler-viviendas/${slugify(subject.location.city)}-${slugify(primaryProvince)}/`
        );
      }

      if (subject.location.city) {
        urls.push(`https://www.idealista.com/alquiler-viviendas/${slugify(subject.location.city)}/`);
      }
    }

    return [...new Set(urls.filter(Boolean))];
  }

  async function inferProvinceForSearch(subject, zoneSaleLinkHref) {
    if (subject.location.province) {
      return subject.location.province;
    }

    if (!zoneSaleLinkHref) {
      return null;
    }

    try {
      const html = await fetchIdealistaHtml(zoneSaleLinkHref);
      return extractProvinceFromIdealistaHtml(html, subject.location.city);
    } catch {
      return null;
    }
  }

  async function loadSearchPageViaBackground(url, scopeId) {
    const response = await chrome.runtime.sendMessage({
      type: "OPEN_IDEALISTA_SEARCH_PAGE",
      url,
      scopeId,
    });

    if (!response?.ok) {
      throw new Error(response?.error || `No se pudo cargar la busqueda ${url}`);
    }

    return response.result;
  }

  function extractProvinceFromIdealistaHtml(html, city) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = normalizeText(doc.body?.innerText || "");

    const specificPatterns = [
      /\bAlicante\s*\/\s*Alacant\b/i,
      /\bValencia\s*\/\s*València\b/i,
      /\bCastell[oó]n\s*\/\s*Castell[óo]\b/i,
      /\bA Coru[nñ]a\b/i,
      /\bLa Coru[nñ]a\b/i,
    ];

    for (const pattern of specificPatterns) {
      const match = text.match(pattern);
      if (match) {
        return normalizeText(match[0]);
      }
    }

    if (city) {
      const cityPattern = new RegExp(
        `${escapeRegex(normalizeText(city))}\\s*[\\/,]\\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ\\/' -]+)`,
        "i"
      );
      const match = text.match(cityPattern);
      if (match) {
        return normalizeText(match[1]);
      }
    }

    return null;
  }

  async function fetchIdealistaHtml(url) {
    const response = await fetch(url, {
      credentials: "include",
    });

    const html = await response.text();

    if (!response.ok) {
      throw new Error(`La busqueda devolvio ${response.status} en ${url}`);
    }

    const compact = normalizeText(html);
    if (isBlockedIdealistaPageText(compact)) {
      throw new Error("Idealista ha bloqueado la busqueda automatizada para esta sesion.");
    }

    return html;
  }

  function scrapeComparableListPage(doc, currentUrl, scopeId) {
    const text = doc.body?.innerText || "";
    if (isBlockedIdealistaPageText(text)) {
      return {
        currentUrl,
        scopeId,
        candidates: [],
        note: "Idealista ha bloqueado la busqueda automatizada para esta sesion.",
      };
    }

    if (isIdealistaNotFoundPage(doc)) {
      return {
        currentUrl,
        scopeId,
        candidates: [],
        note: `La busqueda devolvio 404 en ${currentUrl}`,
      };
    }

    return {
      currentUrl,
      scopeId,
      candidates: parseRentListingCardsFromDocument(doc, currentUrl, scopeId),
      note: null,
    };
  }

  function scrapeSaleListPage(doc, currentUrl) {
    const text = doc.body?.innerText || "";
    if (isBlockedIdealistaPageText(text)) {
      throw new Error("Idealista ha bloqueado la lectura automatizada del listado para esta sesion.");
    }

    if (isIdealistaNotFoundPage(doc)) {
      throw new Error(`La pagina de venta ha devuelto 404 en ${currentUrl}`);
    }

    return {
      title: normalizeText(doc.querySelector("title")?.textContent || "Listado de venta"),
      currentUrl,
      listings: parseSaleListingCardsFromDocument(doc, currentUrl),
    };
  }

  function parseRentListingCards(html, searchUrl, scopeId) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return parseRentListingCardsFromDocument(doc, searchUrl, scopeId);
  }

  function parseRentListingCardsFromDocument(doc, searchUrl, scopeId) {
    const results = [];
    const seen = new Set();
    const links = [...doc.querySelectorAll('a[href*="/inmueble/"]')];

    for (const link of links) {
      const listingId = extractListingId(link.href);
      if (!listingId || seen.has(listingId)) {
        continue;
      }

      const container = getComparableCardContainer(link);
      const title = normalizeText(
        link.textContent ||
          link.getAttribute("title") ||
          container?.querySelector('[class*="item-link" i]')?.textContent ||
          container?.querySelector("h2,h3")?.textContent ||
          ""
      );

      const cardText = normalizeText(container?.textContent || link.textContent || "");
      if (!title && !/€|m²|hab/i.test(cardText)) {
        continue;
      }

      const priceMatch = cardText.match(/(\d[\d.]*)\s*€\s*\/\s*mes/i);
      const areaMatch = cardText.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
      const roomsMatch = cardText.match(/(\d+)\s+hab\b/i);
      const bathroomsMatch = cardText.match(/(\d+)\s+ba[nñ]os?\b/i);

      results.push({
        listingId,
        title: title || `Comparable ${listingId}`,
        url: link.href,
        scope: scopeId,
        sourceSearchUrl: searchUrl,
        previewPriceEur: priceMatch ? parseEuroAmount(priceMatch[1]) : null,
        previewAreaM2: areaMatch ? parseSurfaceAmount(areaMatch[1]) : null,
        previewRooms: roomsMatch ? Number.parseInt(roomsMatch[1], 10) : null,
        previewBathrooms: bathroomsMatch ? Number.parseInt(bathroomsMatch[1], 10) : null,
        previewText: cardText.slice(0, 500),
      });

      seen.add(listingId);
    }

    return results;
  }

  function parseSaleListingCardsFromDocument(doc, currentUrl) {
    const results = [];
    const seen = new Set();
    const links = [...doc.querySelectorAll('a[href*="/inmueble/"]')];

    for (const link of links) {
      const listingId = extractListingId(link.href);
      if (!listingId || seen.has(listingId)) {
        continue;
      }

      const container = getComparableCardContainer(link);
      const title = normalizeText(
        link.textContent ||
          link.getAttribute("title") ||
          container?.querySelector('[class*="item-link" i]')?.textContent ||
          container?.querySelector("h2,h3")?.textContent ||
          ""
      );
      const cardText = normalizeText(container?.textContent || link.textContent || "");

      if (!/€/.test(cardText) || /€\s*\/\s*mes/i.test(cardText)) {
        continue;
      }

      if (!title && !/\ben venta\b/i.test(cardText)) {
        continue;
      }

      const priceMatch = cardText.match(/(\d[\d.]*)\s*€/i);
      const areaMatch = cardText.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
      const roomsMatch = cardText.match(/(\d+)\s+hab\b/i);

      results.push({
        listingId,
        title: title || `Activo ${listingId}`,
        url: link.href,
        sourceSearchUrl: currentUrl,
        previewPriceEur: priceMatch ? parseEuroAmount(priceMatch[1]) : null,
        previewAreaM2: areaMatch ? parseSurfaceAmount(areaMatch[1]) : null,
        previewRooms: roomsMatch ? Number.parseInt(roomsMatch[1], 10) : null,
        previewText: cardText.slice(0, 500),
      });

      seen.add(listingId);
    }

    return results;
  }

  function getComparableCardContainer(link) {
    const selectors = [
      "article",
      "li",
      '[class*="item" i]',
      '[class*="result" i]',
    ];

    for (const selector of selectors) {
      const container = link.closest(selector);
      if (container) {
        return container;
      }
    }

    return link.parentElement;
  }

  async function validateComparableCandidate(candidate, subject, scopeId) {
    const context = buildComparablePreviewContext(candidate, subject, scopeId);
    const reason = getComparableRejectionReason(subject, context, scopeId);

    if (reason) {
      return {
        valid: false,
        reason,
      };
    }

    return {
      valid: true,
      comparable: buildComparableRecord(subject, context, candidate, scopeId),
    };
  }

  function buildComparablePreviewContext(candidate, subject, scopeId) {
    const subjectAsset = subject?.targetAsset || {};
    const previewText = normalizeText(`${candidate.title || ""} ${candidate.previewText || ""}`);
    const priceEur = Number.isFinite(candidate.previewPriceEur)
      ? candidate.previewPriceEur
      : extractPreviewMonthlyRent(previewText);
    const areaM2 = Number.isFinite(candidate.previewAreaM2) ? candidate.previewAreaM2 : extractAreaM2(previewText, []);
    const rooms = Number.isFinite(candidate.previewRooms) ? candidate.previewRooms : extractRooms(previewText, []);
    const bathrooms = Number.isFinite(candidate.previewBathrooms)
      ? candidate.previewBathrooms
      : extractBathrooms(previewText, []);
    const propertyType = extractPropertyType(candidate.title || "", previewText);
    const state = extractCondition(previewText);

    return {
      page: {
        title: candidate.title || `Comparable ${candidate.listingId}`,
        currentUrl: candidate.url,
        canonicalUrl: candidate.url,
        listingId: candidate.listingId,
      },
      rawSignals: {
        title: candidate.title || "",
        breadcrumbs: [],
        jsonLdObjects: 0,
        pageTextSample: previewText,
      },
      targetAsset: {
        listingId: candidate.listingId,
        canonicalUrl: candidate.url,
        operation: "rent",
        propertyType,
        priceEur,
        areaM2,
        pricePerM2: priceEur && areaM2 ? Math.round(priceEur / areaM2) : null,
        rooms,
        bathrooms,
        floor: null,
        hasElevator: null,
        isExterior: null,
        state,
        address: null,
        zone: scopeId === "zone" ? subjectAsset.zone || null : null,
        neighborhood: subjectAsset.neighborhood || null,
        district: subjectAsset.district || null,
        municipality: subjectAsset.municipality || null,
        province: subjectAsset.province || null,
        coordinates: null,
        confidence: buildAssetConfidence({
          priceEur,
          areaM2,
          rooms,
          propertyType,
          municipality: subjectAsset.municipality || null,
          province: subjectAsset.province || null,
        }),
      },
    };
  }

  function extractPreviewMonthlyRent(previewText) {
    const match = normalizeText(previewText).match(/(\d[\d.]*)\s*€\s*\/\s*mes/i);
    return match ? parseEuroAmount(match[1]) : null;
  }

  function getComparableRejectionReason(subject, candidateContext, scopeId) {
    return getSharedComparableRejectionReason(subject, candidateContext, scopeId);
  }

  function buildComparableRecord(subject, context, candidate, scopeId) {
    return buildSharedComparableRecord(subject, context, candidate, scopeId);
  }

  function buildRentEstimate(subject, comparables) {
    return buildSharedRentEstimate(subject, comparables);
  }

  function buildProfitabilityEstimate(subject, rentEstimate) {
    return buildSharedProfitabilityEstimate(subject, rentEstimate);
  }

  function normalizeForCompare(value) {
    return slugify(value || "");
  }

  function getPrimaryProvinceName(province) {
    const value = normalizeText(province || "");
    if (!value) {
      return null;
    }

    return normalizeText(value.split("/")[0]);
  }

  function summarizeSignals(title, breadcrumbs, jsonLd, pageText) {
    return {
      title,
      breadcrumbs,
      jsonLdObjects: jsonLd.length,
      pageTextSample: pageText.slice(0, 600),
    };
  }
})();
