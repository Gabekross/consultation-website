export default function Home() {
  return (
    <main className="container">
      <div className="card" style={{ padding: 22 }}>
        <div className="kicker">Platform</div>
        <div className="h1">MC Booking Platform</div>
        <p className="p">
          This app serves branded booking funnels at <b>/{`{slug}`}</b>. Profiles can be self-serve and go live after approval.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn" href="/admin/login">Go to Admin</a>
          <a className="btn secondary" href="/mc-finest">View Demo: MC Finest</a>
          <a className="btn secondary" href="/mc-haywai">View Demo: MC Haywai</a>
        </div>
      </div>
    </main>
  );
}
