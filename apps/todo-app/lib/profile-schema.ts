import { z } from "zod";

export const AVATAR_BUCKET = "avatars";

export const PROFILE_ACCEPT_IMAGE = "image/jpeg,image/png,image/gif,image/webp";

export const ProfileRowSchema = z.object({
  displayName: z.string(),
  bio: z.string().optional(),
  avatarFileId: z.string().optional(),
  updatedAt: z.string(),
});

export type ProfileData = z.infer<typeof ProfileRowSchema>;

export function defaultDisplayName(email: string, custom?: Record<string, string>): string {
  const fromAuth = custom?.displayName?.trim();
  if (fromAuth) return fromAuth;
  const local = email.split("@")[0] ?? "User";
  return local || "User";
}
