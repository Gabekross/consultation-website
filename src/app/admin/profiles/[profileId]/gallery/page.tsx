"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Item = {
  id: string;
  kind: "image" | "youtube" | "mp4";
  title: string | null;
  image_url: string | null;
  youtube_url: string | null;
  mp4_url: string | null;
  poster_url: string | null;
  order_index: number;
};

const BUCKET = "mc-media";

function toYoutubeEmbed(input: string) {
  const url = input.trim();
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }
    const id = u.searchParams.get("v") ?? "";
    if (id) return `https://www.youtube.com/embed/${id}`;
    if (u.pathname.startsWith("/embed/")) return url;
  } catch {
    if (/^[A-Za-z0-9_-]{8,}$/.test(url)) return `https://www.youtube.com/embed/${url}`;
  }
  return url;
}

export default function GalleryAdminPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;

  const sb = useMemo(() => supabaseBrowser(), []);

  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");

  function ordered(list: Item[]) {
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
      .from("gallery_items")
      .select("id,kind,title,image_url,youtube_url,mp4_url,poster_url,order_index")
      .eq("profile_id", profileId)
      .order("order_index", { ascending: true });

    if (error) return setMsg(error.message);
    setItems((data ?? []) as Item[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function remove(id: string) {
    if (!confirm("Delete this gallery item?")) return;
    const { error } = await sb.from("gallery_items").delete().eq("id", id);
    if (error) return setMsg(error.message);
    await load();
  }

  async function upload(kind: "image" | "mp4", file: File) {
    setMsg(null);

    const folder = kind === "image" ? "gallery" : "videos";
    const ext = file.name.split(".").pop() ?? "bin";
    const key = `${profileId}/${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(key, file, { upsert: true });
    if (upErr) return setMsg(upErr.message);

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(key);
    const url = pub.publicUrl;

    const nextOrder = items.length ? Math.max(...items.map((i) => i.order_index)) + 10 : 10;
    const insert: any = { profile_id: profileId, kind, title: file.name, order_index: nextOrder };
    if (kind === "image") insert.image_url = url;
    if (kind === "mp4") insert.mp4_url = url;

    const { error: insErr } = await sb.from("gallery_items").insert(insert);
    if (insErr) return setMsg(insErr.message);

    setMsg("Uploaded.");
    await load();
  }

  async function addYouTube() {
    setMsg(null);
    const embed = toYoutubeEmbed(ytUrl);
    if (!embed) return setMsg("Paste a YouTube URL (or video ID).");

    const nextOrder = items.length ? Math.max(...items.map((i) => i.order_index)) + 10 : 10;
    const { error } = await sb.from("gallery_items").insert({
      profile_id: profileId,
      kind: "youtube",
      title: ytTitle.trim() || null,
      youtube_url: embed,
      order_index: nextOrder,
    });

    if (error) return setMsg(error.message);

    setYtUrl("");
    setYtTitle("");
    await load();
  }

  // ✅ Reorder helpers (NO UPSERT)
  async function persistOrder(next: Item[]) {
    const withOrder = next.map((it, idx) => ({ ...it, order_index: (idx + 1) * 10 }));

    const results = await Promise.all(
      withOrder.map((it) =>
        sb.from("gallery_items").update({ order_index: it.order_index }).eq("id", it.id)
      )
    );

    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;

    setItems(withOrder);
  }

  async function moveById(id: string, dir: -1 | 1) {
    setMsg(null);

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

  const photos = items.filter((i) => i.kind === "image");
  const videos = items.filter((i) => i.kind !== "image");

  return (
    <section>
      <div className="h2">Gallery</div>
      <p className="p">
        Upload photos, MP4 videos, and add YouTube embeds. (Bucket: <code>{BUCKET}</code>)
      </p>
      {msg ? <p className="p">{msg}</p> : null}

      <div className="grid2" style={{ marginTop: 10 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="kicker">Upload photo</div>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload("image", f);
              e.currentTarget.value = "";
            }}
          />
          <div className="p" style={{ marginTop: 10 }}>Recommended: JPG/PNG, landscape, under 5MB.</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="kicker">Upload MP4 video</div>
          <input
            className="input"
            type="file"
            accept="video/mp4"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload("mp4", f);
              e.currentTarget.value = "";
            }}
          />
          <div className="p" style={{ marginTop: 10 }}>MP4 only (best compatibility). Keep files small for fast loading.</div>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginTop: 14 }}>
        <div className="kicker">Add YouTube</div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field">
            <div className="label">Title (optional)</div>
            <input className="input" value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} />
          </div>
          <div className="field">
            <div className="label">YouTube link (or video id)</div>
            <input className="input" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={addYouTube}>Add</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="kicker">Photos</div>
        <div className="row" style={{ marginTop: 10 }}>
          {photos.length === 0 ? <span className="badge">No photos yet</span> : null}
          {photos.map((it) => (
            <div key={it.id} className="card" style={{ padding: 12, flex: "1 1 340px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{it.title ?? "Photo"}</div>
                  <div className="p" style={{ margin: 0 }}>image</div>
                </div>
                <span className="badge">{it.order_index}</span>
              </div>

              {it.image_url ? (
                <a className="media" href={it.image_url} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image_url} alt={it.title ?? "Photo"} />
                </a>
              ) : null}

              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn secondary" onClick={() => moveById(it.id, -1)}>Up</button>
                <button type="button" className="btn secondary" onClick={() => moveById(it.id, 1)}>Down</button>
                <button type="button" className="btn" onClick={() => remove(it.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="kicker">Videos</div>
        <div className="row" style={{ marginTop: 10 }}>
          {videos.length === 0 ? <span className="badge">No videos yet</span> : null}
          {videos.map((it) => (
            <div key={it.id} className="card" style={{ padding: 12, flex: "1 1 380px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{it.title ?? "Video"}</div>
                  <div className="p" style={{ margin: 0 }}>{it.kind}</div>
                </div>
                <span className="badge">{it.order_index}</span>
              </div>

              {it.kind === "youtube" && it.youtube_url ? (
                <div className="embed" style={{ marginTop: 10 }}>
                  <iframe
                    src={it.youtube_url}
                    title={it.title ?? "YouTube"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}

              {it.kind === "mp4" && it.mp4_url ? (
                <video
                  style={{ marginTop: 10, width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                  controls
                  preload="metadata"
                >
                  <source src={it.mp4_url} type="video/mp4" />
                </video>
              ) : null}

              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn secondary" onClick={() => moveById(it.id, -1)}>Up</button>
                <button type="button" className="btn secondary" onClick={() => moveById(it.id, 1)}>Down</button>
                <button type="button" className="btn" onClick={() => remove(it.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
