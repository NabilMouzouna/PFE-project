"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import styles from "@/components/console-shell.module.css";
import { bffData, bffJson } from "@/lib/bff-client";

type ApiKeyMeta = { keyPrefix: string; masked: string; lastRotatedAt: string | null };

export default function ApiKeyPage() {
  const qc = useQueryClient();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [newKeyOnce, setNewKeyOnce] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin-api-key"],
    queryFn: () => bffData<ApiKeyMeta>("/api/dashboard/admin/api-key"),
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const res = await bffJson<{ success: true; data: { key: string } }>("/api/dashboard/admin/api-key/rotate", {
        method: "POST",
        body: "{}",
      });
      return res.data;
    },
    onSuccess: (d) => {
      setNewKeyOnce(d.key);
      setRotateOpen(false);
      setConfirmText("");
      void qc.invalidateQueries({ queryKey: ["admin-api-key"] });
    },
  });

  async function copyMasked() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.masked);
      setCopyHint("Copied masked preview. Full key is only shown once after Regenerate.");
    } catch {
      setCopyHint("Could not copy to clipboard.");
    }
  }

  async function copyNewKey() {
    if (!newKeyOnce) return;
    try {
      await navigator.clipboard.writeText(newKeyOnce);
      setCopyHint("New key copied. Update DASHBOARD_API_KEY (and clients) or the console will lose API access.");
    } catch {
      setCopyHint("Could not copy.");
    }
  }

  return (
    <>
      <h1>API key</h1>
      <p className={styles.muted}>
        Instance key for SDK and BFF. In production it must stay server-side (<code>DASHBOARD_API_KEY</code>). After
        rotation, update that environment variable immediately.
      </p>

      {isPending && <div className={styles.skeleton} style={{ height: 48, maxWidth: 360 }} />}
      {isError && (
        <p className={styles.errorBox}>{(error as Error).message}</p>
      )}
      {data && (
        <div className={styles.card}>
          <div className={styles.row} style={{ marginBottom: 16 }}>
            <code style={{ fontSize: "1rem" }}>{data.masked}</code>
          </div>
          <div className={styles.row}>
            <button type="button" className={styles.btnGhost} onClick={() => void copyMasked()}>
              Copy masked
            </button>
            <button type="button" className={styles.btnPrimary} onClick={() => setRotateOpen(true)}>
              Regenerate key
            </button>
          </div>
          {copyHint && <p className={styles.muted} style={{ marginBottom: 0 }}>{copyHint}</p>}
        </div>
      )}

      {newKeyOnce && (
        <div className={styles.card} style={{ borderColor: "var(--appbase-accent-db-border)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.125rem" }}>New key (shown once)</h2>
          <pre
            style={{
              padding: 12,
              background: "var(--appbase-accent-db-bg)",
              borderRadius: 8,
              overflow: "auto",
              fontSize: "0.875rem",
            }}
          >
            {newKeyOnce}
          </pre>
          <div className={styles.row}>
            <button type="button" className={styles.btnPrimary} onClick={() => void copyNewKey()}>
              Copy key
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => setNewKeyOnce(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {rotateOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rotate-title"
        >
          <div className={styles.modal}>
            <h2 id="rotate-title">Regenerate API key</h2>
            <p className={styles.muted}>
              All clients using the current key will fail until updated. Type <strong>ROTATE</strong> to confirm.
            </p>
            <input
              className={styles.input}
              style={{ maxWidth: "100%", marginBottom: 16 }}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ROTATE"
              autoComplete="off"
            />
            {rotate.isError && (
              <p className={styles.errorBox} style={{ marginTop: 0 }}>
                {(rotate.error as Error).message}
              </p>
            )}
            <div className={styles.row}>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={confirmText !== "ROTATE" || rotate.isPending}
                onClick={() => rotate.mutate()}
              >
                {rotate.isPending ? "Rotating…" : "Confirm rotate"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={rotate.isPending}
                onClick={() => {
                  setRotateOpen(false);
                  setConfirmText("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <p className={styles.muted}>
        <button type="button" className={styles.btnGhost} onClick={() => void refetch()}>
          Refresh metadata
        </button>
      </p>
    </>
  );
}
