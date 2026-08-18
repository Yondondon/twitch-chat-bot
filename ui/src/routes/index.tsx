import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: me } = useQuery({ queryKey: ["auth", "me"], queryFn: api.getMe });

  return (
    <h1 className="text-2xl font-medium">
      {me?.authenticated ? `Welcome back, ${me.user?.login}.` : "Welcome."}
    </h1>
  );
}
