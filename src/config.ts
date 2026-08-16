export interface Config {
  clientId: string;
  clientSecret: string;
  broadcasterUserId: string;
  broadcasterAccessToken: string;
  broadcasterRefreshToken: string;
  databasePath: string;
}

const REQUIRED_ENV_VARS = [
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "BROADCASTER_USER_ID",
  "BROADCASTER_ACCESS_TOKEN",
  "BROADCASTER_REFRESH_TOKEN",
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
  };
}
