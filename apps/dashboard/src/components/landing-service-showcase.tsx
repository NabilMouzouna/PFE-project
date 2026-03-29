"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Database, HardDrive, Radio, Shield } from "lucide-react";
import styles from "@/app/landing-showcase.module.css";

type Block = {
  id: string;
  title: string;
  tagline: string;
  points: string[];
  icon: LucideIcon;
  accentClass: string;
  glowClass: string;
  reverse?: boolean;
};

const blocks: Block[] = [
  {
    id: "auth-deep",
    title: "Authentication",
    tagline: "Identity that stays on your hardware.",
    points: [
      "Register and sign-in flows with JWT access and refresh, aligned with your API’s Better Auth stack.",
      "Role-aware tokens so the operator console and automation scripts share one trust model.",
      "No third-party IdP required—ideal for air-gapped labs, classrooms, and field deployments.",
    ],
    icon: Shield,
    accentClass: styles.accentAuth ?? "",
    glowClass: styles.glowAuth ?? "",
  },
  {
    id: "db-deep",
    title: "Database",
    tagline: "Documents and streams without a hosted vendor.",
    points: [
      "Collection-oriented REST with clear ownership boundaries per app instance.",
      "Server-sent events for live subscribers—great for dashboards and collaborative UIs.",
      "SQLite at the core: simple backups, predictable performance on a single node.",
    ],
    icon: Database,
    accentClass: styles.accentDb ?? "",
    glowClass: styles.glowDb ?? "",
    reverse: true,
  },
  {
    id: "storage-deep",
    title: "Storage",
    tagline: "Objects where you already control the disk.",
    points: [
      "Multipart uploads, metadata, and checksums for integrity-conscious workflows.",
      "Filesystem-backed driver: rsync, snapshot, or bind-mount into your existing NAS.",
      "Scoped buckets so each app keeps its own object namespace.",
    ],
    icon: HardDrive,
    accentClass: styles.accentStorage ?? "",
    glowClass: styles.glowStorage ?? "",
  },
  {
    id: "network-deep",
    title: "Network & real-time",
    tagline: "One process, many clients.",
    points: [
      "SSE and HTTP/1.1 friendly semantics that work through typical LAN proxies.",
      "Health and admin surfaces exposed for the operator console you are using now.",
      "Room to grow: discovery and clustering are on the roadmap—not a rewrite.",
    ],
    icon: Radio,
    accentClass: styles.accentNet ?? "",
    glowClass: styles.glowNet ?? "",
    reverse: true,
  },
];

function useRevealOnScroll(reduceMotion: boolean | null) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(true);

  useLayoutEffect(() => {
    if (reduceMotion !== false) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const vh = window.innerHeight;
    const r = el.getBoundingClientRect();
    const alreadyVisible = r.top < vh * 0.88 && r.bottom > 0;
    if (alreadyVisible) {
      setInView(true);
      return;
    }
    setInView(false);
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduceMotion]);

  return { ref, inView };
}

function ShowcaseRow({ block, reduceMotion }: { block: Block; reduceMotion: boolean | null }) {
  const { ref, inView } = useRevealOnScroll(reduceMotion);
  const motionOn = reduceMotion === false;
  const Icon = block.icon;
  const rowClass = [
    styles.showcaseRow,
    block.reverse ? styles.reverse : "",
    motionOn ? (inView ? styles.showcaseVisible : styles.showcaseHidden) : styles.showcaseVisible,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article ref={ref} id={block.id} className={rowClass}>
      <div className={`${styles.iconStage} ${block.glowClass}`} aria-hidden>
        <div className={`${styles.iconRing} ${block.accentClass}`}>
          <Icon className={styles.iconSvg} strokeWidth={1.75} size={44} />
        </div>
      </div>
      <div className={styles.showcaseCopy}>
        <h3 className={styles.showcaseTitle}>{block.title}</h3>
        <p className={styles.showcaseTagline}>{block.tagline}</p>
        <ul className={styles.showcaseList}>
          {block.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function LandingServiceShowcase() {
  const baseId = useId();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <section className={styles.showcase} aria-labelledby={`${baseId}-heading`}>
      <div className={styles.showcaseIntro}>
        <h2 id={`${baseId}-heading`} className={styles.showcaseHeading}>
          Built for operators who ship on the LAN
        </h2>
        <p className={styles.showcaseLead}>
          Four pillars, one runtime. Each layer is exposed through HTTP you can script, test, and cache—no proprietary
          sync daemon required.
        </p>
      </div>
      <div className={styles.showcaseStack}>
        {blocks.map((b) => (
          <ShowcaseRow key={b.id} block={b} reduceMotion={reduceMotion} />
        ))}
      </div>
    </section>
  );
}
