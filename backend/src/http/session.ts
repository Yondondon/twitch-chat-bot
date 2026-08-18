import { SignJWT, jwtVerify } from "jose";

export interface SessionUser {
  id: string;
  login: string;
}

const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Issues a signed JWT identifying who is signed in — no role is embedded,
 * since role is always re-derived live from Twitch on each management
 * action (research.md §3/§4).
 */
export async function issueSessionToken(user: SessionUser, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ login: user.login })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}

/** Returns the identified user, or null if the token is missing/invalid/expired. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    if (typeof payload.sub !== "string" || typeof payload.login !== "string") {
      return null;
    }
    return { id: payload.sub, login: payload.login };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
