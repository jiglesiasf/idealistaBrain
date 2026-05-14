const PUBLIC_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const SERVER_ENV_KEYS = ["SUPABASE_SERVICE_ROLE_KEY"] as const;
const ALERTS_INBOX_ENV_KEYS = [
  "IMAP_HOST",
  "IMAP_PORT",
  "IMAP_USER",
  "IMAP_PASSWORD",
] as const;

export function getMissingSupabaseEnvKeys(options?: { includeServiceRole?: boolean }) {
  const keys = options?.includeServiceRole ? [...PUBLIC_ENV_KEYS, ...SERVER_ENV_KEYS] : [...PUBLIC_ENV_KEYS];
  return keys.filter((key) => !process.env[key]);
}

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase public environment variables. Expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}

export function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return serviceRoleKey;
}

export function getCompanionExtensionId() {
  return process.env.NEXT_PUBLIC_COMPANION_EXTENSION_ID ?? "";
}

export function getMissingAlertsInboxEnvKeys() {
  return ALERTS_INBOX_ENV_KEYS.filter((key) => !process.env[key]);
}

export function getAlertsInboxEnv() {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT);
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;

  if (!host || !Number.isFinite(port) || !user || !password) {
    throw new Error("Missing IMAP inbox environment variables.");
  }

  return {
    host,
    port,
    user,
    password,
    secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE !== "false" : true,
    mailbox: process.env.IMAP_MAILBOX || "INBOX",
    fromFilter: (process.env.IDEALISTA_ALERTS_FROM_FILTER || "idealista").toLowerCase(),
    maxMessages: Number.isFinite(Number(process.env.IMAP_POLL_MAX_MESSAGES))
      ? Math.max(1, Number(process.env.IMAP_POLL_MAX_MESSAGES))
      : 20,
  };
}
