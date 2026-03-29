import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
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
        <li>Create an instance API key (script or admin flow).</li>
        <li>Point the dashboard at <code>API_BASE_URL</code> and set <code>DASHBOARD_API_KEY</code>.</li>
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

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <MarketingNav />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>Documentation</h1>
          <p>Guides and API overview for AppBase. Sections below are stubs until the full doc set is published.</p>
          <span className={styles.placeholderPill}>Work in progress</span>
        </header>

        <nav className={styles.toc} aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        {sections.map((s) => (
          <section key={s.id} id={s.id} className={`${styles.section} ${s.className}`}>
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}

        <div className={styles.cta}>
          <p>Ready to try the operator console or live Swagger?</p>
          <div className={styles.ctaLinks}>
            <Link href="/register" className={styles.ctaBtnPrimary}>
              Get started
            </Link>
            <Link href="/login" className={styles.ctaBtnGhost}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
