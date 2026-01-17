"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Lead = {
  id: string;
  created_at: string;
  phone: string | null;
  email: string | null;
  form_data: any;
};

export default function LeadsPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const sb = useMemo(() => supabaseBrowser(), []);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) {
      location.href = "/admin/login";
      return;
    }
    const { data, error } = await sb
      .from("leads")
      .select("id,created_at,phone,email,form_data")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return setMsg(error.message);
    setLeads((data ?? []) as any);
  }

  useEffect(() => { load(); }, []);

  return (
    <section>
      <div className="h2">Leads</div>
      <p className="p">Newest first. Use this as your quote-request inbox.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn secondary" onClick={load}>Refresh</button>
        <span className="badge">Showing up to 100</span>
      </div>
      {msg ? <p className="p">{msg}</p> : null}

      <div className="row">
        {leads.length === 0 ? <span className="badge">No leads yet</span> : null}
        {leads.map((l) => (
          <div key={l.id} className="card" style={{ padding: 14, flex: "1 1 420px" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{new Date(l.created_at).toLocaleString()}</div>
              <span className="badge">Lead</span>
            </div>
            <div className="p" style={{ marginTop: 8, marginBottom: 0 }}>
              {l.phone ? <><strong>Phone:</strong> {l.phone}<br /></> : null}
              {l.email ? <><strong>Email:</strong> {l.email}<br /></> : null}
            </div>
            <hr className="hr" />
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "var(--muted)" }}>
{JSON.stringify(l.form_data ?? {}, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}
