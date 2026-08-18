import { ApiClient } from "@twurple/api";
import type { Config } from "../config.js";
import type { AuthProviders } from "../twitch/auth.js";
import type { ChatterRole } from "../commands/permissions.js";

/**
 * Resolves a signed-in dashboard user's role live from Twitch, on every call
 * — never cached — so a demotion/promotion takes effect immediately
 * (research.md §4, spec.md's role-freshness assumption). Mirrors the chat
 * path's `getChatterRole` (permissions.ts), which derives role from
 * per-message badges instead, since HTTP requests carry no such badges.
 */
export async function resolveRole(
  auth: AuthProviders,
  config: Config,
  twitchUserId: string,
): Promise<ChatterRole> {
  if (twitchUserId === config.broadcasterUserId) {
    return "broadcaster";
  }

  const apiClient = new ApiClient({ authProvider: auth.broadcasterAuthProvider });
  const isModerator = await apiClient.moderation.checkUserMod(
    config.broadcasterUserId,
    twitchUserId,
  );
  return isModerator ? "moderator" : "other";
}
