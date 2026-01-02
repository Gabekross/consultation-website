import Link from "next/link";

export default function ThankYou({ searchParams }: { searchParams: { slug?: string } }) {
  const slug = searchParams.slug ?? "";
  return (
    <main className="container">
      <div className="card" style={{ padding: 22 }}>
        <div className="kicker">Submitted</div>
        <div className="h1" style={{ fontSize: 38 }}>Thank you!</div>
        <p className="p">Your request has been received. If you’d like, you can also message on WhatsApp for faster response.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn" href={slug ? `/${slug}` : "/"}>Back to site</Link>
          {slug ? <a className="btn secondary" href={`/api/whatsapp?slug=${encodeURIComponent(slug)}`} target="_blank">WhatsApp</a> : null}
        </div>
      </div>
    </main>
  );
}
