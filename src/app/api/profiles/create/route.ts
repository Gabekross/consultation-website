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

  // Seed default Request Quote form fields (owners can edit in Phase 2)
  await sb.from("form_fields").insert([
    { profile_id: inserted.id, label: "Full name", field_key: "full_name", type: "text", required: true, order_index: 10 },
    { profile_id: inserted.id, label: "Phone", field_key: "phone", type: "phone", required: false, order_index: 20 },
    { profile_id: inserted.id, label: "Email", field_key: "email", type: "email", required: false, order_index: 30 },
    { profile_id: inserted.id, label: "Event date", field_key: "event_date", type: "date", required: false, order_index: 40 },
    { profile_id: inserted.id, label: "Event location", field_key: "event_location", type: "text", required: false, order_index: 50 },
    { profile_id: inserted.id, label: "Budget range", field_key: "budget_range", type: "select", required: false, options: ["$500–$1,000","$1,000–$2,000","$2,000–$3,000","$3,000+"], order_index: 60 },
    { profile_id: inserted.id, label: "Message", field_key: "message", type: "textarea", required: false, order_index: 70 },
  ]);

  return NextResponse.json({ slug: inserted.slug, status: inserted.status });
}
