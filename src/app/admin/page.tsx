"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = { id: string; slug: string; display_name: string; status: string; owner_user_id: string };

export default function AdminHome() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;

      const { data: roleRow } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "platform_admin")
        .maybeSingle();
      setIsPlatformAdmin(Boolean(roleRow));

      const { data: profs, error } = await sb
        .from("profiles")
        .select("id,slug,display_name,status,owner_user_id")
        .order("created_at", { ascending: false });

      if (error) setMsg(error.message);
      setProfiles((profs ?? []) as any);
    })();
  }, [sb]);

  async function signOut() {
    await sb.auth.signOut();
    location.href = "/admin/login";
  }

  const myProfiles = profiles.filter(p => p.owner_user_id === userId);

  return (
    <main className="container">
      <div className="card" style={{ padding: 22 }}>
        <div className="kicker">Admin</div>
        <div className="h1" style={{ fontSize: 34 }}>Dashboard</div>

        {!userId ? (
          <div className="row">
            <a className="btn" href="/admin/login">Sign in</a>
          </div>
        ) : (
          <>
            <div className="row" style={{ alignItems: "center" }}>
              <span className="badge">Signed in</span>
              {isPlatformAdmin ? <span className="badge">Platform Admin</span> : <span className="badge">Profile Owner</span>}
              <button className="btn secondary" onClick={signOut}>Sign out</button>
            </div>

            <hr className="hr" />

            <div className="row">
              <a className="btn" href="/admin/create-profile">Create a profile</a>
              {isPlatformAdmin ? <a className="btn secondary" href="/admin/platform/profiles">Approval queue</a> : null}
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="h2">Your profiles</div>
              <p className="p">Pending profiles are not publicly visible until approved.</p>

              <div className="row" style={{ marginTop: 10 }}>
                {myProfiles.length === 0 ? (
                  <div className="badge">No profiles yet</div>
                ) : (
                  myProfiles.map(p => (
                    <div key={p.id} className="card" style={{ padding: 14, flex: "1 1 320px" }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{p.display_name}</div>
                          <div className="p" style={{ margin: 0 }}>/{p.slug}</div>
                        </div>
                        <span className="badge">{p.status}</span>
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <a className="btn secondary" href={`/${p.slug}`} target="_blank">Open public</a>
                        <a className="btn" href={`/admin/profiles/${p.id}/setup`}>Manage</a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {msg ? <p className="p" style={{ marginTop: 14 }}>{msg}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}
