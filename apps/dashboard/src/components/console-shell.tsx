"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./console-shell.module.css";

const nav = [
  { href: "/overview", label: "Overview" },
  { href: "/settings/api-key", label: "API key" },
  { href: "/users", label: "Users" },
  { href: "/storage", label: "Storage" },
  { href: "/audit", label: "Audit log" },
  { href: "/api-reference", label: "API reference" },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/dashboard/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>AppBase</div>
        <nav className={styles.nav} aria-label="Console">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={
                pathname === item.href ||
                (item.href !== "/overview" && pathname.startsWith(item.href))
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.footer}>
          <button type="button" className={styles.logout} onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
