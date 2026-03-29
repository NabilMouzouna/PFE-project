"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import styles from "@/components/console-shell.module.css";
import { bffData, bffJson, BffError } from "@/lib/bff-client";

type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  role: string | null;
  banned: boolean | null;
  emailVerified: boolean;
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [modalUser, setModalUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => bffData<{ users: UserRow[] }>("/api/dashboard/admin/users"),
  });

  const resetPw = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await bffJson(`/api/dashboard/admin/users/${encodeURIComponent(id)}/password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: password }),
      });
    },
    onSuccess: async () => {
      setModalUser(null);
      setNewPassword("");
      setModalError(null);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => {
      setModalError(e instanceof BffError ? e.message : "Request failed.");
    },
  });

  return (
    <>
      <h1>Users</h1>
      <p className={styles.muted}>End-users and operators registered on this instance.</p>

      {isPending && (
        <div className={styles.stack}>
          <div className={styles.skeleton} style={{ height: 14 }} />
          <div className={styles.skeleton} style={{ height: 14 }} />
          <div className={styles.skeleton} style={{ height: 14 }} />
        </div>
      )}
      {isError && <p className={styles.errorBox}>{(error as Error).message}</p>}

      {data && data.users.length === 0 && <p className={styles.muted}>No users yet.</p>}

      {data && data.users.length > 0 && (
        <div className={styles.card} style={{ padding: 0, overflow: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Verified</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.role ?? "—"}</td>
                  <td>{u.emailVerified ? "Yes" : "No"}</td>
                  <td className={styles.muted}>{new Date(u.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ fontSize: "0.8125rem", padding: "4px 10px" }}
                      onClick={() => {
                        setModalUser(u);
                        setNewPassword("");
                        setModalError(null);
                      }}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalUser && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="pw-title">
          <div className={styles.modal}>
            <h2 id="pw-title">Set password</h2>
            <p className={styles.muted} style={{ wordBreak: "break-all" }}>
              {modalUser.email}
            </p>
            <label className={styles.stack} style={{ gap: 8 }}>
              <span className={styles.muted}>New password (min 8 characters)</span>
              <input
                type="password"
                className={styles.input}
                style={{ maxWidth: "100%" }}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {modalError && <p className={styles.errorBox} style={{ margin: 0 }}>{modalError}</p>}
            <div className={styles.row} style={{ marginTop: 16 }}>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={newPassword.length < 8 || resetPw.isPending}
                onClick={() =>
                  resetPw.mutate({ id: modalUser.id, password: newPassword })
                }
              >
                {resetPw.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={resetPw.isPending}
                onClick={() => setModalUser(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
