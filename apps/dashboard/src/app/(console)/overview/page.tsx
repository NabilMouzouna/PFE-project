"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ConsoleHighlight } from "@/components/console-highlight";
import styles from "@/components/console-shell.module.css";
import ovStyles from "./overview.module.css";
import { bffData } from "@/lib/bff-client";

type HealthPayload = {
  success: boolean;
  data?: { status?: string; checks?: Record<string, { status: string; message?: string }> };
  error?: { message?: string };
};

type Usage = {
  totalFiles: number;
  totalBytes: number;
  byBucket: { bucket: string; fileCount: number; totalBytes: number }[];
};

type UserRow = { id: string; email: string; role: string | null };

type DbTablesPayload = { tables: { name: string; rowCount: number }[] };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function OverviewPage() {
  const [healthQ, metaQ, storageQ, usersQ, dbQ] = useQueries({
    queries: [
      {
        queryKey: ["dashboard-health"],
        queryFn: async (): Promise<HealthPayload> => {
          const res = await fetch("/api/dashboard/health", { credentials: "include" });
          return (await res.json()) as HealthPayload;
        },
      },
      {
        queryKey: ["dashboard-meta"],
        queryFn: () => bffData<{ apiBaseUrl: string }>("/api/dashboard/meta"),
      },
      {
        queryKey: ["admin-storage"],
        queryFn: () => bffData<Usage>("/api/dashboard/admin/storage"),
      },
      {
        queryKey: ["admin-users"],
        queryFn: () => bffData<{ users: UserRow[] }>("/api/dashboard/admin/users"),
      },
      {
        queryKey: ["admin-database-tables"],
        queryFn: () => bffData<DbTablesPayload>("/api/dashboard/admin/database/tables"),
      },
    ],
  });

  const healthy =
    healthQ.data?.success === true && healthQ.data?.data?.status === "healthy";
  const userCount = usersQ.data?.users?.length ?? null;
  const adminCount =
    usersQ.data?.users?.filter((u) => u.role === "admin").length ?? undefined;
  const storage = storageQ.data;
  const tableCount = dbQ.data?.tables?.length ?? null;
  const recordRows =
    dbQ.data?.tables?.find((t) => t.name === "records")?.rowCount ?? null;

  return (
    <>
      <h1>Overview</h1>

      <ConsoleHighlight title="About this console">
        Operator console for this AppBase instance. The API base URL comes from server-only configuration (
        <code>API_BASE_URL</code>)—it is not embedded in the browser bundle as a secret.
      </ConsoleHighlight>

      <section className={ovStyles.grid}>
        <div className={`${ovStyles.tile} ${ovStyles.tileHealth}`}>
          <div className={ovStyles.tileKicker}>Health</div>
          {healthQ.isPending && <div className={styles.skeleton} style={{ height: 36, width: 100 }} />}
          {healthQ.isError && (
            <p className={styles.errorBox} style={{ margin: 0 }}>
              {(healthQ.error as Error).message}
            </p>
          )}
          {healthQ.data && (
            <>
              <div
                className={`${styles.pill} ${healthy ? styles.pillOk : styles.pillBad}`}
                style={{ marginBottom: "var(--appbase-space-3)" }}
              >
                {healthy ? "Healthy" : healthQ.data.success === false ? "Unhealthy" : "Unknown"}
              </div>
              {healthQ.data.data?.checks && (
                <ul className={ovStyles.checkList}>
                  <li>
                    Database: <strong>{healthQ.data.data.checks.database?.status ?? "—"}</strong>
                  </li>
                  <li>
                    Storage: <strong>{healthQ.data.data.checks.storage?.status ?? "—"}</strong>
                  </li>
                </ul>
              )}
              {healthQ.data.success === false && healthQ.data.error?.message && (
                <p className={styles.muted} style={{ margin: 0 }}>
                  {healthQ.data.error.message}
                </p>
              )}
            </>
          )}
        </div>

        <div className={`${ovStyles.tile} ${ovStyles.tileApi}`}>
          <div className={ovStyles.tileKicker}>API</div>
          {metaQ.isPending && <div className={styles.skeleton} style={{ height: 48 }} />}
          {metaQ.data && (
            <p className={ovStyles.apiUrl} title={metaQ.data.apiBaseUrl}>
              {metaQ.data.apiBaseUrl}
            </p>
          )}
          {metaQ.isError && (
            <p className={styles.muted} style={{ margin: 0 }}>
              Could not load meta.
            </p>
          )}
        </div>

        <div className={`${ovStyles.tile} ${ovStyles.tileUsers}`}>
          <div className={ovStyles.tileKicker}>Users</div>
          {usersQ.isPending && <div className={styles.skeleton} style={{ height: 40, width: 80 }} />}
          {usersQ.data && (
            <>
              <div className={ovStyles.stat}>{userCount}</div>
              <p className={ovStyles.tileSub}>
                Operators & end-users
                {adminCount != null
                  ? ` · ${adminCount} admin${adminCount === 1 ? "" : "s"}`
                  : ""}
              </p>
              <Link href="/users" className={ovStyles.tileLink}>
                Manage users →
              </Link>
            </>
          )}
          {usersQ.isError && (
            <p className={styles.muted} style={{ margin: 0 }}>
              Could not load users.
            </p>
          )}
        </div>

        <div className={`${ovStyles.tile} ${ovStyles.tileStorage}`}>
          <div className={ovStyles.tileKicker}>Storage</div>
          {storageQ.isPending && <div className={styles.skeleton} style={{ height: 40, width: 120 }} />}
          {storage && (
            <>
              <div className={ovStyles.statRow}>
                <span className={ovStyles.stat}>{storage.totalFiles}</span>
                <span className={styles.muted}>files</span>
              </div>
              <div className={ovStyles.statRow}>
                <span className={ovStyles.stat}>{formatBytes(storage.totalBytes)}</span>
                <span className={styles.muted}>total</span>
              </div>
              {storage.byBucket.length > 0 && (
                <p className={ovStyles.tileSub}>
                  {storage.byBucket.length} bucket{storage.byBucket.length === 1 ? "" : "s"}
                </p>
              )}
              <Link href="/storage" className={ovStyles.tileLink}>
                Storage details →
              </Link>
            </>
          )}
          {storageQ.isError && (
            <p className={styles.muted} style={{ margin: 0 }}>
              Could not load storage.
            </p>
          )}
        </div>

        <div className={`${ovStyles.tile} ${ovStyles.tileDb}`}>
          <div className={ovStyles.tileKicker}>Database</div>
          {dbQ.isPending && <div className={styles.skeleton} style={{ height: 40, width: 100 }} />}
          {dbQ.data && (
            <>
              <div className={ovStyles.statRow}>
                <span className={ovStyles.stat}>{tableCount}</span>
                <span className={styles.muted}>tables</span>
              </div>
              {recordRows != null && (
                <p className={ovStyles.tileSub}>
                  {recordRows.toLocaleString()} document row{recordRows === 1 ? "" : "s"} in{" "}
                  <code className={ovStyles.inlineCode}>records</code>
                </p>
              )}
              <Link href="/database" className={ovStyles.tileLink}>
                Browse tables →
              </Link>
            </>
          )}
          {dbQ.isError && (
            <p className={styles.muted} style={{ margin: 0 }}>
              Could not load database info.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
