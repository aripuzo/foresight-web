import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await me();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  component: () => <Outlet />,
});
