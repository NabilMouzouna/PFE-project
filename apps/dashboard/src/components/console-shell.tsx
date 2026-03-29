"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Database,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./console-shell.module.css";

const STORAGE_KEY = "appbase-console-sidebar";
const MOBILE_BP = 880;

const nav: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/overview", label: "Overview", Icon: LayoutDashboard },
  { href: "/database", label: "Database", Icon: Database },
  { href: "/settings/api-key", label: "API key", Icon: KeyRound },
  { href: "/users", label: "Users", Icon: Users },
  { href: "/storage", label: "Storage", Icon: HardDrive },
  { href: "/audit", label: "Audit log", Icon: ScrollText },
  { href: "/api-reference", label: "API reference", Icon: BookOpen },
];

function navActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/overview" && href !== "/database" && pathname.startsWith(href)) return true;
  if (href === "/database" && pathname.startsWith("/database")) return true;
  return false;
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const effectiveCollapsed = collapsed && !isMobile;

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "collapsed") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/dashboard/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  return (
    <div className={styles.shell}>
      {isMobile && mobileOpen && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`${styles.sidebar} ${effectiveCollapsed ? styles.sidebarCollapsed : ""} ${isMobile && mobileOpen ? styles.sidebarMobileOpen : ""}`}
        aria-label={isMobile ? "Main navigation" : undefined}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brandRow}>
            {effectiveCollapsed ? (
              <span className={styles.brandMark} title="AppBase">
                AB
              </span>
            ) : (
              <span className={styles.brand}>AppBase</span>
            )}
          </div>
          {!isMobile && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!effectiveCollapsed}
              aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {effectiveCollapsed ? (
                <ChevronsRight className={styles.iconBtnGlyph} strokeWidth={1.85} aria-hidden />
              ) : (
                <ChevronsLeft className={styles.iconBtnGlyph} strokeWidth={1.85} aria-hidden />
              )}
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className={styles.iconBtnGlyph} strokeWidth={1.85} aria-hidden />
            </button>
          )}
        </div>

        <nav className={styles.nav} aria-label="Console">
          {nav.map((item) => {
            const Icon = item.Icon;
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={effectiveCollapsed ? item.label : undefined}
                title={effectiveCollapsed ? item.label : undefined}
              >
                <Icon className={styles.navIcon} size={20} strokeWidth={1.75} aria-hidden />
                {!effectiveCollapsed && <span className={styles.navText}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.logout} ${effectiveCollapsed ? styles.logoutIconOnly : ""}`}
            onClick={() => void logout()}
            aria-label="Sign out"
            title={effectiveCollapsed ? "Sign out" : undefined}
          >
            <LogOut className={styles.logoutIcon} size={20} strokeWidth={1.75} aria-hidden />
            {!effectiveCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className={styles.menuBtnIcon} strokeWidth={1.85} aria-hidden size={22} />
          </button>
          <span className={styles.topBarTitle}>AppBase</span>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
