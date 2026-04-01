import Link from "next/link";
import { LandingFeatureGrid } from "@/components/landing-feature-grid";
import { LandingServiceShowcase } from "@/components/landing-service-showcase";
import { MarketingNav } from "@/components/marketing-nav";
import { isOperatorAuthenticated } from "@/lib/marketing-auth";
import styles from "./landing.module.css";

export default async function LandingPage() {
  const authenticated = await isOperatorAuthenticated();

  return (
    <div className={styles.page}>
      <MarketingNav authenticated={authenticated} />

      <section className={styles.hero}>
        <span className={`${styles.badge} ${styles.fadeRise}`}>Backend as a Service</span>
        <h1 className={`${styles.headline} ${styles.fadeRise} ${styles.d1}`}>AppBase</h1>
        <p className={`${styles.subtitle} ${styles.fadeRise} ${styles.d2}`}>
          Build production apps without mandatory cloud dependency.{" "}
          <span className={styles.highlightLine}>
            <span className={styles.highlight}>Auth, database, storage, and real-time events</span>
            <span className={styles.betaTag} title="APIs and UX may change">
              Beta
            </span>
          </span>{" "}
          running on your network.
        </p>
        <div className={`${styles.heroActions} ${styles.fadeRise} ${styles.d3}`}>
          {authenticated ? (
            <Link href="/overview" className={styles.btnPrimary}>
              Open console
            </Link>
          ) : (
            <Link href="/register" className={styles.btnPrimary}>
              Get started
            </Link>
          )}
          <Link href="/docs" className={styles.btnGhost}>
            Read docs
          </Link>
        </div>
      </section>

      <LandingFeatureGrid />

      <LandingServiceShowcase />

      <div className={`${styles.ctaBand} ${styles.fadeRiseDelayed} ${styles.d8}`}>
        <div className={styles.ctaInner}>
          <div className={styles.ctaText}>
            <strong>Start building in under a minute</strong>
            <span>Create the first operator, then manage keys, users, and audit from the console.</span>
          </div>
          {authenticated ? (
            <Link href="/overview" className={styles.btnPrimary}>
              Open console
            </Link>
          ) : (
            <Link href="/register" className={styles.btnPrimary}>
              Get started
            </Link>
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <h2>Ready to run?</h2>
            <p>Start the API, register your operator, point the dashboard at your instance.</p>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/docs">Documentation</Link>
            {authenticated ? (
              <Link href="/overview">Console</Link>
            ) : (
              <>
                <Link href="/login">Sign in</Link>
                <Link href="/register">Create account</Link>
              </>
            )}
          </div>
        </div>
      </footer>

      <p className={styles.meta}>AppBase · self-hosted backend</p>
    </div>
  );
}
