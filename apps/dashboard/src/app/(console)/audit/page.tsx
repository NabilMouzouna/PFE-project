"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import styles from "@/components/console-shell.module.css";
import { ConsoleAdminBffPlaceholder } from "@/components/console-admin-bff-placeholder";
import { bffData, isAdminBffConfigError } from "@/lib/bff-client";

type AuditItem = {
  id: string;
  action: string;
  userId: string | null;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AuditResponse = {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE = 20;

export default function AuditPage() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const offset = page * PAGE;
  const qs = useMemo(() => {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (actionFilter.trim()) p.set("action", actionFilter.trim());
    return p.toString();
  }, [offset, actionFilter]);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["admin-audit", qs],
    queryFn: () => bffData<AuditResponse>(`/api/dashboard/admin/audit?${qs}`),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <>
      <h1>Audit log</h1>
      <p className={styles.muted}>Recent actions recorded for this instance.</p>

      <div className={styles.card}>
        <div className={styles.row}>
          <label className={styles.row} style={{ alignItems: "center", gap: 8 }}>
            <span className={styles.muted}>Action filter</span>
            <input
              className={styles.input}
              style={{ maxWidth: 220 }}
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
              placeholder="e.g. user.login"
            />
          </label>
          {isFetching && !isPending && <span className={styles.muted}>Updating…</span>}
        </div>
      </div>

      {isPending && (
        <div className={styles.stack}>
          <div className={styles.skeleton} style={{ height: 14 }} />
          <div className={styles.skeleton} style={{ height: 14 }} />
        </div>
      )}
      {isError &&
        (isAdminBffConfigError(error) ? (
          <ConsoleAdminBffPlaceholder />
        ) : (
          <p className={styles.errorBox}>{(error as Error).message}</p>
        ))}

      {data && data.items.length === 0 && <p className={styles.muted}>No audit entries match.</p>}

      {data && data.items.length > 0 && (
        <div className={styles.card} style={{ padding: 0, overflow: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>User</th>
                <th>Resource</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className={styles.muted}>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.action}</td>
                  <td className={styles.muted}>{row.userId ?? "—"}</td>
                  <td>
                    {row.resource}
                    {row.resourceId ? ` / ${row.resourceId}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > PAGE && (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className={styles.muted}>
            Page {page + 1} of {totalPages} ({data.total} total)
          </span>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
