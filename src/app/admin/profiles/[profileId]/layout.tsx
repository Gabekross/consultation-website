"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  slug: string;
  display_name: string;
  status: string;
};

export default function ProfileAdminLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const sb = useMemo(() => supabaseBrowser(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setMsg(null);
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        location.href = "/admin/login";
        return;
      }

      const { data, error } = await sb
        .from("profiles")
        .select("id,slug,display_name,status")
        .eq("id", profileId)
        .maybeSingle();

      if (error) setMsg(error.message);
      if (!data) setMsg("Profile not found or you don't have access.");
      setProfile((data ?? null) as any);
    })();
  }, [sb, profileId]);

  return (
    <main className="container">
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="kicker">Profile Admin</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              {profile ? profile.display_name : "Loading..."} {profile ? <span className="badge">{profile.status}</span> : null}
            </div>
            {profile ? <div className="p" style={{ margin: 0 }}>/{profile.slug}</div> : null}
          </div>
          <div className="row">
            <a className="btn secondary" href="/admin">Back</a>
            {profile ? <a className="btn secondary" href={`/${profile.slug}`} target="_blank">Open public</a> : null}
          </div>
        </div>

        <hr className="hr" />

        <div className="row" style={{ marginBottom: 14 }}>
          <a className="btn secondary" href={`/admin/profiles/${profileId}/setup`}>Setup</a>
          <a className="btn secondary" href={`/admin/profiles/${profileId}/form`}>Form Builder</a>
          <a className="btn secondary" href={`/admin/profiles/${profileId}/gallery`}>Gallery</a>
          <a className="btn secondary" href={`/admin/profiles/${profileId}/reviews`}>Reviews</a>
          <a className="btn secondary" href={`/admin/profiles/${profileId}/leads`}>Leads</a>
        </div>

        {msg ? <p className="p">{msg}</p> : null}
        {children}
      </div>
    </main>
  );
}
