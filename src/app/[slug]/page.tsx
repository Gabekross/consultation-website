import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export default async function TenantPage({ params }: { params: { slug: string } }) {
  
  const slug = params.slug;
  const sb = supabaseAdmin();
  noStore();


  const { data: profile } = await sb.from("profiles").select("*").eq("slug", slug).maybeSingle();
  if (!profile) return notFound();
  if (profile.status !== "active") return notFound();

  return (
    <main>
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
          <a className="btn" href="#form">Request a Quote</a>
          {profile.whatsapp_number ? (
            <a className="btn secondary" href={`/api/whatsapp?slug=${encodeURIComponent(slug)}`} target="_blank">
              WhatsApp
            </a>
          ) : null}
        </div>
      </header>

      <section className="container">
        <div className="grid2">
          <div className="card" style={{ padding: 18 }}>
            <div className="kicker">Gallery</div>
            <div className="h2">Photos & Videos</div>
            <p className="p">Phase 1 ships with placeholders. Phase 2 adds per-profile uploads + YouTube + MP4 management.</p>
            <div className="row" style={{ marginTop: 8 }}>
              <div className="card" style={{ padding: 14, flex: "1 1 220px" }}>
                <div className="badge">Photo</div>
                <p className="p" style={{ marginTop: 8 }}>Placeholder tile</p>
              </div>
              <div className="card" style={{ padding: 14, flex: "1 1 220px" }}>
                <div className="badge">YouTube</div>
                <p className="p" style={{ marginTop: 8 }}>Placeholder tile</p>
              </div>
              <div className="card" style={{ padding: 14, flex: "1 1 220px" }}>
                <div className="badge">MP4</div>
                <p className="p" style={{ marginTop: 8 }}>Placeholder tile</p>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="kicker">Reviews</div>
            <div className="h2">What clients say</div>
            <p className="p">
              Phase 1 ships with demo reviews. Phase 2 adds screenshot reviews on top and text reviews below (per profile).
            </p>
            <hr className="hr" />
            <div className="row">
              <div className="card" style={{ padding: 14, flex: "1 1 260px" }}>
                <div className="badge">★★★★★</div>
                <p className="p" style={{ marginTop: 8 }}>
                  “Professional from start to finish. The energy was perfect.”
                </p>
              </div>
              <div className="card" style={{ padding: 14, flex: "1 1 260px" }}>
                <div className="badge">★★★★★</div>
                <p className="p" style={{ marginTop: 8 }}>
                  “Kept the program moving and the crowd engaged all night.”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="form" className="container" style={{ paddingTop: 8, paddingBottom: 60 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="kicker">Request a quote</div>
          <div className="h2">Tell us about your event</div>
          <p className="p">Phase 1: basic lead form. Phase 2: dynamic form builder per profile.</p>

          <form action="/api/leads" method="post">
            <input type="hidden" name="profile_slug" value={slug} />
            <div className="grid2" style={{ marginTop: 10 }}>
              <div className="field">
                <div className="label">Full name</div>
                <input className="input" name="full_name" required />
              </div>
              <div className="field">
                <div className="label">Phone</div>
                <input className="input" name="phone" />
              </div>
              <div className="field">
                <div className="label">Email</div>
                <input className="input" type="email" name="email" />
              </div>
              <div className="field">
                <div className="label">Event date</div>
                <input className="input" type="date" name="event_date" />
              </div>
              <div className="field">
                <div className="label">Location</div>
                <input className="input" name="event_location" />
              </div>
              <div className="field">
                <div className="label">Budget range</div>
                <select className="select" name="budget_range" defaultValue="">
                  <option value="">Select…</option>
                  <option value="$500-$1,000">$500–$1,000</option>
                  <option value="$1,000-$2,000">$1,000–$2,000</option>
                  <option value="$2,000-$3,000">$2,000–$3,000</option>
                  <option value="$3,000+">$3,000+</option>
                </select>
              </div>
            </div>
            <div className="field">
              <div className="label">Message</div>
              <textarea className="textarea" name="message" placeholder="Share event type, timeline, special requests…" />
            </div>
            <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
              <button className="btn" type="submit">Submit</button>
              <span className="badge">Redirects to thank-you page.</span>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
