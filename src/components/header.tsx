import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMe } from "@/hooks/use-me";
import { logout } from "@/lib/auth.functions";
import { getWallets } from "@/lib/markets.functions";
import { formatMinor } from "@/lib/money";
import { TrendingUp, Wallet, Search, LogOut } from "lucide-react";
import { openAuthModal } from "@/lib/auth-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchWallets = useServerFn(getWallets);
  const doLogout = useServerFn(logout);

  const { data: wallets } = useQuery({
    queryKey: ["wallets", me?.id ?? "anon"],
    queryFn: () => fetchWallets(),
    enabled: !!me,
  });
  const ngn = wallets?.find((w) => w.currency === "NGN");

  async function signOut() {
    await doLogout();
    await qc.cancelQueries();
    qc.clear();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-lg">Foresight</span>
        </Link>

        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search markets"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value;
                navigate({ to: "/", search: { q: v || undefined, cat: undefined } });
              }
            }}
          />
        </div>

        <nav className="ml-auto flex items-center gap-2">
          {me ? (
            <>
              <Link
                to="/portfolio"
                className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground sm:flex"
              >
                Portfolio
              </Link>
              <Link
                to="/wallet"
                className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-sm hover:border-primary/50 sm:flex"
              >
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="tabular-nums">
                  {ngn ? formatMinor(ngn.balanceMinor, "NGN") : "₦0.00"}
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    aria-label="Account menu"
                  >
                    {me.username?.[0]?.toUpperCase() ?? "U"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/wallet">
                      <Wallet className="h-4 w-4" />
                      <span>Wallet</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut} className="cursor-pointer">
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuthModal("signup")}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Sign up
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
