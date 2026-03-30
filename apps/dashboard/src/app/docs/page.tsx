import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import {
  DOCS_ADR_007,
  DOCS_API_SPEC,
  DOCS_ARCHITECTURE,
  DOCS_NPM_SDK,
  DOCS_NPM_TYPES,
  DOCS_PUBLISHING_SDK,
  DOCS_REPO,
  DOCS_SDK_README,
  DOCS_TECH_STACK,
} from "@/lib/docs-links";
import { isOperatorAuthenticated } from "@/lib/marketing-auth";
import styles from "./docs.module.css";

function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[styles.extLink, className].filter(Boolean).join(" ")}
    >
      {children}
    </a>
  );
}

const sections: {
  id: string;
  title: string;
  className?: string;
  body: React.ReactNode;
}[] = [
  {
    id: "introduction",
    title: "Introduction",
    className: styles.s1,
    body: (
      <>
        <p>
          <strong>AppBase</strong> is a self-hosted BaaS: auth, document database, file storage, and real-time updates
          over HTTP. Your <strong>instance API</strong> is the contract for mobile, web, and server clients.
        </p>
        <p>
          This page summarizes how pieces fit together. Canonical architecture and diagrams live in{" "}
          <ExternalLink href={DOCS_ARCHITECTURE}>ARCHITECTURE.md</ExternalLink> in the repository; the HTTP contract is{" "}
          <ExternalLink href={DOCS_API_SPEC}>API-SPEC.md</ExternalLink>.
        </p>
      </>
    ),
  },
  {
    id: "sdk",
    title: "JavaScript / TypeScript SDK",
    className: styles.s2,
    body: (
      <>
        <p className={styles.lead}>
          The official client is published on npm as{" "}
          <ExternalLink href={DOCS_NPM_SDK}>
            <code>@appbase-pfe/sdk</code>
          </ExternalLink>
          . Types ship as{" "}
          <ExternalLink href={DOCS_NPM_TYPES}>
            <code>@appbase-pfe/types</code>
          </ExternalLink>{" "}
          (installed automatically). Scope reflects the npm org; distribution rationale:{" "}
          <ExternalLink href={DOCS_ADR_007}>ADR-007</ExternalLink>.
        </p>
        <div className={styles.codeWrap}>
          <div className={styles.codeLabel}>Install</div>
          <pre className={styles.pre}>
            <code>npm install @appbase-pfe/sdk</code>
          </pre>
        </div>
        <div className={styles.codeWrap}>
          <div className={styles.codeLabel}>Initialize</div>
          <pre className={styles.pre}>
            <code>{`import { AppBase } from "@appbase-pfe/sdk";

const appbase = AppBase.init({
  endpoint: "https://your-api-host",
  apiKey: "your_instance_api_key",
  sessionStorageKey: "my_app_session",
});

await appbase.auth.signIn({ email, password });
const { items } = await appbase.db.collection("todos").list();`}</code>
          </pre>
        </div>
        <p>
          React helpers: <code>@appbase-pfe/sdk/react</code> (optional <code>react</code> peer). Service-oriented
          notes in the repo: <ExternalLink href={DOCS_SDK_README}>packages/sdk/README.md</ExternalLink> and{" "}
          <code>packages/sdk/docs/</code> (auth, db, storage guides).
        </p>
      </>
    ),
  },
  {
    id: "quickstart",
    title: "Instance quickstart",
    className: styles.s3,
    body: (
      <ul>
        <li>
          Run the API for this deployment (e.g. <code>pnpm --filter api dev</code> or your container).
        </li>
        <li>
          Open this dashboard, register or sign in as an <strong>operator</strong>, then create or copy an{" "}
          <strong>instance API key</strong> (Settings → API key).
        </li>
        <li>
          Point client apps at your API <strong>origin</strong> and send <code>x-api-key</code> on every BaaS request;
          user-scoped routes also need the bearer token from <code>/auth/login</code> (the SDK handles both).
        </li>
        <li>
          For interactive HTTP exploration, signed-in operators can open <strong>API reference</strong> in the console
          (Swagger UI served by the API at <code>/docs</code>).
        </li>
      </ul>
    ),
  },
  {
    id: "api-contract",
    title: "API contract & reference",
    className: styles.s4,
    body: (
      <>
        <p>
          Routes are grouped under <code>/auth/*</code>, <code>/db/*</code>, <code>/storage/*</code>, and operator{" "}
          <code>/admin/*</code> surfaces. Exact payloads and errors are defined in{" "}
          <ExternalLink href={DOCS_API_SPEC}>API-SPEC.md</ExternalLink>.
        </p>
        <p>
          Stack and implementation context: <ExternalLink href={DOCS_TECH_STACK}>TECH-STACK.md</ExternalLink>. Maintainer
          publishing notes: <ExternalLink href={DOCS_PUBLISHING_SDK}>PUBLISHING-SDK.md</ExternalLink>.
        </p>
      </>
    ),
  },
  {
    id: "authentication",
    title: "Authentication",
    className: styles.s5,
    body: (
      <p>
        End-user flows use <code>POST /auth/register</code>, <code>POST /auth/login</code>, refresh, and logout with{" "}
        <code>x-api-key</code> and cookies as described in API-SPEC. The <strong>operator console</strong> uses a
        separate server-side session (BFF); it is not part of the public SDK contract.
      </p>
    ),
  },
  {
    id: "database",
    title: "Database API",
    className: styles.s6,
    body: (
      <p>
        Collections and records under <code>/db/*</code> require <code>x-api-key</code> and a valid access token for
        user-scoped operations. List, get, create, update, delete, and SSE <code>subscribe</code> are documented in
        API-SPEC; the SDK exposes <code>appbase.db.collection(name)</code> with optional Zod schemas.
      </p>
    ),
  },
  {
    id: "storage",
    title: "Storage API",
    className: styles.s7,
    body: (
      <p>
        Multipart upload, download, list, and delete under <code>/storage/buckets/:bucket/...</code> with the same auth
        model. See API-SPEC and ADR-005 (file storage) in the repo for strategy details.
      </p>
    ),
  },
  {
    id: "repository",
    title: "Source & ADRs",
    className: styles.s8,
    body: (
      <>
        <p>
          Full markdown docs and architecture decision records live alongside the code:{" "}
          <ExternalLink href={DOCS_REPO}>github.com/NabilMouzouna/NubleCloud-PFE</ExternalLink> (see <code>docs/</code> and{" "}
          <code>docs/adr/</code>).
        </p>
        <p className={styles.mutedSmall}>
          Dashboard UI cannot embed the whole spec; links open GitHub or npm in a new tab.
        </p>
      </>
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
              <ExternalLink href={DOCS_NPM_SDK}>npm · @appbase-pfe/sdk</ExternalLink>
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
            <p>
              Build on your AppBase instance using the public API and the{" "}
              <ExternalLink href={DOCS_NPM_SDK}>
                <code>@appbase-pfe/sdk</code>
              </ExternalLink>{" "}
              package on npm.
            </p>
            <div className={styles.heroPills}>
              <a href={DOCS_NPM_SDK} target="_blank" rel="noopener noreferrer" className={styles.npmPill}>
                View on npm
              </a>
              <ExternalLink href={DOCS_ARCHITECTURE} className={styles.ghostPill}>
                Architecture
              </ExternalLink>
              <ExternalLink href={DOCS_API_SPEC} className={styles.ghostPill}>
                API-SPEC
              </ExternalLink>
            </div>
          </header>

          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className={[styles.section, s.className].filter(Boolean).join(" ")}
            >
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}

          <div className={styles.cta}>
            <p>Configure keys and users from the operator console, or open the live Swagger UI from there.</p>
            <div className={styles.ctaLinks}>
              {authenticated ? (
                <>
                  <Link href="/overview" className={styles.ctaBtnPrimary}>
                    Open console
                  </Link>
                  <Link href="/api-reference" className={styles.ctaBtnGhost}>
                    API reference
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register" className={styles.ctaBtnPrimary}>
                    Get started
                  </Link>
                  <Link href="/login" className={styles.ctaBtnGhost}>
                    Sign in
                  </Link>
                </>
              )}
              <Link href="/" className={styles.ctaBtnGhost}>
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
