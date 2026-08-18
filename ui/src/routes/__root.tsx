import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["auth", "me"], queryFn: api.getMe });

  const handleLogout = async () => {
    await api.logout();
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm font-medium [&.active]:text-primary">
              Home
            </Link>
            <Link to="/commands" className="text-sm font-medium [&.active]:text-primary">
              Commands
            </Link>
          </nav>
          <div>
            {me?.authenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{me.user?.login}</span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Sign out
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={api.login}>
                Sign in with Twitch
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
      <Toaster theme="dark" />
    </div>
  );
}
