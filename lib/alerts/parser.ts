import { createAutomatedListingJob } from "@/lib/jobs/service";
import { createAdminClient } from "@/lib/supabase/admin";

type RawInboxMessageRow = {
  id: string;
  user_id: string;
  subject: string;
  raw_html: string | null;
  raw_text: string | null;
  status: "pending" | "processed" | "ignored" | "failed";
};

type RawSavedSearchRow = {
  id: string;
  name: string;
  idealista_search_url: string;
  idealista_alert_label: string | null;
  is_active: boolean;
};

type ParsedAlertSection = {
  label: string;
  searchUrl: string | null;
  listings: Array<{
    listingId: string | null;
    listingUrl: string;
    title: string | null;
  }>;
};

type ProcessInboxResult = {
  messagesProcessed: number;
  eventsCreated: number;
  listingsExtracted: number;
  newListings: number;
  jobsCreated: number;
  failed: number;
};

type InsertedAlertListingRow = {
  id: string;
  listing_id: string | null;
  listing_url: string;
  title: string | null;
};

type RawListingWatchStateRow = {
  id: string;
  user_id: string;
  listing_id: string;
  listing_url: string;
  times_seen: number;
};

function canonicalizeIdealistaUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (!/idealista\.com$/i.test(url.hostname)) {
      return rawUrl;
    }

    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function inferEventType(subject: string, content: string) {
  const normalizedSubject = normalizeText(subject);
  const normalizedContent = normalizeText(content);

  if (normalizedSubject.includes("bajada") || normalizedContent.includes("bajada de precio")) {
    return "price-drops" as const;
  }

  if (normalizedContent.includes("anuncios recomendados") || normalizedContent.includes("recomendados")) {
    return "mixed" as const;
  }

  return "new-listings" as const;
}

function extractListingId(url: string) {
  const match = url.match(/\/inmueble\/(\d+)/i);
  return match?.[1] ?? null;
}

function parseIdealistaAlertSections(rawHtml: string, subject: string) {
  const sections: ParsedAlertSection[] = [];
  const titleRegex = /<div[^>]*>\s*<b>([^<]+)<\/b>\s*<\/div>/gi;
  const titleMatches = [...rawHtml.matchAll(titleRegex)];

  for (let index = 0; index < titleMatches.length; index += 1) {
    const match = titleMatches[index];
    const start = match.index ?? 0;
    const end = titleMatches[index + 1]?.index ?? rawHtml.length;
    const block = rawHtml.slice(start, end);
    const label = match[1]?.trim() || `Alert ${index + 1}`;

    const searchUrlMatch = block.match(/https:\/\/www\.idealista\.com\/venta-viviendas\/[^"]+/i);
    const searchUrl = searchUrlMatch ? canonicalizeIdealistaUrl(searchUrlMatch[0]) : null;

    const listingRegex = /<a href="(https:\/\/www\.idealista\.com\/inmueble\/\d+\/[^"]*)"[^>]*title="([^"]+)"/gi;
    const listings = [...block.matchAll(listingRegex)].map((listingMatch) => {
      const listingUrl = canonicalizeIdealistaUrl(listingMatch[1]);
      return {
        listingId: extractListingId(listingUrl),
        listingUrl,
        title: listingMatch[2]?.trim() || null,
      };
    });

    if (listings.length > 0) {
      sections.push({
        label,
        searchUrl,
        listings,
      });
    }
  }

  if (sections.length > 0) {
    return sections;
  }

  const fallbackListingRegex = /<a href="(https:\/\/www\.idealista\.com\/inmueble\/\d+\/[^"]*)"[^>]*title="([^"]+)"/gi;
  const fallbackListings = [...rawHtml.matchAll(fallbackListingRegex)].map((listingMatch) => {
    const listingUrl = canonicalizeIdealistaUrl(listingMatch[1]);
    return {
      listingId: extractListingId(listingUrl),
      listingUrl,
      title: listingMatch[2]?.trim() || null,
    };
  });

  if (fallbackListings.length === 0) {
    return [];
  }

  const fallbackSearchUrlMatch = rawHtml.match(/https:\/\/www\.idealista\.com\/venta-viviendas\/[^"]+/i);
  return [
    {
      label: subject.trim() || "Idealista alert",
      searchUrl: fallbackSearchUrlMatch ? canonicalizeIdealistaUrl(fallbackSearchUrlMatch[0]) : null,
      listings: fallbackListings,
    },
  ];
}

function resolveSavedSearchId(section: ParsedAlertSection, savedSearches: RawSavedSearchRow[]) {
  const normalizedLabel = normalizeText(section.label);
  const normalizedSearchUrl = section.searchUrl ? canonicalizeIdealistaUrl(section.searchUrl) : null;

  const byLabel = savedSearches.find((savedSearch) => {
    const candidates = [savedSearch.idealista_alert_label, savedSearch.name].filter(Boolean).map((value) => normalizeText(value));
    return candidates.some((candidate) => candidate.length > 0 && candidate === normalizedLabel);
  });

  if (byLabel) {
    return byLabel.id;
  }

  if (!normalizedSearchUrl) {
    return null;
  }

  const byUrl = savedSearches.find(
    (savedSearch) => canonicalizeIdealistaUrl(savedSearch.idealista_search_url) === normalizedSearchUrl
  );

  return byUrl?.id ?? null;
}

export async function processPendingInboxMessagesForUser(userId: string, limit = 20): Promise<ProcessInboxResult> {
  const admin = createAdminClient();
  const { data: messages, error: messagesError } = await admin
    .from("inbox_messages")
    .select("id, user_id, subject, raw_html, raw_text, status")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("received_at", { ascending: true })
    .limit(limit)
    .returns<RawInboxMessageRow[]>();

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const { data: savedSearches, error: savedSearchesError } = await admin
    .from("saved_searches")
    .select("id, name, idealista_search_url, idealista_alert_label, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .returns<RawSavedSearchRow[]>();

  if (savedSearchesError) {
    throw new Error(savedSearchesError.message);
  }

  let messagesProcessed = 0;
  let eventsCreated = 0;
  let listingsExtracted = 0;
  let newListings = 0;
  let jobsCreated = 0;
  let failed = 0;

  for (const message of messages ?? []) {
    const content = message.raw_html || message.raw_text || "";

    try {
      const sections = parseIdealistaAlertSections(content, message.subject);

      if (sections.length === 0) {
        const { error } = await admin
          .from("inbox_messages")
          .update({
            status: "failed",
            parse_error: "No he podido extraer listings del email de Idealista.",
          })
          .eq("id", message.id);

        if (error) {
          throw new Error(error.message);
        }

        failed += 1;
        continue;
      }

      const eventType = inferEventType(message.subject, content);

      for (const section of sections) {
        const savedSearchId = resolveSavedSearchId(section, savedSearches ?? []);

        const { data: eventRow, error: eventError } = await admin
          .from("search_alert_events")
          .insert({
            user_id: userId,
            saved_search_id: savedSearchId,
            inbox_message_id: message.id,
            event_type: eventType,
          })
          .select("id")
          .single<{ id: string }>();

        if (eventError) {
          throw new Error(eventError.message);
        }

        const listingRows = section.listings.map((listing) => ({
          alert_event_id: eventRow.id,
          listing_id: listing.listingId,
          listing_url: listing.listingUrl,
          title: listing.title,
          is_new: true,
          is_price_drop: eventType === "price-drops",
        }));

        const { data: insertedListings, error: listingsError } = await admin
          .from("search_alert_listings")
          .insert(listingRows)
          .select("id, listing_id, listing_url, title")
          .returns<InsertedAlertListingRow[]>();

        if (listingsError) {
          throw new Error(listingsError.message);
        }

        eventsCreated += 1;
        listingsExtracted += listingRows.length;

        for (const insertedListing of insertedListings ?? []) {
          if (!insertedListing.listing_id) {
            await admin.from("search_alert_listings").update({ is_new: false }).eq("id", insertedListing.id);
            continue;
          }

          const { data: existingState, error: stateLookupError } = await admin
            .from("listing_watch_state")
            .select("id, user_id, listing_id, listing_url, times_seen")
            .eq("user_id", userId)
            .eq("listing_id", insertedListing.listing_id)
            .maybeSingle<RawListingWatchStateRow>();

          if (stateLookupError) {
            throw new Error(stateLookupError.message);
          }

          if (existingState) {
            const { error: updateStateError } = await admin
              .from("listing_watch_state")
              .update({
                listing_url: insertedListing.listing_url,
                last_seen_at: new Date().toISOString(),
                times_seen: existingState.times_seen + 1,
                latest_saved_search_id: savedSearchId,
                latest_alert_event_id: eventRow.id,
              })
              .eq("id", existingState.id);

            if (updateStateError) {
              throw new Error(updateStateError.message);
            }

            const { error: markSeenError } = await admin
              .from("search_alert_listings")
              .update({ is_new: false })
              .eq("id", insertedListing.id);

            if (markSeenError) {
              throw new Error(markSeenError.message);
            }

            continue;
          }

          const { error: insertStateError } = await admin.from("listing_watch_state").insert({
            user_id: userId,
            listing_id: insertedListing.listing_id,
            listing_url: insertedListing.listing_url,
            latest_saved_search_id: savedSearchId,
            latest_alert_event_id: eventRow.id,
          });

          if (insertStateError) {
            throw new Error(insertStateError.message);
          }

          newListings += 1;

          await createAutomatedListingJob(admin, userId, insertedListing.listing_url, {
            source: "idealista-alert",
            inboxMessageId: message.id,
            alertEventId: eventRow.id,
            listingId: insertedListing.listing_id,
            title: insertedListing.title,
          });

          jobsCreated += 1;
        }
      }

      const { error: updateError } = await admin
        .from("inbox_messages")
        .update({
          status: "processed",
          parse_error: null,
        })
        .eq("id", message.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      messagesProcessed += 1;
    } catch (error) {
      const { error: updateError } = await admin
        .from("inbox_messages")
        .update({
          status: "failed",
          parse_error: error instanceof Error ? error.message : "Unexpected parsing error.",
        })
        .eq("id", message.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      failed += 1;
    }
  }

  return {
    messagesProcessed,
    eventsCreated,
    listingsExtracted,
    newListings,
    jobsCreated,
    failed,
  };
}
