"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppBase, useAuth } from "@/lib/appbase";
import type { DbRecord } from "@appbase-pfe/sdk";
import { StorageError } from "@appbase-pfe/sdk";
import { Button, Input, Textarea, CardHeader, Modal } from "@/components/ui";
import {
  AVATAR_BUCKET,
  PROFILE_ACCEPT_IMAGE,
  ProfileRowSchema,
  type ProfileData,
  defaultDisplayName,
} from "@/lib/profile-schema";

type ProfileRow = DbRecord<ProfileData>;

export type ProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Called after profile save or avatar upload so the header preview can refresh. */
  onProfileChanged?: () => void;
};

export function ProfileModal({ isOpen, onClose, onProfileChanged }: ProfileModalProps) {
  const appBase = useAppBase();
  const { getCurrentUser } = useAuth();

  const profiles = useMemo(
    () => appBase.db.collection<ProfileData>("profiles", ProfileRowSchema),
    [appBase],
  );

  const [loading, setLoading] = useState(true);
  const [profileRecord, setProfileRecord] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
  const [avatarHint, setAvatarHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fullUser = getCurrentUser();

  const loadProfile = useCallback(async () => {
    const u = getCurrentUser();
    if (!u) return;
    setError(null);
    try {
      const { items } = await profiles.list({ limit: 1 });
      const row = items[0] ?? null;
      setProfileRecord(row);
      const latest = getCurrentUser();
      if (row) {
        setDisplayName(row.data.displayName);
        setBio(row.data.bio ?? "");
      } else if (latest) {
        setDisplayName(defaultDisplayName(latest.email, latest.customIdentity));
        setBio("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [profiles, getCurrentUser]);

  useEffect(() => {
    if (!isOpen) return;
    if (!getCurrentUser()) return;
    setLoading(true);
    void loadProfile();
  }, [isOpen, loadProfile, getCurrentUser]);

  useEffect(() => {
    const fileId = profileRecord?.data.avatarFileId;
    if (!fileId) {
      setAvatarObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        setAvatarHint(null);
        const blob = (await appBase.storage.download(AVATAR_BUCKET, fileId, {
          as: "blob",
        })) as Blob;
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatarObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof StorageError ? e.message : e instanceof Error ? e.message : "Avatar failed to load";
          setAvatarHint(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [appBase.storage, profileRecord?.data.avatarFileId]);

  const persistProfile = async (next: ProfileData) => {
    if (profileRecord) {
      const updated = await profiles.update(profileRecord.id, next);
      setProfileRecord(updated);
      return updated;
    }
    const created = await profiles.create(next);
    setProfileRecord(created);
    return created;
  };

  const notifyChanged = () => {
    onProfileChanged?.();
  };

  const onSave = async () => {
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }
    setSaveBusy(true);
    setError(null);
    try {
      await persistProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        avatarFileId: profileRecord?.data.avatarFileId,
        updatedAt: new Date().toISOString(),
      });
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  };

  const onAvatarChange = async (file: File | null) => {
    setAvatarHint(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarHint("Please choose an image file (JPEG, PNG, GIF, or WebP).");
      return;
    }
    const max = 5 * 1024 * 1024;
    if (file.size > max) {
      setAvatarHint("Image must be 5 MB or smaller.");
      return;
    }

    setUploadBusy(true);
    setError(null);
    const previousFileId = profileRecord?.data.avatarFileId;
    try {
      const { file: meta } = await appBase.storage.upload(AVATAR_BUCKET, file);
      const base: ProfileData = {
        displayName: displayName.trim() || defaultDisplayName(fullUser?.email ?? "", fullUser?.customIdentity),
        bio: bio.trim() || undefined,
        avatarFileId: meta.id,
        updatedAt: new Date().toISOString(),
      };
      await persistProfile(base);
      if (previousFileId && previousFileId !== meta.id) {
        await appBase.storage.remove(AVATAR_BUCKET, previousFileId).catch(() => {});
      }
      notifyChanged();
    } catch (e) {
      const msg =
        e instanceof StorageError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : "Upload failed";
      setError(msg);
    } finally {
      setUploadBusy(false);
    }
  };

  if (!fullUser) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your profile" panelClassName="max-w-2xl">
      <section className="mb-6 rounded-lg border border-var(--line) bg-var(--panel)/50 p-4">
        <CardHeader
          title="Auth (read-only)"
          subtitle="From your session — email/password changes are not in this demo."
        />
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="opacity-60">Email</dt>
            <dd className="font-medium">{fullUser.email}</dd>
          </div>
          <div>
            <dt className="opacity-60">User id</dt>
            <dd className="font-mono text-xs opacity-90">{fullUser.id}</dd>
          </div>
          <div>
            <dt className="opacity-60">Member since</dt>
            <dd>{new Date(fullUser.createdAt).toLocaleString()}</dd>
          </div>
          {fullUser.customIdentity && Object.keys(fullUser.customIdentity).length > 0 ? (
            <div>
              <dt className="opacity-60">Sign-up extras</dt>
              <dd className="rounded border border-var(--line) bg-var(--paper) p-2 font-mono text-xs">
                {JSON.stringify(fullUser.customIdentity, null, 2)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <CardHeader
        title="Profile & avatar"
        subtitle="Display name and bio live in the profiles collection; photos use storage.upload."
      />

      {loading ? (
        <p className="mt-4 text-sm opacity-75">Loading profile…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3 sm:w-44">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-var(--line) bg-var(--panel) shadow-[3px_3px_0_var(--line)]">
              {avatarObjectUrl ? (
                <img src={avatarObjectUrl} alt="Your profile photo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-var(--foreground)/40">
                  {(displayName || fullUser.email).slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={PROFILE_ACCEPT_IMAGE}
              className="sr-only"
              tabIndex={-1}
              disabled={uploadBusy}
              onChange={(e) => void onAvatarChange(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={uploadBusy}
              loading={uploadBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              Change photo
            </Button>
            {avatarHint ? (
              <p className="max-w-[12rem] text-center text-xs text-amber-700 dark:text-amber-300">{avatarHint}</p>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Short bio…" />
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={saveBusy || uploadBusy} loading={saveBusy} onClick={onSave}>
                Save profile
              </Button>
              <Button variant="secondary" type="button" disabled={saveBusy || uploadBusy} onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
