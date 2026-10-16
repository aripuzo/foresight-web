import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { getWallets } from "@/lib/markets.functions";
import {
  startKyc,
  depositFiat,
  getDepositAccount,
  listBanks,
  resolveBankAccount,
  addBankAccount,
  listBankAccounts,
  removeBankAccount,
  withdrawFiat,
  getTransactions,
  type WithdrawalStatus,
} from "@/lib/wallet.functions";
import { toMinor, type Currency } from "@/lib/money";
import { Money } from "@/components/local-currency";
import { useMe } from "@/hooks/use-me";
import type { Me } from "@/lib/auth.functions";
import { ShieldCheck, Copy, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

const inputCls = "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none";
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function withdrawalMessage(status: WithdrawalStatus): string {
  switch (status) {
    case "pending_approval":
      return "Withdrawal requested — it will be sent after a quick review";
    case "needs_review":
      return "Withdrawal requested — it is being checked by our team";
    case "pending":
      return "Withdrawal in progress — we will update you once the bank confirms it";
    case "succeeded":
      return "Withdrawal sent";
    default:
      return "Withdrawal on its way";
  }
}

function WalletPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const fetchWallets = useServerFn(getWallets);
  const fetchTx = useServerFn(getTransactions);
  const walletsQ = useQuery({
    queryKey: ["wallets", me?.id ?? "anon"],
    queryFn: () => fetchWallets(),
    refetchInterval: 10_000,
  });
  const txQ = useQuery({
    queryKey: ["transactions", me?.id ?? "anon"],
    queryFn: () => fetchTx(),
    refetchInterval: 10_000,
  });
  const verified = me?.kycTier === "verified";
  // Legacy verified users may have no legal name on file; the backend lets them add it once.
  const needsName = !!me && (!me.legalFirstName || !me.legalLastName);

  async function refreshMoney() {
    await qc.invalidateQueries({ queryKey: ["wallets"] });
    await qc.invalidateQueries({ queryKey: ["transactions"] });
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1000px] px-4 py-8">
        <h1 className="text-2xl font-bold">Wallet</h1>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(walletsQ.data ?? []).map((w) => (
            <div key={w.currency} className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {w.currency}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                <Money minor={w.balanceMinor} currency={w.currency} />
              </div>
            </div>
          ))}
        </div>

        {(!verified || needsName) && <KycBanner verified={verified} me={me} />}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DepositSection verified={verified} />
          <WithdrawSection verified={verified} onDone={refreshMoney} />
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent transactions
        </h2>
        {(txQ.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <tbody>
                {(txQ.data ?? []).map((t) => {
                  const neg = BigInt(t.amountMinor) < 0n;
                  const abs = (neg ? -BigInt(t.amountMinor) : BigInt(t.amountMinor)).toString();
                  return (
                    <tr key={t.id} className="border-t border-border first:border-t-0">
                      <td className="p-3 capitalize">{t.kind.replace(/_/g, " ")}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td
                        className={"p-3 text-right tabular-nums " + (neg ? "text-no" : "text-yes")}
                      >
                        {neg ? "−" : "+"}
                        <Money minor={abs} currency={t.currency as Currency} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function KycBanner({ verified, me }: { verified: boolean; me: Me | null }) {
  const qc = useQueryClient();
  const doKyc = useServerFn(startKyc);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bvn, setBvn] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (busy) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Enter your legal first and last name");
      return;
    }
    const cleanBvn = bvn.trim();
    if (cleanBvn && !/^\d{11}$/.test(cleanBvn)) {
      toast.error("BVN must be 11 digits, or leave it blank");
      return;
    }
    setBusy(true);
    try {
      const r = await doKyc({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          ...(cleanBvn ? { bvn: cleanBvn } : {}),
        },
      });
      setBvn("");
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["deposit-account"] });
      if (verified) toast.success("Legal name saved");
      else if (r.kycTier === "verified") toast.success("Identity verified");
      else
        toast.message("Verification in progress — we will update your account when it completes");
    } catch (e) {
      // Names may have been saved even though the BVN check failed.
      toast.error(errMsg(e, verified ? "Could not save your name" : "Verification failed"));
      void qc.invalidateQueries({ queryKey: ["me"] }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div className="text-sm">
          <div className="font-semibold">
            {verified ? "Add your legal name" : "Verify your identity"}
          </div>
          <div className="text-muted-foreground">
            {verified
              ? "Your account is verified, but we still need your legal name for bank-transfer deposits. Use the name on your bank account. It cannot be changed later."
              : "Use the name on your bank account. Needed for withdrawals and bank-transfer deposits, and to lift deposit caps."}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          placeholder="Legal first name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputCls}
        />
        <input
          placeholder="Legal last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputCls}
        />
        <Button onClick={verify} disabled={busy} className="h-10 sm:w-32">
          {busy ? "Submitting…" : verified ? "Save name" : "Verify"}
        </Button>
      </div>
      {me?.bvnVerified ? (
        <p className="mt-2 text-xs text-muted-foreground">BVN ending {me.bvnLast4} verified</p>
      ) : (
        <div className="mt-2">
          <input
            placeholder="BVN (optional)"
            aria-label="BVN (optional)"
            inputMode="numeric"
            autoComplete="off"
            aria-describedby="bvn-help"
            value={bvn}
            onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
            className={`${inputCls} sm:max-w-xs`}
          />
          <p id="bvn-help" className="mt-1 text-xs text-muted-foreground">
            Used to confirm your identity with our banking partner. We only keep the last 4 digits.
          </p>
        </div>
      )}
    </div>
  );
}

function DepositSection({ verified }: { verified: boolean }) {
  const doDeposit = useServerFn(depositFiat);
  const fetchAccount = useServerFn(getDepositAccount);
  const accountQ = useQuery({
    queryKey: ["deposit-account"],
    queryFn: () => fetchAccount(),
    enabled: verified,
    staleTime: Infinity,
    retry: false,
  });
  const [amt, setAmt] = useState("5000");
  const [busy, setBusy] = useState(false);
  const acct = accountQ.data;

  async function checkout() {
    if (busy) return;
    const num = Number(amt);
    if (!amt || isNaN(num) || num <= 0) {
      toast.error("Please enter a valid deposit amount");
      return;
    }
    setBusy(true);
    try {
      const res = await doDeposit({ data: { amountMinor: toMinor(num, "NGN") } });
      if (!res.checkoutUrl) throw new Error("Checkout is unavailable. Please try again or use bank transfer.");
      window.location.assign(res.checkoutUrl);
    } catch (e) {
      toast.error(errMsg(e, "Deposit failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Deposit Naira">
      <div className="space-y-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bank transfer
          </div>
          {!verified ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Verify your identity to get your own deposit account.
            </p>
          ) : accountQ.isLoading ? (
            <p className="mt-1 text-sm text-muted-foreground">Loading your account…</p>
          ) : acct ? (
            <div className="mt-2 rounded-md bg-surface p-3 text-sm">
              <div className="text-muted-foreground">{acct.bankName}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">{acct.accountNumber}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(acct.accountNumber);
                    toast.success("Account number copied");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copy account number"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="text-muted-foreground">{acct.accountName}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Transfers to this account land in your wallet automatically.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-no">
              {errMsg(accountQ.error, "Could not load your deposit account")}
            </p>
          )}
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Online checkout
          </div>
          <div className="mt-2 flex items-center rounded-md border border-border bg-surface px-3">
            <span className="text-muted-foreground">₦</span>
            <input
              type="number"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              className="w-full bg-transparent py-2.5 pl-1 text-sm tabular-nums outline-none"
            />
          </div>
          <Button onClick={checkout} disabled={busy} variant="outline" className="mt-3 h-10 w-full">
            {busy ? "Starting checkout…" : "Continue to checkout"}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function WithdrawSection({ verified, onDone }: { verified: boolean; onDone: () => Promise<void> }) {
  const qc = useQueryClient();
  const fetchBanks = useServerFn(listBanks);
  const fetchAccounts = useServerFn(listBankAccounts);
  const doResolve = useServerFn(resolveBankAccount);
  const doAdd = useServerFn(addBankAccount);
  const doRemove = useServerFn(removeBankAccount);
  const doWithdraw = useServerFn(withdrawFiat);
  const accountsQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => fetchAccounts(),
    enabled: verified,
  });
  const banksQ = useQuery({
    queryKey: ["banks"],
    queryFn: () => fetchBanks(),
    enabled: verified,
    staleTime: 3_600_000,
  });

  const [selected, setSelected] = useState("");
  const [amt, setAmt] = useState("");
  const [adding, setAdding] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!verified) {
    return (
      <Section title="Withdraw to bank">
        <p className="text-sm text-muted-foreground">Verify your identity to withdraw.</p>
      </Section>
    );
  }

  const accounts = accountsQ.data ?? [];
  const hasBanks = (banksQ.data?.length ?? 0) > 0;
  const chosen = accounts.some((a) => a.id === selected) ? selected : (accounts[0]?.id ?? "");

  async function resolve() {
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      toast.error("Pick a bank and enter a 10-digit account number");
      return;
    }
    try {
      setResolvedName((await doResolve({ data: { bankCode, accountNumber } })).accountName);
    } catch (e) {
      setResolvedName(null);
      toast.error(errMsg(e, "Could not verify that account"));
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const a = await doAdd({ data: { bankCode, accountNumber } });
      await qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setSelected(a.id);
      setAdding(false);
      setBankCode("");
      setAccountNumber("");
      setResolvedName(null);
      toast.success(
        "Bank account saved. Withdrawals to it in the next 24 hours are reviewed first.",
      );
    } catch (e) {
      toast.error(errMsg(e, "Could not save the account"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await doRemove({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    } catch (e) {
      toast.error(errMsg(e, "Could not remove the account"));
    }
  }

  async function withdraw() {
    const num = Number(amt);
    if (busy) return;
    if (!chosen) {
      toast.error("Add a bank account first");
      return;
    }
    if (!amt || isNaN(num) || num <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const r = await doWithdraw({
        data: { amountMinor: toMinor(num, "NGN"), bankAccountId: chosen },
      });
      setAmt("");
      toast.success(withdrawalMessage(r.status));
    } catch (e) {
      toast.error(errMsg(e, "Withdrawal failed"));
    } finally {
      // A refused withdrawal debits then refunds, so refresh on failure too.
      try {
        await onDone();
      } catch {
        // refresh failure should not mask the withdrawal outcome
      }
      setBusy(false);
    }
  }

  return (
    <Section title="Withdraw to bank">
      <div className="space-y-3">
        {accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map((a) => (
              <label
                key={a.id}
                className={
                  "flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm " +
                  (chosen === a.id ? "border-primary bg-primary/10" : "border-border")
                }
              >
                <input
                  type="radio"
                  name="bank-account"
                  checked={chosen === a.id}
                  onChange={() => setSelected(a.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">
                    {a.bankName} ••{a.accountNumberLast4}
                  </div>
                  <div className="text-muted-foreground">{a.accountName}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    remove(a.id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </label>
            ))}
          </div>
        )}

        {adding || accounts.length === 0 ? (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <select
              aria-label="Choose your bank"
              value={bankCode}
              disabled={!hasBanks}
              onChange={(e) => {
                setBankCode(e.target.value);
                setResolvedName(null);
              }}
              className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
            >
              <option value="">
                {banksQ.isLoading ? "Loading banks…" : hasBanks ? "Choose your bank" : "Banks unavailable"}
              </option>
              {(banksQ.data ?? []).map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            {!banksQ.isLoading && !hasBanks && (
              <div role="alert" className="flex items-center justify-between gap-3 text-sm">
                <p className="text-no">Could not load banks. Please try again.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={banksQ.isFetching}
                  onClick={() => banksQ.refetch()}
                >
                  {banksQ.isFetching ? "Loading…" : "Retry"}
                </Button>
              </div>
            )}
            <input
              placeholder="10-digit account number"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
                setResolvedName(null);
              }}
              className={inputCls}
            />
            {resolvedName ? (
              <>
                <p className="text-sm">
                  Account name: <span className="font-semibold">{resolvedName}</span>
                </p>
                <Button onClick={save} disabled={busy} className="h-10 w-full">
                  {busy ? "Saving…" : "Save this account"}
                </Button>
              </>
            ) : (
              <Button
                onClick={resolve}
                disabled={!hasBanks || !bankCode || accountNumber.length !== 10}
                variant="outline"
                className="h-10 w-full"
              >
                Verify account
              </Button>
            )}
          </div>
        ) : (
          accounts.length < 3 && (
            <button
              onClick={() => setAdding(true)}
              className="text-sm text-primary hover:underline"
            >
              + Add another bank account
            </button>
          )
        )}

        {accounts.length > 0 && (
          <>
            <input
              placeholder="Amount (₦)"
              type="number"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              className={inputCls}
            />
            <Button onClick={withdraw} disabled={busy} className="h-10 w-full">
              {busy ? "Requesting…" : "Request withdrawal"}
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}
