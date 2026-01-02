import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const form = await req.formData();
  const profile_slug = String(form.get("profile_slug") ?? "");

  const payload = {
    profile_slug,
    full_name: String(form.get("full_name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    email: String(form.get("email") ?? ""),
    event_date: String(form.get("event_date") ?? ""),
    event_location: String(form.get("event_location") ?? ""),
    budget_range: String(form.get("budget_range") ?? ""),
    message: String(form.get("message") ?? ""),
  };

  const sb = supabaseAdmin();
  const { data: profile } = await sb.from("profiles").select("id").eq("slug", profile_slug).maybeSingle();

  if (profile?.id) {
    await sb.from("leads").insert({
      profile_id: profile.id,
      form_data: payload,
      phone: payload.phone || null,
      email: payload.email || null,
    });
  }

  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/thank-you?slug=${encodeURIComponent(profile_slug)}`, { status: 303 });
}
