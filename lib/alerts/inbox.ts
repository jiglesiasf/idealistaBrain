import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAlertsInboxEnv } from "@/lib/supabase/env";

type PollAlertsInboxResult = {
  scanned: number;
  inserted: number;
  duplicates: number;
  ignored: number;
};

function normalizeFromAddress(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function pickProviderMessageId(messageId: string | null | undefined, uid: number) {
  return messageId?.trim() || `imap-uid-${uid}`;
}

export async function pollAlertsInboxForUser(userId: string): Promise<PollAlertsInboxResult> {
  const inboxEnv = getAlertsInboxEnv();
  const admin = createAdminClient();
  const client = new ImapFlow({
    host: inboxEnv.host,
    port: inboxEnv.port,
    secure: inboxEnv.secure,
    auth: {
      user: inboxEnv.user,
      pass: inboxEnv.password,
    },
  });

  let scanned = 0;
  let inserted = 0;
  let duplicates = 0;
  let ignored = 0;

  try {
    await client.connect();
    await client.mailboxOpen(inboxEnv.mailbox);

    const unseenSequence = await client.search({ seen: false });
    const selectedSequence = Array.isArray(unseenSequence) ? unseenSequence.slice(-inboxEnv.maxMessages) : [];

    if (selectedSequence.length === 0) {
      return {
        scanned,
        inserted,
        duplicates,
        ignored,
      };
    }

    for await (const message of client.fetch(selectedSequence, {
      uid: true,
      envelope: true,
      source: true,
      internalDate: true,
    })) {
      scanned += 1;

      if (!message.source) {
        ignored += 1;
        continue;
      }

      const parsed = (await simpleParser(message.source)) as ParsedMail;
      const fromAddress = normalizeFromAddress(parsed.from?.value?.[0]?.address ?? parsed.from?.text ?? "");

      if (!fromAddress.includes(inboxEnv.fromFilter)) {
        ignored += 1;
        continue;
      }

      const providerMessageId = pickProviderMessageId(parsed.messageId, message.uid);
      const receivedAt =
        parsed.date?.toISOString() ||
        (message.internalDate instanceof Date ? message.internalDate.toISOString() : message.internalDate) ||
        new Date().toISOString();

      const { error } = await admin.from("inbox_messages").insert({
        user_id: userId,
        provider: "imap",
        provider_message_id: providerMessageId,
        from_address: fromAddress || "unknown",
        subject: parsed.subject?.trim() || "(sin asunto)",
        received_at: receivedAt,
        raw_html: typeof parsed.html === "string" ? parsed.html : null,
        raw_text: parsed.text?.trim() || null,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          duplicates += 1;
          continue;
        }

        throw new Error(error.message);
      }

      inserted += 1;
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return {
    scanned,
    inserted,
    duplicates,
    ignored,
  };
}
