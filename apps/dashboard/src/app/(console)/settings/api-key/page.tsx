"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import styles from "@/components/console-shell.module.css";
import { bffData, bffJson } from "@/lib/bff-client";

type ApiKeyMissing = { status: "missing" };

type ApiKeyActive = {
  status: "active";
  keyPrefix: string;
  masked: string;
  lastRotatedAt: string | null;
};

type ApiKeyState = ApiKeyMissing | ApiKeyActive;

export default function ApiKeyPage() {
  const qc = useQueryClient();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [newKeyOnce, setNewKeyOnce] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin-api-key"],
    queryFn: () => bffData<ApiKeyState>("/api/dashboard/admin/api-key"),
  });

  const bootstrap = useMutation({
    mutationFn: async () => {
      const res = await bffJson<{ success: true; data: { key: string } }>("/api/dashboard/admin/api-key/bootstrap", {
        method: "POST",
        body: "{}",
      });
      return res.data;
    },
    onSuccess: (d) => {
      setNewKeyOnce(d.key);
      void qc.invalidateQueries({ queryKey: ["admin-api-key"] });
    },
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
    if (!data || data.status !== "active") return;
    try {
      await navigator.clipboard.writeText(data.masked);
      setCopyHint("Copied masked preview. The full secret is only shown once after generate or regenerate.");
    } catch {
      setCopyHint("Could not copy to clipboard.");
    }
  }

  async function copyNewKey() {
    if (!newKeyOnce) return;
    try {
      await navigator.clipboard.writeText(newKeyOnce);
      setCopyHint("New key copied. Update your SDK clients/app config that use x-api-key.");
    } catch {
      setCopyHint("Could not copy.");
    }
  }

  return (
    <>
      <h1>API key</h1>
      <p className={styles.muted}>
        This is the instance key for the SDK and HTTP clients (<code>x-api-key</code>). On API startup, a key is
        created automatically if none exists—the full secret is printed once in the <strong>API server logs</strong>.
        You can also <strong>Generate</strong> or <strong>Regenerate</strong> here to see a new key once in the browser.
        The dashboard itself does not require an API key env var.
      </p>

      {isPending && <div className={styles.skeleton} style={{ height: 48, maxWidth: 360 }} />}
      {isError && <p className={styles.errorBox}>{(error as Error).message}</p>}

      {data?.status === "missing" && (
        <div className={styles.card}>
          <h2 style={{ marginTop: 0, fontSize: "1.125rem" }}>No instance API key yet</h2>
          <p className={styles.muted}>Generate one now. You will see the full key a single time.</p>
          {bootstrap.isError && (
            <p className={styles.errorBox}>{(bootstrap.error as Error).message}</p>
          )}
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={bootstrap.isPending}
            onClick={() => bootstrap.mutate()}
          >
            {bootstrap.isPending ? "Generating…" : "Generate instance API key"}
          </button>
        </div>
      )}

      {data?.status === "active" && (
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
          {copyHint && (
            <p className={styles.muted} style={{ marginBottom: 0 }}>
              {copyHint}
            </p>
          )}
        </div>
      )}

      {newKeyOnce && (
        <div className={styles.card} style={{ borderColor: "var(--appbase-accent-db-border)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.125rem" }}>Your key (shown once)</h2>
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
          Refresh
        </button>
      </p>
    </>
  );
}
