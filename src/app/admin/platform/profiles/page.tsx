"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = { id: string; slug: string; display_name: string; status: string; created_at: string };

export default function PlatformProfilesPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function refresh() {
    setMsg(null);
    const { data: sess } = await sb.auth.getSession();
    const t = sess.session?.access_token ?? null;
    setToken(t);
    if (!t) return setMsg("Please sign in.");

    const { data: auth } = await sb.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return setMsg("Please sign in.");

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", uid).eq("role", "platform_admin").maybeSingle();
    if (!roleRow) {
      setIsAdmin(false);
      return setMsg("You are not a platform admin.");
    }
    setIsAdmin(true);

    const { data, error } = await sb.from("profiles").select("id,slug,display_name,status,created_at").order("created_at", { ascending: false });
    if (error) return setMsg(error.message);
    setProfiles((data ?? []) as any);
  }

  useEffect(() => { refresh(); }, []);

  async function approve(id: string) {
    if (!token) return setMsg("Missing token.");
    const res = await fetch(`/api/profiles/${id}/approve`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    const j = await res.json();
    if (!res.ok) return setMsg(j?.error ?? "Failed");
    await refresh();
  }

  async function reject(id: string) {
    if (!token) return setMsg("Missing token.");
    const reason = prompt("Rejection reason (optional):") ?? "";
    const res = await fetch(`/api/profiles/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    });
    const j = await res.json();
    if (!res.ok) return setMsg(j?.error ?? "Failed");
    await refresh();
  }

  return (
    <main className="container">
      <div className="card" style={{ padding: 22 }}>
        <div className="kicker">Platform Admin</div>
        <div className="h1" style={{ fontSize: 34 }}>Profiles</div>
        <p className="p">Approve pending profiles to publish their public pages.</p>

        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn secondary" onClick={refresh}>Refresh</button>
          <a className="btn secondary" href="/admin">Back</a>
        </div>

        {msg ? <p className="p">{msg}</p> : null}

        {!isAdmin ? null : (
          <div className="row">
            {profiles.map(p => (
              <div key={p.id} className="card" style={{ padding: 14, flex: "1 1 340px" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{p.display_name}</div>
                    <div className="p" style={{ margin: 0 }}>/{p.slug}</div>
                  </div>
                  <span className="badge">{p.status}</span>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  {p.status === "pending" ? (
                    <>
                      <button className="btn" onClick={() => approve(p.id)}>Approve</button>
                      <button className="btn secondary" onClick={() => reject(p.id)}>Reject</button>
                    </>
                  ) : (
                    <a className="btn secondary" href={`/${p.slug}`} target="_blank">Open public</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
