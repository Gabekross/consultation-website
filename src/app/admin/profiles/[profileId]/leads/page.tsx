"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type LeadStatus = "new" | "contacted" | "booked";

type Lead = {
  id: string;
  created_at: string;
  phone: string | null;
  email: string | null;
  form_data: Record<string, any>;
  status: LeadStatus;
  contacted_at: string | null;
  booked_at: string | null;
};

type FormField = {
  label: string;
  field_key: string;
  order_index: number;
};

function formatPhoneForTel(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "");
}

function buildWhatsAppLink(phone: string, message: string) {
  const p = formatPhoneForTel(phone).replace(/^\+/, "");
  return `https://wa.me/${encodeURIComponent(p)}?text=${encodeURIComponent(message)}`;
}

function toDisplay(v: any) {
  if (v === undefined || v === null) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

function csvEscape(value: any) {
  const s = value === null || value === undefined ? "" : String(value);
  // wrap if contains commas/newlines/quotes
  if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export default function LeadsPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const sb = useMemo(() => supabaseBrowser(), []);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | LeadStatus>("all");

  async function load() {
    setMsg(null);
    setLoading(true);

    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) {
      location.href = "/admin/login";
      return;
    }

    // Form fields for nice labeling
    const { data: fData, error: fErr } = await sb
      .from("form_fields")
      .select("label,field_key,order_index")
      .eq("profile_id", profileId)
      .order("order_index", { ascending: true });

    if (fErr) {
      setMsg(fErr.message);
      setLoading(false);
      return;
    }
    setFields((fData ?? []) as FormField[]);

    // Leads
    let q = sb
      .from("leads")
      .select("id,created_at,phone,email,form_data,status,contacted_at,booked_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, filter]);

  function renderRows(lead: Lead) {
    const data = lead.form_data ?? {};

    if (fields.length) {
      return fields.map((f) => ({
        label: f.label || f.field_key,
        key: f.field_key,
        value: toDisplay(data[f.field_key]),
      }));
    }

    return Object.keys(data).map((k) => ({
      label: k,
      key: k,
      value: toDisplay(data[k]),
    }));
  }

  async function setLeadStatus(leadId: string, status: LeadStatus) {
    setMsg(null);

    const patch: Partial<Lead> = { status };

    if (status === "contacted") {
      patch.contacted_at = new Date().toISOString();
      patch.booked_at = null;
    } else if (status === "booked") {
      patch.booked_at = new Date().toISOString();
      if (!patch.contacted_at) patch.contacted_at = new Date().toISOString();
    } else {
      // new
      patch.contacted_at = null;
      patch.booked_at = null;
    }

    // optimistic UI
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, ...(patch as any) } : l)));

    const { error } = await sb.from("leads").update(patch).eq("id", leadId);

    if (error) {
      setMsg(error.message);
      setLeads(prev);
      return;
    }

    setMsg(`Updated lead status: ${status}`);
    window.setTimeout(() => setMsg(null), 1200);
  }

  async function copySummary(lead: Lead) {
    const rows = renderRows(lead);
    const lines = [
      `Lead ${lead.id}`,
      `Status: ${lead.status}`,
      `Created: ${new Date(lead.created_at).toLocaleString()}`,
      lead.phone ? `Phone: ${lead.phone}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      "",
      ...rows.map((r) => `${r.label}: ${r.value}`),
    ].filter(Boolean);

    await navigator.clipboard.writeText(lines.join("\n"));
    setMsg("Copied lead summary to clipboard.");
    window.setTimeout(() => setMsg(null), 1200);
  }

  function exportCsv() {
    const visible = leads;

    // columns: created/status/phone/email + all known fields
    const fieldCols = fields.length ? fields.map((f) => f.field_key) : [];

    const headers = [
      "id",
      "created_at",
      "status",
      "contacted_at",
      "booked_at",
      "phone",
      "email",
      ...fieldCols,
    ];

    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(","));

    for (const l of visible) {
      const row = [
        l.id,
        l.created_at,
        l.status,
        l.contacted_at ?? "",
        l.booked_at ?? "",
        l.phone ?? "",
        l.email ?? "",
        ...fieldCols.map((k) => (l.form_data?.[k] ?? "")),
      ];
      lines.push(row.map(csvEscape).join(","));
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${profileId}-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setMsg("CSV exported.");
    window.setTimeout(() => setMsg(null), 1200);
  }

  function statusBadge(status: LeadStatus) {
    if (status === "new") return <span className="badge">New</span>;
    if (status === "contacted") return <span className="badge">Contacted</span>;
    return <span className="badge">Booked</span>;
  }

  return (
    <section>
      <div className="h2">Leads</div>
      <p className="p">Newest first. Use this as your quote-request inbox.</p>

      <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
        <button className="btn secondary" type="button" onClick={load}>
          Refresh
        </button>

        <span className="badge">Showing up to 200</span>
        {loading ? <span className="badge">Loading…</span> : null}

        <div className="field" style={{ margin: 0 }}>
          <div className="label">Filter</div>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="booked">Booked</option>
          </select>
        </div>

        <button className="btn" type="button" onClick={exportCsv} disabled={!leads.length}>
          Export CSV
        </button>
      </div>

      {msg ? <p className="p">{msg}</p> : null}

      <div className="row">
        {leads.length === 0 ? <span className="badge">No leads yet</span> : null}

        {leads.map((l) => {
          const rows = renderRows(l);
          const waMsg = `Hi! Thanks for reaching out. I received your request and will respond shortly. (Lead: ${l.id})`;

          return (
            <div key={l.id} className="card" style={{ padding: 14, flex: "1 1 520px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{new Date(l.created_at).toLocaleString()}</div>
                <div className="row" style={{ alignItems: "center" }}>
                  {statusBadge(l.status)}
                  <span className="badge">Lead</span>
                </div>
              </div>

              <div className="p" style={{ marginTop: 8, marginBottom: 0 }}>
                {l.phone ? (
                  <>
                    <strong>Phone:</strong> {l.phone}
                    <br />
                  </>
                ) : null}
                {l.email ? (
                  <>
                    <strong>Email:</strong> {l.email}
                    <br />
                  </>
                ) : null}
                {l.contacted_at ? (
                  <>
                    <strong>Contacted:</strong> {new Date(l.contacted_at).toLocaleString()}
                    <br />
                  </>
                ) : null}
                {l.booked_at ? (
                  <>
                    <strong>Booked:</strong> {new Date(l.booked_at).toLocaleString()}
                    <br />
                  </>
                ) : null}
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                {l.phone ? (
                  <a className="btn secondary" href={`tel:${formatPhoneForTel(l.phone)}`}>
                    Call
                  </a>
                ) : null}

                {l.email ? (
                  <a className="btn secondary" href={`mailto:${encodeURIComponent(l.email)}`}>
                    Email
                  </a>
                ) : null}

                {l.phone ? (
                  <a className="btn secondary" href={buildWhatsAppLink(l.phone, waMsg)} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                ) : null}

                <button className="btn secondary" type="button" onClick={() => copySummary(l)}>
                  Copy summary
                </button>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn secondary" type="button" onClick={() => setLeadStatus(l.id, "new")}>
                  Mark new
                </button>
                <button className="btn secondary" type="button" onClick={() => setLeadStatus(l.id, "contacted")}>
                  Mark contacted
                </button>
                <button className="btn secondary" type="button" onClick={() => setLeadStatus(l.id, "booked")}>
                  Mark booked
                </button>
              </div>

              <hr className="hr" />

              {/* Pretty fields */}
              <div style={{ display: "grid", gap: 8 }}>
                {rows.map((r) => (
                  <div key={r.key} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 800, opacity: 0.9 }}>{r.label}</div>
                    <div style={{ color: "var(--muted)", textAlign: "right", maxWidth: 340, overflowWrap: "anywhere" }}>
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>

              <details style={{ marginTop: 12 }}>
                <summary className="badge" style={{ cursor: "pointer" }}>
                  Raw JSON
                </summary>
                <pre style={{ whiteSpace: "pre-wrap", margin: "10px 0 0", color: "var(--muted)" }}>
{JSON.stringify(l.form_data ?? {}, null, 2)}
                </pre>
              </details>
            </div>
          );
        })}
      </div>
    </section>
  );
}
