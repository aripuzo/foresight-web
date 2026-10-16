import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { login, requestSignupCode, signup } from "@/lib/auth.functions";

type Mode = "signin" | "signup";

export function AuthForm({
  mode,
  onSuccess,
  onSwitch,
}: {
  mode: Mode;
  onSuccess: () => void;
  onSwitch: (mode: Mode) => void;
}) {
  const isSignup = mode === "signup";
  const qc = useQueryClient();
  const doLogin = useServerFn(login);
  const doSignup = useServerFn(signup);
  const requestCode = useServerFn(requestSignupCode);
  const id = useId();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string } | null>(null);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  async function sendCode() {
    const result = await requestCode({ data: { email } });
    setChallenge({ challengeId: result.challengeId });
    setCode("");
    setResendAt(Date.now() + result.resendAfterSeconds * 1000);
    setSecondsLeft(result.resendAfterSeconds);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSignup && !challenge) {
        await sendCode();
        return;
      }
      if (isSignup && challenge) {
        await doSignup({
          data: { email, username, password, challengeId: challenge.challengeId, code },
        });
        toast.success("Email verified — welcome to Foresight!");
      } else {
        await doLogin({ data: { email, password } });
      }
      setPassword("");
      await qc.invalidateQueries();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError("");
    try {
      await sendCode();
      toast.success("A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary/60";
  const labelClass = "text-xs uppercase tracking-wider text-muted-foreground";

  return (
    <div className="flex flex-col">
      <BrandLogo variant="mark" className="self-center" />
      <h2 className="mt-4 text-center text-2xl font-bold tracking-tight">
        {challenge ? "Verify your email" : isSignup ? "Create your account" : "Welcome back"}
      </h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {challenge ? (
          <>
            Enter the six-digit code sent to{" "}
            <strong className="break-all text-foreground">{email}</strong>. The code expires in 10
            minutes.
          </>
        ) : isSignup ? (
          "Verify your email to start trading."
        ) : (
          "Sign in to trade."
        )}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        {challenge ? (
          <div>
            <label htmlFor={`${id}-code`} className={labelClass}>
              Verification code
            </label>
            <input
              id={`${id}-code`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputClass} text-center font-mono text-xl tracking-[0.4em]`}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Check your spam folder if the email has not arrived.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor={`${id}-email`} className={labelClass}>
                Email
              </label>
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            {isSignup && (
              <div>
                <label htmlFor={`${id}-username`} className={labelClass}>
                  Username
                </label>
                <input
                  id={`${id}-username`}
                  type="text"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label htmlFor={`${id}-password`} className={labelClass}>
                Password
              </label>
              <PasswordInput
                id={`${id}-password`}
                required
                minLength={isSignup ? 8 : 1}
                maxLength={128}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full font-semibold">
          {loading
            ? "Please wait…"
            : challenge
              ? "Verify email and create account"
              : isSignup
                ? "Send verification code"
                : "Sign in"}
        </Button>
      </form>
      {challenge && (
        <div className="mt-4 flex flex-col items-center gap-3 text-sm">
          <button
            type="button"
            disabled={loading || secondsLeft > 0}
            onClick={resend}
            className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Change email or signup details
          </button>
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New here? "}
        <button
          type="button"
          disabled={loading}
          onClick={() => onSwitch(isSignup ? "signin" : "signup")}
          className="text-primary hover:underline"
        >
          {isSignup ? "Sign in" : "Create account"}
        </button>
      </p>
    </div>
  );
}
