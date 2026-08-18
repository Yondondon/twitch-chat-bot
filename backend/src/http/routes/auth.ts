import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Config } from "../../config.js";
import type { AuthProviders } from "../../twitch/auth.js";
import { resolveRole } from "../role.js";
import {
  issueSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "../session.js";

const OAUTH_STATE_COOKIE_NAME = "oauth_state";
const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_USERS_URL = "https://api.twitch.tv/helix/users";

interface TwitchTokenResponse {
  access_token: string;
}

interface TwitchUsersResponse {
  data: Array<{ id: string; login: string }>;
}

/**
 * Auth routes per contracts/api.md: the backend performs the OAuth
 * Authorization Code exchange itself (research.md §3) so the client secret
 * never reaches the browser. The signed-in user's own Twitch access token is
 * used only once, to look up their identity, and is not persisted — role is
 * resolved separately, live, from the broadcaster's own token (role.ts).
 */
export function registerAuthRoutes(
  app: FastifyInstance,
  config: Config,
  auth: AuthProviders,
): void {
  app.get("/api/auth/login", async (_request, reply) => {
    const state = randomBytes(16).toString("hex");
    reply.setCookie(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.uiOrigin.startsWith("https://"),
      path: "/",
      maxAge: 600,
    });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.twitchRedirectUri,
      response_type: "code",
      scope: "",
      state,
    });
    return reply.redirect(`${TWITCH_AUTHORIZE_URL}?${params.toString()}`);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/auth/callback",
    async (request, reply) => {
      const { code, state, error } = request.query;
      const expectedState = request.cookies[OAUTH_STATE_COOKIE_NAME];
      reply.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: "/" });

      if (error || !code || !state || state !== expectedState) {
        return reply.redirect(`${config.uiOrigin}/?auth_error=1`);
      }

      try {
        const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: config.twitchRedirectUri,
          }),
        });
        if (!tokenResponse.ok) {
          throw new Error(`Twitch token exchange failed: ${tokenResponse.status}`);
        }
        const token = (await tokenResponse.json()) as TwitchTokenResponse;

        const usersResponse = await fetch(TWITCH_USERS_URL, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            "Client-Id": config.clientId,
          },
        });
        if (!usersResponse.ok) {
          throw new Error(`Twitch users lookup failed: ${usersResponse.status}`);
        }
        const users = (await usersResponse.json()) as TwitchUsersResponse;
        const user = users.data[0];
        if (!user) {
          throw new Error("Twitch users lookup returned no user");
        }

        const sessionToken = await issueSessionToken(
          { id: user.id, login: user.login },
          config.sessionSecret,
        );
        reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: config.uiOrigin.startsWith("https://"),
          path: "/",
          maxAge: SESSION_TTL_SECONDS,
        });
        return reply.redirect(config.uiOrigin);
      } catch (err) {
        request.log.error(err, "Twitch OAuth callback failed");
        return reply.redirect(`${config.uiOrigin}/?auth_error=1`);
      }
    },
  );

  app.get("/api/auth/me", async (request) => {
    const sessionUser = await verifySessionToken(
      request.cookies[SESSION_COOKIE_NAME],
      config.sessionSecret,
    );
    if (!sessionUser) {
      return { authenticated: false, user: null, role: "anonymous" as const };
    }

    const role = await resolveRole(auth, config, sessionUser.id);
    return {
      authenticated: true,
      user: { id: sessionUser.id, login: sessionUser.login },
      role,
    };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.status(204).send();
  });
}
