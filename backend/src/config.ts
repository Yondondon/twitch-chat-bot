export interface Config {
  clientId: string;
  clientSecret: string;
  broadcasterUserId: string;
  broadcasterAccessToken: string;
  broadcasterRefreshToken: string;
  databasePath: string;
  /** Must exactly match a redirect URI registered on the Twitch app (research.md §3). */
  twitchRedirectUri: string;
  /** Signs the dashboard's session cookie (research.md §3). */
  sessionSecret: string;
  /** Origin the UI is served from — used for CORS and the post-login redirect. */
  uiOrigin: string;
  /** Port the dashboard's HTTP API listens on. */
  httpPort: number;
}

const REQUIRED_ENV_VARS = [
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "BROADCASTER_USER_ID",
  "BROADCASTER_ACCESS_TOKEN",
  "BROADCASTER_REFRESH_TOKEN",
  "TWITCH_REDIRECT_URI",
  "SESSION_SECRET",
  "UI_ORIGIN",
] as const;

/**
 * Loads and validates the bot's configuration from environment variables.
 * Throws immediately if a required value is missing, rather than letting the
 * bot start in a half-configured state.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  return {
    clientId: env.TWITCH_CLIENT_ID!,
    clientSecret: env.TWITCH_CLIENT_SECRET!,
    broadcasterUserId: env.BROADCASTER_USER_ID!,
    broadcasterAccessToken: env.BROADCASTER_ACCESS_TOKEN!,
    broadcasterRefreshToken: env.BROADCASTER_REFRESH_TOKEN!,
    databasePath: env.DATABASE_PATH ?? "./data/bot.sqlite",
    twitchRedirectUri: env.TWITCH_REDIRECT_URI!,
    sessionSecret: env.SESSION_SECRET!,
    uiOrigin: env.UI_ORIGIN!,
    httpPort: Number(env.HTTP_PORT ?? "8787"),
  };
}
