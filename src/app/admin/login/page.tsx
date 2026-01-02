"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (mode === "signup") {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) return setMsg(error.message);
      return setMsg("Account created. Check email if confirmation is enabled, then sign in.");
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    setMsg("Signed in. Redirecting…");
    setTimeout(() => (location.href = "/admin"), 600);
  }

  return (
    <main className="container">
      <div className="card" style={{ padding: 22, maxWidth: 560, margin: "0 auto" }}>
        <div className="kicker">Admin</div>
        <div className="h1" style={{ fontSize: 34 }}>Sign in</div>
        <p className="p">Phase 1 uses Supabase email/password auth.</p>

        <div className="row" style={{ marginBottom: 10 }}>
          <button className={`btn ${mode === "signin" ? "" : "secondary"}`} type="button" onClick={() => setMode("signin")}>Sign in</button>
          <button className={`btn ${mode === "signup" ? "" : "secondary"}`} type="button" onClick={() => setMode("signup")}>Sign up</button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <div className="label">Email</div>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" required />
          </div>
          <div className="field">
            <div className="label">Password</div>
            <input className="input" value={password} onChange={e => setPassword(e.target.value)} type="password" required />
          </div>
          <button className="btn" type="submit">{mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>

        {msg ? <p className="p" style={{ marginTop: 12 }}>{msg}</p> : null}

        <hr className="hr" />
        <a className="btn secondary" href="/">Back to home</a>
      </div>
    </main>
  );
}
