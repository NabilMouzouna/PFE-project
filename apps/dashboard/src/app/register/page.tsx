"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarketingNav } from "@/components/marketing-nav";
import authStyles from "../auth-pages.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { success?: boolean; error?: { code?: string; message?: string } };
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Registration failed.");
        return;
      }
      router.replace("/overview");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={authStyles.wrap}>
      <MarketingNav variant="register" />
      <main className={authStyles.main}>
        <div className={authStyles.card}>
          <h1 className={authStyles.title}>Create operator</h1>
          <p className={authStyles.lead}>
            The <strong>first</strong> account becomes admin for this instance. If an operator already exists,{" "}
            <Link href="/login">sign in</Link> or use the API promote script.
          </p>
          <p className={authStyles.hint}>
            Production: set matching <code>APPBASE_BOOTSTRAP_SECRET</code> on the API and dashboard (or{" "}
            <code>DASHBOARD_BOOTSTRAP_SECRET</code> on the dashboard).
          </p>
          {error && <p className={authStyles.error}>{error}</p>}
          <form onSubmit={(e) => void onSubmit(e)} className={authStyles.stack}>
            <label className={authStyles.label}>
              <span>Email</span>
              <input
                className={authStyles.input}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className={authStyles.label}>
              <span>Password</span>
              <input
                className={authStyles.input}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <button type="submit" className={authStyles.submit} disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className={authStyles.footer}>
            <Link href="/">← Back to home</Link>
            {" · "}
            <Link href="/docs">Documentation</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
