export interface Command {
  id: number;
  trigger: string;
  replyText: string;
  updatedAt: string;
}

export type Role = "broadcaster" | "moderator" | "other" | "anonymous";

export interface Me {
  authenticated: boolean;
  user: { id: string; login: string } | null;
  role: Role;
}

export class ApiError extends Error {
  status: number;
  body: { error: string; field?: string };

  constructor(status: number, body: { error: string; field?: string }) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    // Only set Content-Type when there's an actual body — Fastify's default
    // JSON parser rejects an empty body when this header is present (as on
    // DELETE and the bodiless logout POST), producing a spurious 400.
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "unknown" }));
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getCommands: () => request<{ commands: Command[] }>("/commands"),

  createCommand: (input: { trigger: string; replyText: string }) =>
    request<{ command: Command }>("/commands", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateCommand: (id: number, input: { trigger?: string; replyText?: string }) =>
    request<{ command: Command }>(`/commands/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteCommand: (id: number) =>
    request<void>(`/commands/${id}`, { method: "DELETE" }),

  getMe: () => request<Me>("/auth/me"),

  login: () => {
    window.location.href = "/api/auth/login";
  },

  logout: () => request<void>("/auth/logout", { method: "POST" }),
};
