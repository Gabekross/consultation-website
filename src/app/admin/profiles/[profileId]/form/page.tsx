"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type FieldType = "text" | "email" | "phone" | "date" | "select" | "textarea";

type FormField = {
  id: string;
  profile_id: string;
  label: string;
  field_key: string;
  type: FieldType;
  required: boolean;
  options: string[];
  order_index: number;
};

const LOCKED_KEYS = new Set(["email", "phone", "whatsapp", "request_type"]);

function slugifyKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function FormBuilderPage({ params }: { params: { profileId: string } }) {
  const profileId = params.profileId;

  // ✅ Use your existing browser client helper (keeps auth session consistent)
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Field state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");

  async function loadFields() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("form_fields")
      .select("*")
      .eq("profile_id", profileId)
      .order("order_index", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setFields((data ?? []) as FormField[]);
    setLoading(false);
  }

  useEffect(() => {
    loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  function setSaving(text: string) {
    setSavingMsg(text);
    window.clearTimeout((setSaving as any)._t);
    (setSaving as any)._t = window.setTimeout(() => setSavingMsg(null), 1200);
  }

  async function updateField(id: string, patch: Partial<FormField>) {
    setErrorMsg(null);
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

    const { error } = await supabase.from("form_fields").update(patch).eq("id", id);
    if (error) {
      setErrorMsg(error.message);
      await loadFields();
      return;
    }
    setSaving("Saved");
  }

  async function addField() {
    setErrorMsg(null);

    const label = newLabel.trim();
    if (!label) return;

    const baseKey = slugifyKey(label);
    const usedKeys = new Set(fields.map((f) => f.field_key));

    let field_key = baseKey || "field";
    let n = 2;
    while (usedKeys.has(field_key)) {
      field_key = `${baseKey}_${n++}`;
    }

    const optionsArr =
      newType === "select"
        ? newOptions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const nextOrder = fields.length ? fields[fields.length - 1].order_index + 10 : 10;

    const { data, error } = await supabase
      .from("form_fields")
      .insert([
        {
          profile_id: profileId,
          label,
          field_key,
          type: newType,
          required: newRequired,
          options: optionsArr,
          order_index: nextOrder,
        },
      ])
      .select("*")
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setFields((prev) => [...prev, data as FormField]);
    setNewLabel("");
    setNewType("text");
    setNewRequired(false);
    setNewOptions("");
    setSaving("Field added");
  }

  async function deleteField(field: FormField) {
    if (LOCKED_KEYS.has(field.field_key)) return;

    setErrorMsg(null);
    const prev = fields;
    setFields((f) => f.filter((x) => x.id !== field.id));

    const { error } = await supabase.from("form_fields").delete().eq("id", field.id);
    if (error) {
      setErrorMsg(error.message);
      setFields(prev);
      return;
    }
    setSaving("Deleted");
  }

  // ✅ IMPORTANT: Reorder must NOT use upsert (upsert can hit INSERT RLS path)
  async function persistOrder(next: FormField[]) {
    // Use clean sequential order_index to avoid duplicates / instability
    const withOrder = next.map((f, idx) => ({ ...f, order_index: (idx + 1) * 10 }));

    // Batch update each row (UPDATE only)
    const results = await Promise.all(
      withOrder.map((f) =>
        supabase.from("form_fields").update({ order_index: f.order_index }).eq("id", f.id)
      )
    );

    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;

    // Update local state so UI reflects persisted order_index
    setFields(withOrder);
  }

  async function moveField(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;

    const prev = fields;
    const next = [...fields];
    const [picked] = next.splice(index, 1);
    next.splice(target, 0, picked);

    // optimistic UI
    setFields(next);

    try {
      await persistOrder(next);
      setSaving("Reordered");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to reorder");
      setFields(prev); // rollback
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading form fields…</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Form Builder</h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Build the form your clients will fill out. Add, remove, or reorder fields below.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          {savingMsg && <div style={{ fontSize: 12, opacity: 0.9 }}>{savingMsg}</div>}
          {errorMsg && <div style={{ fontSize: 12, color: "tomato" }}>{errorMsg}</div>}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 18,
        }}
      >
        {/* LEFT: BUILDER */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Fields</h2>

          {/* Add Field */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 160px 120px",
              gap: 10,
              alignItems: "end",
              padding: 12,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              marginBottom: 14,
            }}
          >
            <div>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Label</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Event Date"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
                Tip: Keep labels short. Keys are generated automatically.
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} style={inputStyle}>
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="date">Date</option>
                <option value="textarea">Textarea</option>
                <option value="select">Select</option>
              </select>

              {newType === "select" && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Options (comma-separated)</label>
                  <input
                    value={newOptions}
                    onChange={(e) => setNewOptions(e.target.value)}
                    placeholder="Wedding, Birthday, Corporate"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Required</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
                <button type="button" onClick={addField} style={primaryBtn}>
                  Add field
                </button>
              </div>
            </div>
          </div>

          {/* Field rows */}
          <div style={{ display: "grid", gap: 10 }}>
            {fields.map((f, i) => {
              const locked = LOCKED_KEYS.has(f.field_key);

              return (
                <div
                  key={f.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 12,
                    background: "rgba(0,0,0,0.15)",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 170px 120px 120px", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <label style={{ fontSize: 12, opacity: 0.8 }}>Label</label>
                        <span style={{ fontSize: 11, opacity: 0.65 }}>
                          key: <code style={{ opacity: 0.9 }}>{f.field_key}</code>
                        </span>
                      </div>
                      <input
                        value={f.label}
                        onChange={(e) => updateField(f.id, { label: e.target.value })}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, opacity: 0.8 }}>Type</label>
                      <select
                        value={f.type}
                        onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}
                        style={inputStyle}
                        disabled={locked && (f.field_key === "email" || f.field_key === "phone")}
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="date">Date</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                      </select>

                      {f.type === "select" && (
                        <div style={{ marginTop: 10 }}>
                          <label style={{ fontSize: 12, opacity: 0.8 }}>Options</label>
                          <input
                            value={(f.options ?? []).join(", ")}
                            onChange={(e) =>
                              updateField(f.id, {
                                options: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="A, B, C"
                            style={inputStyle}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, opacity: 0.8 }}>Required</label>
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) => updateField(f.id, { required: e.target.checked })}
                          disabled={f.field_key === "email"}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, opacity: 0.8 }}>Actions</label>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => moveField(i, -1)}
                          style={ghostBtn}
                          disabled={i === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(i, 1)}
                          style={ghostBtn}
                          disabled={i === fields.length - 1}
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteField(f)}
                          style={{ ...dangerBtn, opacity: locked ? 0.4 : 1 }}
                          disabled={locked}
                          title={locked ? "Default fields cannot be deleted" : "Delete field"}
                        >
                          Delete
                        </button>
                      </div>

                      {locked && (
                        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>
                          Default field (protected)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 16,
            position: "sticky",
            top: 18,
            height: "fit-content",
          }}
        >
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Client Preview</h2>
          <p style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            This is what visitors will see on your public page.
          </p>

          <PreviewForm fields={fields} />
        </div>
      </div>
    </div>
  );
}

function PreviewForm({ fields }: { fields: FormField[] }) {
  return (
    <form style={{ display: "grid", gap: 10 }}>
      {fields
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((f) => {
          const req = f.required ? " *" : "";
          if (f.type === "textarea") {
            return (
              <div key={f.id}>
                <label style={labelStyle}>
                  {f.label}
                  {req}
                </label>
                <textarea style={{ ...inputStyle, minHeight: 90 }} placeholder={`Enter ${f.label.toLowerCase()}...`} />
              </div>
            );
          }
          if (f.type === "select") {
            return (
              <div key={f.id}>
                <label style={labelStyle}>
                  {f.label}
                  {req}
                </label>
                <select style={inputStyle} defaultValue="">
                  <option value="">Select…</option>
                  {(f.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          const inputType = f.type === "phone" ? "tel" : f.type;
          return (
            <div key={f.id}>
              <label style={labelStyle}>
                {f.label}
                {req}
              </label>
              <input style={inputStyle} type={inputType} placeholder={`Enter ${f.label.toLowerCase()}...`} />
            </div>
          );
        })}

      <button type="button" style={primaryBtn}>
        Submit
      </button>

      <div style={{ fontSize: 11, opacity: 0.65 }}>Preview only — submissions happen on the public page.</div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "var(--accent, #27c26a)",
  color: "#0b0f0c",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,80,80,0.12)",
  color: "white",
  cursor: "pointer",
};
