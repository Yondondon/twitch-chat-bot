import { RefreshingAuthProvider } from "@twurple/auth";
import type { Config } from "../config.js";

export interface AuthProviders {
  /** Used for EventSub subscription creation, Helix calls, and sending chat replies — all as the broadcaster's own account (FR-013). */
  broadcasterAuthProvider: RefreshingAuthProvider;
}

/**
 * Builds the broadcaster's RefreshingAuthProvider. Twurple handles token
 * refresh transparently once the user is added with its initial token pair.
 * The same account is used for both reading and sending chat — there is no
 * separate bot account.
 */
export async function createAuthProviders(config: Config): Promise<AuthProviders> {
  const broadcasterAuthProvider = new RefreshingAuthProvider({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  await broadcasterAuthProvider.addUserForToken(
    {
      accessToken: config.broadcasterAccessToken,
      refreshToken: config.broadcasterRefreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    },
    ["chat"],
  );

  return { broadcasterAuthProvider };
}
