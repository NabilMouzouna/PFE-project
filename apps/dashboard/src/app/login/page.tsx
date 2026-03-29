"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarketingNav } from "@/components/marketing-nav";
import authStyles from "../auth-pages.module.css";

export default function LoginPage() {
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
      const res = await fetch("/api/dashboard/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Sign-in failed.");
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
      <MarketingNav variant="login" />
      <main className={authStyles.main}>
        <div className={authStyles.card}>
          <h1 className={authStyles.title}>Operator sign-in</h1>
          <p className={authStyles.lead}>
            Admin role required. New instance? <Link href="/register">Create the first operator</Link>.
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" className={authStyles.submit} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
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
