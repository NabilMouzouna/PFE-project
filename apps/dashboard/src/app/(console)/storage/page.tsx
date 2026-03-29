"use client";

import { useQuery } from "@tanstack/react-query";
import styles from "@/components/console-shell.module.css";
import { ConsoleAdminBffPlaceholder } from "@/components/console-admin-bff-placeholder";
import { bffData, isAdminBffConfigError } from "@/lib/bff-client";

type Usage = {
  totalFiles: number;
  totalBytes: number;
  byBucket: { bucket: string; fileCount: number; totalBytes: number }[];
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function StoragePage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin-storage"],
    queryFn: () => bffData<Usage>("/api/dashboard/admin/storage"),
  });

  return (
    <>
      <h1>Storage</h1>
      <p className={styles.muted}>Usage across all buckets for this instance.</p>

      {isPending && <div className={styles.skeleton} style={{ height: 80, maxWidth: 400 }} />}
      {isError &&
        (isAdminBffConfigError(error) ? (
          <ConsoleAdminBffPlaceholder />
        ) : (
          <p className={styles.errorBox}>{(error as Error).message}</p>
        ))}

      {data && (
        <div className={styles.row} style={{ gap: 24 }}>
          <div className={styles.card} style={{ flex: 1, minWidth: 200, background: "var(--appbase-accent-storage-bg)" }}>
            <div className={styles.muted} style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
              Total files
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.totalFiles}</div>
          </div>
          <div className={styles.card} style={{ flex: 1, minWidth: 200, background: "var(--appbase-accent-db-bg)" }}>
            <div className={styles.muted} style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
              Total size
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{formatBytes(data.totalBytes)}</div>
          </div>
        </div>
      )}

      {data && data.byBucket.length === 0 && (
        <p className={styles.muted}>No files stored yet.</p>
      )}

      {data && data.byBucket.length > 0 && (
        <div className={styles.card} style={{ padding: 0, overflow: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Files</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {data.byBucket.map((b) => (
                <tr key={b.bucket}>
                  <td>{b.bucket}</td>
                  <td>{b.fileCount}</td>
                  <td>{formatBytes(b.totalBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
