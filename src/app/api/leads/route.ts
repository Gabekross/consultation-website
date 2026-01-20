import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
      Authorization: `Bearer ${key}`,
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
  const sb = supabaseAdmin();
  const form = await req.formData();

  const profile_slug = String(form.get("profile_slug") ?? "").trim().toLowerCase();
  if (!profile_slug) {
    return NextResponse.json({ error: "Missing profile_slug" }, { status: 400 });
  }

  // Collect all fields (dynamic form builder support)
  const form_data: Record<string, any> = {};
  for (const [k, v] of form.entries()) {
    if (k === "profile_slug") continue;
    form_data[k] = typeof v === "string" ? v : "";
  }

  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  // Load profile (for routing, email recipients, and ownership)
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("id,slug,display_name,notification_emails,whatsapp_number,status")
    .eq("slug", profile_slug)
    .maybeSingle();

  if (profileErr || !profile?.id) {
    // Still redirect to thank-you to avoid revealing tenant existence publicly
    const url = new URL(req.url);
    return NextResponse.redirect(`${url.origin}/thank-you?slug=${encodeURIComponent(profile_slug)}`, {
      status: 303,
    });
  }

  // Optional: only accept leads for active profiles
  if (profile.status !== "active") {
    const url = new URL(req.url);
    return NextResponse.redirect(`${url.origin}/thank-you?slug=${encodeURIComponent(profile_slug)}`, {
      status: 303,
    });
  }

  // Insert lead (capture id + created_at)
  const { data: lead, error: leadErr } = await sb
    .from("leads")
    .insert({
      profile_id: profile.id,
      form_data,
      phone: phone || null,
      email: email || null,
    })
    .select("id, created_at")
    .single();

  // Even if lead insert fails, we still redirect user to thank-you
  // But we skip email if insert failed.
  if (!leadErr && lead) {
    // Fetch form fields so the email shows labels in the right order (nice UX)
    const { data: fields } = await sb
      .from("form_fields")
      .select("label,field_key,order_index")
      .eq("profile_id", profile.id)
      .order("order_index", { ascending: true });

    const ordered = (fields ?? []).map((f: any) => ({
      label: String(f.label ?? f.field_key),
      key: String(f.field_key),
    }));

    // Build formatted HTML list
    const rows = ordered.length
      ? ordered
          .map(({ label, key }) => {
            const val = form_data[key];
            const display = val === undefined || val === null || String(val).trim() === "" ? "—" : String(val);
            return `
              <tr>
                <td style="padding:8px 10px;border-bottom:1px solid #eee;"><strong>${escapeHtml(
                  label
                )}</strong></td>
                <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(display)}</td>
              </tr>
            `;
          })
          .join("")
      : Object.entries(form_data)
          .map(([k, v]) => {
            const display = v === undefined || v === null || String(v).trim() === "" ? "—" : String(v);
            return `
              <tr>
                <td style="padding:8px 10px;border-bottom:1px solid #eee;"><strong>${escapeHtml(
                  k
                )}</strong></td>
                <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(display)}</td>
              </tr>
            `;
          })
          .join("");

    const to = (profile.notification_emails ?? []).map((s: string) => s.trim()).filter(Boolean);
    const from = process.env.RESEND_FROM_EMAIL || "no-reply@example.com";

    const url = new URL(req.url);
    const base = url.origin;

    const subject = `New quote request for ${profile.display_name}`;
    const inboxUrl = `${base}/admin/profiles/${profile.id}/leads`;
    const publicUrl = `${base}/${profile.slug}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 8px">New quote request</h2>

        <p style="margin:0 0 12px">
          <strong>Profile:</strong> ${escapeHtml(profile.display_name)} (/${escapeHtml(profile.slug)})
          <br/>
          <strong>Lead ID:</strong> ${escapeHtml(lead.id)}
          <br/>
          <strong>Created:</strong> ${escapeHtml(String(lead.created_at))}
        </p>

        <p style="margin:0 0 12px">
          <strong>Phone:</strong> ${escapeHtml(phone || "—")}<br/>
          <strong>Email:</strong> ${escapeHtml(email || "—")}<br/>
          <strong>WhatsApp:</strong> ${escapeHtml(profile.whatsapp_number || "—")}
        </p>

        <div style="margin:10px 0 16px">
          <a href="${inboxUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;background:#20c56c;color:#0b0f0c;font-weight:700;margin-right:10px;">
            Open Leads Inbox
          </a>
          <a href="${publicUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #ddd;color:#111;">
            View Public Page
          </a>
        </div>

        <div style="border:1px solid #eee;border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <p style="margin:14px 0 0;color:#666;font-size:12px">
          This email was sent automatically from your MC booking platform.
        </p>
      </div>
    `;

    await maybeSendEmail({ to, from, subject, html });
  }

  // Always redirect user to thank you page
  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/thank-you?slug=${encodeURIComponent(profile_slug)}`, {
    status: 303,
  });
}
