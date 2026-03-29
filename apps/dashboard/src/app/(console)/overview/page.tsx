"use client";

import { useQuery } from "@tanstack/react-query";
import styles from "@/components/console-shell.module.css";
import { bffData } from "@/lib/bff-client";

type HealthPayload = {
  success: boolean;
  data?: { status?: string; checks?: Record<string, { status: string; message?: string }> };
  error?: { message?: string };
};

export default function OverviewPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["dashboard-health"],
    queryFn: async (): Promise<HealthPayload> => {
      const res = await fetch("/api/dashboard/health", { credentials: "include" });
      return (await res.json()) as HealthPayload;
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["dashboard-meta"],
    queryFn: () => bffData<{ apiBaseUrl: string }>("/api/dashboard/meta"),
  });

  const healthy = data?.success === true && data.data?.status === "healthy";

  return (
    <>
      <h1>Overview</h1>
      <p className={styles.muted}>
        Operator console for this AppBase instance. API base URL is read from server configuration (<code>API_BASE_URL</code>
        ); it is not exposed in the client bundle as a secret.
      </p>
      <div className={styles.card}>
        <h2 className={styles.muted} style={{ marginTop: 0, fontSize: "0.75rem", textTransform: "uppercase" }}>
          Health
        </h2>
        {isPending && <div className={styles.skeleton} style={{ width: 120 }} />}
        {isError && (
          <p className={styles.errorBox} style={{ margin: 0 }}>
            {(error as Error).message}
          </p>
        )}
        {data && (
          <div className={styles.row}>
            <span className={`${styles.pill} ${healthy ? styles.pillOk : styles.pillBad}`}>
              {healthy ? "Healthy" : data.success === false ? "Unhealthy" : "Unknown"}
            </span>
            {data.data?.checks && (
              <span className={styles.muted}>
                DB: {data.data.checks.database?.status ?? "—"} · Storage: {data.data.checks.storage?.status ?? "—"}
              </span>
            )}
            {data.success === false && data.error?.message && (
              <span className={styles.muted}>{data.error.message}</span>
            )}
          </div>
        )}
      </div>
      <div className={styles.card}>
        <h2 className={styles.muted} style={{ marginTop: 0, fontSize: "0.75rem", textTransform: "uppercase" }}>
          API
        </h2>
        <p className={styles.muted} style={{ margin: 0, wordBreak: "break-all" }}>
          {meta?.apiBaseUrl ?? "…"}
        </p>
      </div>
    </>
  );
}
