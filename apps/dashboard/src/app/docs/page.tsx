import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { isOperatorAuthenticated } from "@/lib/marketing-auth";
import styles from "./docs.module.css";

const sections = [
  {
    id: "introduction",
    title: "Introduction",
    className: styles.s1,
    body: (
      <>
        <p>
          This documentation area is a <strong>placeholder</strong> for AppBase product docs. Final content will cover
          architecture, deployment, and the public BaaS API consumed by the SDK.
        </p>
        <p>
          For the live OpenAPI UI served by your API process, use <strong>API reference</strong> from the operator
          console after sign-in (Swagger at <code>/docs</code> on the API origin).
        </p>
      </>
    ),
  },
  {
    id: "quickstart",
    title: "Quickstart (placeholder)",
    className: styles.s2,
    body: (
      <ul>
        <li>Start the API container or <code>pnpm --filter api dev</code>.</li>
        <li>Create an instance API key in the dashboard: Settings → API key → Generate; copy it for the SDK.</li>
        <li>
          Point the dashboard at <code>API_BASE_URL</code>. Set <code>DASHBOARD_API_KEY</code> to that same key when you
          need Users, Audit, and other BFF-backed admin pages.
        </li>
        <li>Register the first operator from this site or promote an existing user to admin.</li>
      </ul>
    ),
  },
  {
    id: "authentication",
    title: "Authentication (placeholder)",
    className: styles.s3,
    body: (
      <p>
        End-user auth: <code>POST /auth/register</code>, <code>POST /auth/login</code>, refresh and logout. Operator
        console uses admin role and server-side BFF—details TBD in the published guide.
      </p>
    ),
  },
  {
    id: "database",
    title: "Database API (placeholder)",
    className: styles.s4,
    body: (
      <p>
        Collections and records under <code>/db/*</code> with JWT + <code>x-api-key</code>. SSE subscriptions for
        real-time updates—full reference will mirror <code>API-SPEC.md</code>.
      </p>
    ),
  },
  {
    id: "storage",
    title: "Storage API (placeholder)",
    className: styles.s5,
    body: (
      <p>
        Multipart uploads, downloads, and deletes under <code>/storage/*</code>—documented in the OpenAPI bundle on the
        API.
      </p>
    ),
  },
];

export default async function DocsPage() {
  const authenticated = await isOperatorAuthenticated();

  return (
    <div className={styles.page}>
      <MarketingNav authenticated={authenticated} />

      <div className={styles.frame}>
        <aside className={styles.sidebar} aria-label="Documentation sections">
          <div className={styles.sidebarInner}>
            <p className={styles.sidebarKicker}>Contents</p>
            <nav className={styles.sideNav}>
              <ul>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={styles.sidebarFoot}>
              <Link href="/">← Home</Link>
              {authenticated ? (
                <Link href="/overview">Console</Link>
              ) : (
                <Link href="/login">Log in</Link>
              )}
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.hero}>
            <h1>Documentation</h1>
            <p>Guides and API overview for AppBase. Sections below are stubs until the full doc set is published.</p>
            <span className={styles.placeholderPill}>Work in progress</span>
          </header>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className={`${styles.section} ${s.className}`}>
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}

          <div className={styles.cta}>
            <p>Ready to run an instance or open the operator console?</p>
            <div className={styles.ctaLinks}>
              {authenticated ? (
                <Link href="/overview" className={styles.ctaBtnPrimary}>
                  Open console
                </Link>
              ) : (
                <Link href="/register" className={styles.ctaBtnPrimary}>
                  Get started
                </Link>
              )}
              <Link href="/" className={styles.ctaBtnGhost}>
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
