import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TenantPageProps = { params: { slug: string } };

export default async function TenantPage({ params }: TenantPageProps) {
  noStore();

  const slug = params.slug;
  const sb = supabaseAdmin();

  // Fetch profile
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (profileErr) return notFound();
  if (!profile) return notFound();
  if (profile.status !== "active") return notFound();

  // Fetch profile content
  const [{ data: fields }, { data: gallery }, { data: reviews }] = await Promise.all([
    sb
      .from("form_fields")
      .select("*")
      .eq("profile_id", profile.id)
      .order("order_index", { ascending: true }),
    sb
      .from("gallery_items")
      .select("*")
      .eq("profile_id", profile.id)
      .order("order_index", { ascending: true }),
    sb
      .from("reviews")
      .select("*")
      .eq("profile_id", profile.id)
      .order("order_index", { ascending: true }),
  ]);

  const formFields = (fields ?? []) as any[];
  const galleryItems = (gallery ?? []) as any[];
  const reviewItems = (reviews ?? []) as any[];

  const imageReviews = reviewItems.filter((r) => r.type === "image");
  const textReviews = reviewItems.filter((r) => r.type === "text");
  const photoItems = galleryItems.filter((g) => g.kind === "image");
  const videoItems = galleryItems.filter((g) => g.kind !== "image");

  return (
    <main
      data-theme={profile.theme ?? "dark"}
      className="pageRoot"
      style={{ ["--accent" as any]: profile.accent_color ?? "var(--accent)" }}
    >
      <header className="container" style={{ paddingBottom: 10 }}>
        <div className="badge">
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--accent)" }} />
          <span>{profile.display_name}</span>
        </div>

        <div className="h1" style={{ marginTop: 14 }}>
          {profile.hero_headline ?? "A polished MC experience for your next event."}
        </div>

        <p className="p" style={{ maxWidth: 760 }}>
          {profile.hero_subtext ??
            "Professional hosting, crowd control, and unforgettable energy—built for weddings, birthdays, corporate events, and cultural celebrations."}
        </p>

        <div className="row" style={{ marginTop: 14 }}>
          <a className="btn" href="#form">
            Request a Quote
          </a>

          {profile.whatsapp_number ? (
            <a
              className="btn secondary"
              href={`/api/whatsapp?slug=${encodeURIComponent(slug)}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          ) : null}
        </div>
      </header>

      <section className="container">
        <div className="grid2">
          {/* Gallery */}
          <div className="card" style={{ padding: 18 }}>
            <div className="kicker">Gallery</div>
            <div className="h2">Photos & Videos</div>
            <p className="p">Photos and videos from past events. Videos support YouTube embeds and MP4 uploads.</p>

            <div className="tabs" style={{ marginTop: 10 }}>
              <a className="tab" href="#photos">
                Photos
              </a>
              <a className="tab" href="#videos">
                Videos
              </a>
            </div>

            <div id="photos" className="row" style={{ marginTop: 10 }}>
              {photoItems.length === 0 ? (
                <span className="badge">No photos yet</span>
              ) : (
                photoItems.map((it) => (
                  <a key={it.id} className="media" href={it.image_url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image_url} alt={it.title ?? "Photo"} />
                  </a>
                ))
              )}
            </div>

            <div id="videos" className="row" style={{ marginTop: 10 }}>
              {videoItems.length === 0 ? (
                <span className="badge">No videos yet</span>
              ) : (
                videoItems.map((it) => (
                  <div key={it.id} className="card" style={{ padding: 12, flex: "1 1 320px" }}>
                    <div className="badge">{String(it.kind ?? "").toUpperCase()}</div>

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
                        style={{
                          marginTop: 10,
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                        }}
                        controls
                        preload="metadata"
                        poster={it.poster_url ?? undefined}
                      >
                        <source src={it.mp4_url} type="video/mp4" />
                      </video>
                    ) : null}

                    <div className="p" style={{ marginTop: 8, marginBottom: 0 }}>
                      {it.title ?? ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reviews */}
          <div className="card" style={{ padding: 18 }}>
            <div className="kicker">Reviews</div>
            <div className="h2">What clients say</div>
            <p className="p">Top: screenshot reviews. Bottom: text reviews.</p>
            <hr className="hr" />

            <div className="row">
              {imageReviews.length === 0 ? <span className="badge">No screenshot reviews yet</span> : null}
              {imageReviews.map((r) => (
                <a key={r.id} className="media" href={r.image_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image_url} alt={r.source ?? "Review"} />
                </a>
              ))}
            </div>

            {textReviews.length ? <hr className="hr" /> : null}

            <div className="row">
              {textReviews.map((r) => (
                <div key={r.id} className="card" style={{ padding: 14, flex: "1 1 260px" }}>
                  <div className="badge">{"★".repeat(Math.max(1, Math.min(5, r.rating ?? 5)))}</div>
                  <p className="p" style={{ marginTop: 8 }}>
                    “{r.quote ?? ""}”
                  </p>
                  <div className="p" style={{ marginTop: 8, opacity: 0.9 }}>
                    <strong>{r.name ?? ""}</strong>
                    {r.event ? ` • ${r.event}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="container" style={{ paddingTop: 8 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="kicker">Packages</div>
          <div className="h2">Request-Quote Packages</div>
          <p className="p">Choose a starting point. Final quote is based on event details, timeline, and travel.</p>

          <div className="row" style={{ marginTop: 10 }}>
            {[
              {
                name: "Starter",
                desc: "Clean hosting for intimate events.",
                feats: ["Timeline management", "Announcements", "Vendor coordination"],
              },
              {
                name: "Standard",
                desc: "Most popular for weddings & birthdays.",
                feats: ["Crowd engagement", "Interactive games", "Professional transitions"],
                popular: true,
              },
              {
                name: "Premium",
                desc: "Full experience with high energy.",
                feats: ["Custom segments", "Stage presence", "VIP flow support"],
              },
            ].map((p) => (
              <div
                key={p.name}
                className="card"
                style={{
                  padding: 14,
                  flex: "1 1 260px",
                  borderColor: p.popular ? "var(--accent)" : undefined,
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 900 }}>{p.name}</div>
                  {p.popular ? <span className="badge">Most Popular</span> : null}
                </div>

                <p className="p" style={{ marginTop: 8 }}>
                  {p.desc}
                </p>

                <ul className="list">
                  {p.feats.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>

                <a className="btn" href="#form" style={{ marginTop: 10 }}>
                  Request quote
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="form" className="container" style={{ paddingTop: 8, paddingBottom: 60 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="kicker">Request a quote</div>
          <div className="h2">Tell us about your event</div>
          <p className="p">This form is customized per profile.</p>

          <form action="/api/leads" method="post">
            <input type="hidden" name="profile_slug" value={slug} />

            <div className="grid2" style={{ marginTop: 10 }}>
              {(formFields.length
                ? formFields
                : [
                    { label: "Full name", field_key: "full_name", type: "text", required: true },
                    { label: "Phone", field_key: "phone", type: "phone", required: false },
                    { label: "Email", field_key: "email", type: "email", required: false },
                    { label: "Event date", field_key: "event_date", type: "date", required: false },
                  ]
              ).map((f) => (
                <div
                  key={f.field_key}
                  className="field"
                  style={{ gridColumn: f.type === "textarea" ? "1 / -1" : undefined }}
                >
                  <div className="label">
                    {f.label}
                    {f.required ? " *" : ""}
                  </div>

                  {f.type === "select" ? (
                    <select className="select" name={f.field_key} required={Boolean(f.required)} defaultValue="">
                      <option value="">Select…</option>
                      {(f.options ?? []).map((o: string) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea className="textarea" name={f.field_key} required={Boolean(f.required)} />
                  ) : (
                    <input
                      className="input"
                      name={f.field_key}
                      type={f.type === "phone" ? "tel" : f.type}
                      required={Boolean(f.required)}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
              <button className="btn" type="submit">
                Submit
              </button>
              <span className="badge">You’ll be redirected to a confirmation page.</span>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
