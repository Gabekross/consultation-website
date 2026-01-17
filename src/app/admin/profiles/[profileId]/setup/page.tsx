"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Theme = "dark" | "light";

type Profile = {
  id: string;
  slug: string;
  display_name: string;
  accent_color: string;
  theme: Theme | null;
  hero_headline: string | null;
  hero_subtext: string | null;
  whatsapp_number: string | null;
  notification_emails: string[];
};

export default function ProfileSetupPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const sb = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [accentColor, setAccentColor] = useState("#27c26a");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [emailsCsv, setEmailsCsv] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr) {
      setMsg(authErr.message);
      setLoading(false);
      return;
    }
    if (!auth.user) {
      location.href = "/admin/login";
      return;
    }

    const { data, error } = await sb
      .from("profiles")
      .select(
        "id,slug,display_name,accent_color,theme,hero_headline,hero_subtext,whatsapp_number,notification_emails"
      )
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setMsg("Profile not found.");
      setLoading(false);
      return;
    }

    const p = data as Profile;

    setProfile({
      ...p,
      theme: (p.theme ?? "dark") as Theme,
      notification_emails: p.notification_emails ?? [],
    });

    setDisplayName(p.display_name ?? "");
    setAccentColor(p.accent_color ?? "#27c26a");
    setHeadline(p.hero_headline ?? "");
    setSubtext(p.hero_subtext ?? "");
    setWhatsapp(p.whatsapp_number ?? "");
    setEmailsCsv((p.notification_emails ?? []).join(","));

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function save() {
    setMsg(null);
    if (!profile) return;

    const emails = emailsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { error } = await sb
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        theme: (profile.theme ?? "dark") as Theme,
        accent_color: accentColor.trim(),
        hero_headline: headline.trim() || null,
        hero_subtext: subtext.trim() || null,
        whatsapp_number: whatsapp.trim() || null,
        notification_emails: emails,
      })
      .eq("id", profileId);

    if (error) return setMsg(error.message);

    setMsg("Saved.");
    await load();
  }

  return (
    <section>
      <div className="h2">Setup</div>
      <p className="p">
        Update public branding, theme, WhatsApp, and notification emails (multiple supported).
      </p>

      {msg ? <p className="p">{msg}</p> : null}
      {loading ? <span className="badge">Loading…</span> : null}

      {profile ? (
        <>
          <label className="label">Theme</label>
          <select
            value={(profile.theme ?? "dark") as Theme}
            onChange={(e) =>
              setProfile({ ...profile, theme: e.target.value as Theme })
            }
            className="input"
          >
            <option value="dark">Dark cards</option>
            <option value="light">Light (modern white)</option>
          </select>
          <p className="hint">Choose how your public page cards appear.</p>
        </>
      ) : null}

      <div className="grid2" style={{ marginTop: 10 }}>
        <div className="field">
          <div className="label">Display name</div>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="label">Accent color</div>
          <input
            className="input"
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
          />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Hero headline</div>
          <input
            className="input"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Hero subtext</div>
          <textarea
            className="textarea"
            value={subtext}
            onChange={(e) => setSubtext(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="label">WhatsApp number</div>
          <input
            className="input"
            placeholder="e.g. +1 214..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="label">Notification emails (comma separated)</div>
          <input
            className="input"
            placeholder="you@email.com,partner@email.com"
            value={emailsCsv}
            onChange={(e) => setEmailsCsv(e.target.value)}
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={!profile || loading}>
          Save
        </button>
        {profile ? (
          <span className="badge">Public URL: /{profile.slug}</span>
        ) : null}
      </div>
    </section>
  );
}
