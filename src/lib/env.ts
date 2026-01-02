import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

export function getClientEnv() {
  const parsed = clientSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Missing/invalid client env vars: " + parsed.error.message);
  }
  return parsed.data;
}

export function getServerEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Missing/invalid server env vars: " + parsed.error.message);
  }
  return parsed.data;
}
