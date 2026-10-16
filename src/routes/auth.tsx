import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode = "signin" } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <AuthForm
            key={mode}
            mode={mode}
            onSuccess={() => navigate({ to: "/" })}
            onSwitch={(nextMode) => navigate({ to: "/auth", search: { mode: nextMode } })}
          />
        </div>
      </main>
    </div>
  );
}
