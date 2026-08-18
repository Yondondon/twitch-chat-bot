import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Me } from "@/lib/api";

const { getMe, getCommands } = vi.hoisted(() => ({
  getMe: vi.fn(),
  getCommands: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, getMe, getCommands },
  };
});

const { CommandsPage } = await import("@/routes/commands");

const commands = {
  commands: [{ id: 1, trigger: "discord", replyText: "join us", updatedAt: "2026-01-01T00:00:00.000Z" }],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandsPage />
    </QueryClientProvider>,
  );
}

describe("CommandsPage", () => {
  it("shows the list with no management controls for an anonymous visitor (FR-002, FR-007)", async () => {
    getMe.mockResolvedValue({ authenticated: false, user: null, role: "anonymous" } satisfies Me);
    getCommands.mockResolvedValue(commands);

    renderPage();

    expect(await screen.findByText("!discord")).toBeInTheDocument();
    expect(screen.getByText("join us")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add command/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("shows the same read-only view for a signed-in non-mod/broadcaster user (US2)", async () => {
    getMe.mockResolvedValue({
      authenticated: true,
      user: { id: "1", login: "someviewer" },
      role: "other",
    } satisfies Me);
    getCommands.mockResolvedValue(commands);

    renderPage();

    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(await screen.findByText("!discord")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add command/i })).not.toBeInTheDocument();
  });

  it("shows management controls for the broadcaster (US1)", async () => {
    getMe.mockResolvedValue({
      authenticated: true,
      user: { id: "86177786", login: "streamer" },
      role: "broadcaster",
    } satisfies Me);
    getCommands.mockResolvedValue(commands);

    renderPage();

    expect(await screen.findByRole("button", { name: /add command/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("renders the command list even while the auth/me query is still pending (no sign-in gate on viewing)", async () => {
    getMe.mockReturnValue(new Promise(() => {}));
    getCommands.mockResolvedValue(commands);

    renderPage();

    expect(await screen.findByText("!discord")).toBeInTheDocument();
  });
});
