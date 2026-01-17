"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Review = {
  id: string;
  type: "image" | "text";
  image_url: string | null;
  source: string | null;
  name: string | null;
  rating: number | null;
  event: string | null;
  quote: string | null;
  order_index: number;
};

const BUCKET = "mc-media";

export default function ReviewsAdminPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const sb = useMemo(() => supabaseBrowser(), []);

  const [items, setItems] = useState<Review[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Text review inputs
  const [name, setName] = useState("");
  const [event, setEvent] = useState("");
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState("");

  function ordered(list: Review[]) {
    return [...list].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  async function load() {
    setMsg(null);
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) {
      location.href = "/admin/login";
      return;
    }

    const { data, error } = await sb
      .from("reviews")
      .select("id,type,image_url,source,name,rating,event,quote,order_index")
      .eq("profile_id", profileId)
      .order("order_index", { ascending: true });

    if (error) return setMsg(error.message);
    setItems((data ?? []) as Review[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    const { error } = await sb.from("reviews").delete().eq("id", id);
    if (error) return setMsg(error.message);
    await load();
  }

  // ✅ Reorder helpers (NO UPSERT)
  async function persistOrder(next: Review[]) {
    const withOrder = next.map((it, idx) => ({ ...it, order_index: (idx + 1) * 10 }));

    const results = await Promise.all(
      withOrder.map((it) => sb.from("reviews").update({ order_index: it.order_index }).eq("id", it.id))
    );

    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;

    setItems(withOrder);
  }

  async function moveById(id: string, dir: -1 | 1) {
    setMsg(null);

    // Always reorder based on the visible order (order_index)
    const ord = ordered(items);
    const idx = ord.findIndex((i) => i.id === id);
    const target = idx + dir;

    if (idx < 0) return;
    if (target < 0 || target >= ord.length) return;

    const prev = items;

    const next = [...ord];
    const [picked] = next.splice(idx, 1);
    next.splice(target, 0, picked);

    // optimistic UI
    setItems(next);

    try {
      await persistOrder(next);
      setMsg("Reordered.");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to reorder");
      setItems(prev);
    }
  }

  async function uploadScreenshot(file: File) {
    setMsg(null);

    const ext = file.name.split(".").pop() ?? "png";
    const key = `${profileId}/reviews/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, { upsert: true });
    if (upErr) return setMsg(upErr.message);

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(key);
    const url = pub.publicUrl;

    const nextOrder = items.length ? Math.max(...items.map((i) => i.order_index)) + 10 : 10;

    const { error: insErr } = await sb.from("reviews").insert({
      profile_id: profileId,
      type: "image",
      image_url: url,
      source: "Screenshot",
      order_index: nextOrder,
    });

    if (insErr) return setMsg(insErr.message);

    setMsg("Screenshot added.");
    await load();
  }

  async function addTextReview() {
    setMsg(null);
    if (!quote.trim()) return setMsg("Quote is required.");

    const nextOrder = items.length ? Math.max(...items.map((i) => i.order_index)) + 10 : 10;

    const { error } = await sb.from("reviews").insert({
      profile_id: profileId,
      type: "text",
      name: name.trim() || null,
      event: event.trim() || null,
      rating,
      quote: quote.trim(),
      order_index: nextOrder,
    });

    if (error) return setMsg(error.message);

    setName("");
    setEvent("");
    setRating(5);
    setQuote("");
    setMsg("Text review added.");
    await load();
  }

  const imageReviews = items.filter((i) => i.type === "image");
  const textReviews = items.filter((i) => i.type === "text");

  return (
    <section>
      <div className="h2">Reviews</div>
      <p className="p">Top section: screenshots. Bottom section: text reviews.</p>
      {msg ? <p className="p">{msg}</p> : null}

      <div className="grid2" style={{ marginTop: 10 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="kicker">Upload screenshot</div>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadScreenshot(f);
              e.currentTarget.value = "";
            }}
          />
          <div className="p" style={{ marginTop: 10 }}>
            Use WhatsApp/iMessage screenshots or event flyers with review quotes.
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="kicker">Add text review</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div className="field">
              <div className="label">Name</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <div className="label">Event</div>
              <input
                className="input"
                placeholder="Wedding, Birthday..."
                value={event}
                onChange={(e) => setEvent(e.target.value)}
              />
            </div>
            <div className="field">
              <div className="label">Rating</div>
              <select className="select" value={String(rating)} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="label">Quote</div>
              <textarea className="textarea" value={quote} onChange={(e) => setQuote(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={addTextReview}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="kicker">Screenshot reviews</div>
        <div className="row" style={{ marginTop: 10 }}>
          {imageReviews.length === 0 ? <span className="badge">No screenshot reviews yet</span> : null}
          {imageReviews.map((r) => (
            <div key={r.id} className="card" style={{ padding: 12, flex: "1 1 360px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge">image</span>
                <span className="badge">{r.order_index}</span>
              </div>
              {r.image_url ? (
                <a className="media" href={r.image_url} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image_url} alt={r.source ?? "Review"} />
                </a>
              ) : null}
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn secondary" onClick={() => moveById(r.id, -1)}>
                  Up
                </button>
                <button type="button" className="btn secondary" onClick={() => moveById(r.id, 1)}>
                  Down
                </button>
                <button type="button" className="btn" onClick={() => remove(r.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="kicker">Text reviews</div>
        <div className="row" style={{ marginTop: 10 }}>
          {textReviews.length === 0 ? <span className="badge">No text reviews yet</span> : null}
          {textReviews.map((r) => (
            <div key={r.id} className="card" style={{ padding: 12, flex: "1 1 360px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge">{"★".repeat(Math.max(1, Math.min(5, r.rating ?? 5)))}</span>
                <span className="badge">{r.order_index}</span>
              </div>
              <p className="p" style={{ marginTop: 10 }}>
                “{r.quote ?? ""}”
              </p>
              <div className="p" style={{ marginTop: 6, marginBottom: 0 }}>
                <strong>{r.name ?? ""}</strong>
                {r.event ? ` • ${r.event}` : ""}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn secondary" onClick={() => moveById(r.id, -1)}>
                  Up
                </button>
                <button type="button" className="btn secondary" onClick={() => moveById(r.id, 1)}>
                  Down
                </button>
                <button type="button" className="btn" onClick={() => remove(r.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
