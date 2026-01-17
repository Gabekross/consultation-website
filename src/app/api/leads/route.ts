import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function maybeSendEmail(args: {
  to: string[];
  from: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  if (!args.to.length) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  }).catch(() => null);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const profile_slug = String(form.get("profile_slug") ?? "");

  // Collect all fields (dynamic form builder support)
  const payload: Record<string, any> = { profile_slug };
  for (const [k, v] of form.entries()) {
    if (k === "profile_slug") continue;
    payload[k] = typeof v === "string" ? v : "";
  }

  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from("profiles")
    .select("id,display_name,notification_emails,whatsapp_number")
    .eq("slug", profile_slug)
    .maybeSingle();

  if (profile?.id) {
    await sb.from("leads").insert({
      profile_id: profile.id,
      form_data: payload,
      phone: phone || null,
      email: email || null,
    });

    const to = (profile.notification_emails ?? []).filter(Boolean);
    const from = process.env.RESEND_FROM_EMAIL || "no-reply@example.com";
    const subject = `New quote request for ${profile.display_name}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px">New quote request</h2>
        <p style="margin:0 0 12px"><strong>Profile:</strong> ${profile.display_name} (/${profile_slug})</p>
        <p style="margin:0 0 12px"><strong>Phone:</strong> ${phone || "—"}<br/>
        <strong>Email:</strong> ${email || "—"}<br/>
        <strong>WhatsApp:</strong> ${profile.whatsapp_number || "—"}</p>
        <pre style="background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap">${JSON.stringify(payload, null, 2)}</pre>
      </div>
    `;
    await maybeSendEmail({ to, from, subject, html });
  }

  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/thank-you?slug=${encodeURIComponent(profile_slug)}`, { status: 303 });
}
