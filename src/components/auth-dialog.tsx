import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { login, signup } from "@/lib/auth.functions";
import { closeAuthModal, openAuthModal, useAuthModal } from "@/lib/auth-modal";

export function AuthDialog() {
  const mode = useAuthModal();
  const open = mode !== null;
  const isSignup = mode === "signup";
  const qc = useQueryClient();
  const doLogin = useServerFn(login);
  const doSignup = useServerFn(signup);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        await doSignup({ data: { email, username, password } });
        toast.success("Account created — welcome!");
      } else {
        await doLogin({ data: { email, password } });
      }
      await qc.invalidateQueries();
      closeAuthModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeAuthModal()}>
      <DialogContent className="max-w-md border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col">
          <BrandLogo variant="mark" className="self-center" />
          <h2 className="mt-4 text-center text-2xl font-bold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {isSignup ? "Trade on real-world outcomes." : "Sign in to trade."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary/60"
              />
            </div>
            {isSignup && (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary/60"
                />
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <PasswordInput
                required
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full font-semibold">
              {loading ? "..." : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => openAuthModal(isSignup ? "signin" : "signup")}
              className="text-primary hover:underline"
            >
              {isSignup ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
