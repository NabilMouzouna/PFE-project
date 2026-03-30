"use client";

import { Database, HardDrive, Radio, Shield } from "lucide-react";
import styles from "@/app/landing.module.css";

const featureAnimDelays = [styles.d4, styles.d5, styles.d6, styles.d7];

const items = [
  {
    Icon: Shield,
    iconClass: styles.iconAuth,
    title: "Authentication",
    body: "Email and password, JWT access tokens, and HttpOnly session cookies—built for LAN and offline-first setups.",
  },
  {
    Icon: Database,
    iconClass: styles.iconDb,
    title: "Database",
    body: "Document collections with REST, owner isolation, and real-time updates over SSE. SQLite under the hood.",
  },
  {
    Icon: HardDrive,
    iconClass: styles.iconStorage,
    title: "Storage",
    body: "Buckets and files with metadata and checksums. Filesystem-first driver—predictable and easy to back up.",
  },
  {
    Icon: Radio,
    iconClass: styles.iconNet,
    title: "Network & ops",
    body: "Health surfaces and admin APIs for your operator workflow. Designed to grow with your deployment story.",
  },
];

export function LandingFeatureGrid() {
  return (
    <div className={styles.grid}>
      {items.map((f, i) => (
        <article
          key={f.title}
          className={`${styles.featureCard} ${styles.fadeRiseDelayed} ${featureAnimDelays[i] ?? ""}`}
        >
          <div className={`${styles.icon} ${f.iconClass}`} aria-hidden>
            <f.Icon className={styles.iconLucide} strokeWidth={1.85} size={26} />
          </div>
          <h2 className={styles.cardTitle}>{f.title}</h2>
          <p className={styles.cardBody}>{f.body}</p>
        </article>
      ))}
    </div>
  );
}
