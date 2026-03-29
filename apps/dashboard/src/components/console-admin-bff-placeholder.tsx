"use client";

import Link from "next/link";
import styles from "@/components/console-shell.module.css";

export function ConsoleAdminBffPlaceholder() {
  return (
    <div
      className={styles.card}
      style={{
        borderStyle: "dashed",
        borderColor: "rgba(27, 42, 74, 0.2)",
        background: "rgba(253, 252, 248, 0.9)",
      }}
    >
      <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>Nothing to show here yet</p>
      <p className={styles.muted} style={{ margin: "0 0 1rem" }}>
        This page loads data through the dashboard server using <code>DASHBOARD_API_KEY</code>. Add the{" "}
        <strong>full</strong> instance API key (the raw <code>hs_live_…</code> string)—not the masked preview with
        dots. You can copy it from the <strong>API process log</strong> when the server starts, or use{" "}
        <strong>Regenerate</strong> under API key settings to see a new secret once.
      </p>
      <Link href="/settings/api-key" className={styles.btnPrimary} style={{ display: "inline-flex", width: "fit-content" }}>
        API key settings
      </Link>
    </div>
  );
}
