import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getClientEnv() {
  // ✅ IMPORTANT: build an explicit object (works in Next client bundles)
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Missing/invalid client env vars: " + parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join(", ")
    );
  }
  return parsed.data;
}

export function getServerEnv() {
  const raw = {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Missing/invalid server env vars: " + parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join(", ")
    );
  }
  return parsed.data;
}
