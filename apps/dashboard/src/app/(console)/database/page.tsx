"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ConsoleHighlight } from "@/components/console-highlight";
import styles from "@/components/console-shell.module.css";
import dbStyles from "./database.module.css";
import { bffData } from "@/lib/bff-client";

type TableInfo = { name: string; rowCount: number };

export default function DatabaseTablesPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin-database-tables"],
    queryFn: () => bffData<{ tables: TableInfo[] }>("/api/dashboard/admin/database/tables"),
  });

  return (
    <>
      <h1>Database</h1>
      <ConsoleHighlight title="Operator view">
        Read-only snapshot of the instance SQLite schema. <code>password</code> and <code>key</code> columns are
        redacted. Use pagination on each table page for large datasets.
      </ConsoleHighlight>

      {isPending && <div className={styles.skeleton} style={{ height: 120, maxWidth: 480 }} />}
      {isError && <p className={styles.errorBox}>{(error as Error).message}</p>}

      {data && data.tables.length === 0 && <p className={styles.muted}>No tables found.</p>}

      {data && data.tables.length > 0 && (
        <ul className={dbStyles.tableGrid}>
          {data.tables.map((t) => (
            <li key={t.name}>
              <Link href={`/database/${encodeURIComponent(t.name)}`} className={dbStyles.tableCard}>
                <span className={dbStyles.tableName}>{t.name}</span>
                <span className={dbStyles.tableMeta}>
                  {t.rowCount.toLocaleString()} {t.rowCount === 1 ? "row" : "rows"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
