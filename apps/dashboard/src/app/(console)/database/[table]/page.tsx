"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ConsoleHighlight } from "@/components/console-highlight";
import styles from "@/components/console-shell.module.css";
import dbStyles from "../database.module.css";
import { bffData } from "@/lib/bff-client";
import { useEffect, useState } from "react";

const PAGE_SIZE = 50;
const LONG_CELL = 220;

type TablePayload = {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function DbCellValue({ raw }: { raw: unknown }) {
  const text = formatCell(raw);
  if (text === "—") {
    return <span className={dbStyles.cellEmpty}>—</span>;
  }
  const long = text.length > LONG_CELL || text.includes("\n");
  if (!long) {
    return <span className={dbStyles.cellText}>{text}</span>;
  }
  const previewLen = Math.min(140, LONG_CELL);
  const preview = text.length > previewLen ? `${text.slice(0, previewLen).trimEnd()}…` : text;
  return (
    <details className={dbStyles.cellDetails}>
      <summary className={dbStyles.cellSummary}>
        <span className={dbStyles.cellPreview}>{preview}</span>
        <span className="sr-only">Expand to read full value</span>
      </summary>
      <pre className={dbStyles.cellFull}>{text}</pre>
    </details>
  );
}

export default function DatabaseTableDetailPage() {
  const params = useParams();
  const table = typeof params.table === "string" ? decodeURIComponent(params.table) : "";
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  useEffect(() => {
    setPage(0);
  }, [table]);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["admin-database-table", table, offset],
    queryFn: () =>
      bffData<TablePayload>(
        `/api/dashboard/admin/database/tables/${encodeURIComponent(table)}?limit=${PAGE_SIZE}&offset=${offset}`,
      ),
    enabled: table.length > 0,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <div className={dbStyles.toolbar}>
        <Link href="/database" className={`${styles.btnGhost} ${dbStyles.mono}`}>
          ← All tables
        </Link>
      </div>
      <h1 className={dbStyles.mono}>{table || "…"}</h1>

      <ConsoleHighlight title="Privacy">
        <code>password</code> and <code>key</code> columns are redacted. Long values wrap in the grid; use{" "}
        <strong>Expand</strong> on a cell to read the full text in a scrollable panel.
      </ConsoleHighlight>

      {isPending && <div className={styles.skeleton} style={{ height: 200 }} />}
      {isError && <p className={styles.errorBox}>{(error as Error).message}</p>}

      {data && (
        <>
          <div className={dbStyles.pagerRow}>
            <p className={styles.muted} style={{ margin: 0, flex: "1 1 12rem" }}>
              Showing {data.rows.length} of {data.total.toLocaleString()} rows
              {isFetching ? " · Loading…" : ""}
            </p>
            <div className={styles.row} style={{ margin: 0 }}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={page <= 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className={styles.muted}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={page >= totalPages - 1 || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
          <div className={dbStyles.dataScroll}>
            <table className={dbStyles.dataTable}>
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, data.columns.length)} className={styles.muted}>
                      No rows.
                    </td>
                  </tr>
                )}
                {data.rows.map((row, i) => (
                  <tr key={`${offset}-${i}`}>
                    {data.columns.map((c) => (
                      <td key={c}>
                        <DbCellValue raw={row[c]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
