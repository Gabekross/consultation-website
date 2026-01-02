import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getUserIdFromBearer(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const sb = supabaseAdmin();
  const { data } = await sb.auth.getUser(m[1]);
  return data.user?.id ?? null;
}

export async function isPlatformAdmin(userId: string) {
  const sb = supabaseAdmin();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "platform_admin").maybeSingle();
  return Boolean(data);
}
