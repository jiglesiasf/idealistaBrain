const PUBLIC_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const SERVER_ENV_KEYS = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

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
