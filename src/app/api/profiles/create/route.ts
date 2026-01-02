import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseCsvEmails } from "@/lib/platform";
import { getUserIdFromBearer, isPlatformAdmin } from "@/app/api/_auth";

const bodySchema = z.object({
  display_name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  whatsapp_number: z.string().nullable().optional(),
  notification_emails: z.string().nullable().optional(), // csv
});

export async function POST(req: Request) {
  const sb = supabaseAdmin();

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const userId = await getUserIdFromBearer(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await sb.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  const mode = (settings?.profile_creation_mode ?? "self_serve") as "self_serve" | "admin_only";
  const requireApproval = settings?.require_approval ?? true;

  if (mode === "admin_only") {
    const ok = await isPlatformAdmin(userId);
    if (!ok) return NextResponse.json({ error: "Profile creation is currently admin-only." }, { status: 403 });
  }

  const emails = parseCsvEmails(parsed.data.notification_emails);
  const status = requireApproval ? "pending" : "active";

  const { data: inserted, error } = await sb
    .from("profiles")
    .insert({
      display_name: parsed.data.display_name,
      slug: parsed.data.slug,
      whatsapp_number: parsed.data.whatsapp_number ?? null,
      notification_emails: emails,
      status,
      owner_user_id: userId,
    })
    .select("id,slug,status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await sb.from("profile_members").insert({ profile_id: inserted.id, user_id: userId, role: "owner" });

  return NextResponse.json({ slug: inserted.slug, status: inserted.status });
}
