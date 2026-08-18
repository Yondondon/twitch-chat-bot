import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import type { Config } from "../config.js";

/** Builds the dashboard's Fastify instance with CORS + cookie support registered; routes are added by the caller (server-entry.ts). */
export async function buildServer(config: Config): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.VITEST !== "true" });

  await app.register(cors, {
    origin: config.uiOrigin,
    credentials: true,
  });

  await app.register(cookie);

  return app;
}
