"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function CreateProfilePage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [emails, setEmails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { data: auth } = await sb.auth.getSession();
    const token = auth.session?.access_token;
    if (!token) return setMsg("Please sign in first.");

    const res = await fetch("/api/profiles/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ display_name: displayName, slug, whatsapp_number: whatsapp || null, notification_emails: emails || null }),
    });

    const j = await res.json();
    if (!res.ok) return setMsg(j?.error ?? "Failed");
    setMsg(`Created profile: /${j.slug} (status: ${j.status})`);
  }

  return (
    <main className="container">
      <div className="card" style={{ padding: 22, maxWidth: 720, margin: "0 auto" }}>
        <div className="kicker">Create profile</div>
        <div className="h1" style={{ fontSize: 34 }}>Self-serve onboarding</div>
        <p className="p">Profiles are created as <b>pending</b> and require platform approval to go live.</p>

        <form onSubmit={submit}>
          <div className="grid2">
            <div className="field">
              <div className="label">Display name</div>
              <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            </div>
            <div className="field">
              <div className="label">Slug (URL)</div>
              <input
                className="input"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="mc-finest"
                required
              />
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <div className="label">WhatsApp number (E.164)</div>
              <input className="input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="14155552671" />
            </div>
            <div className="field">
              <div className="label">Notification emails (comma-separated)</div>
              <input className="input" value={emails} onChange={e => setEmails(e.target.value)} placeholder="you@email.com, partner@email.com" />
            </div>
          </div>

          <button className="btn" type="submit">Create profile</button>
        </form>

        {msg ? <p className="p" style={{ marginTop: 12 }}>{msg}</p> : null}

        <hr className="hr" />
        <a className="btn secondary" href="/admin">Back to dashboard</a>
      </div>
    </main>
  );
}
