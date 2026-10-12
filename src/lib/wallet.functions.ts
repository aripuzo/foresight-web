import { createServerFn } from "@tanstack/react-start";
import { apiAuthed } from "./api.server";
import type { Currency } from "./money";

export type Transaction = {
  id: string;
  entryId: string;
  kind: string;
  currency: Currency;
  amountMinor: string;
  createdAt: string;
};
export type Bank = { code: string; name: string };
export type BankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumberLast4: string;
  accountName: string;
};
export type DepositAccount = {
  currency: Currency;
  bankName: string;
  accountNumber: string;
  accountName: string;
};
export type KycResult = { status: "pending" | "verified"; kycTier: "unverified" | "verified" };
export type CheckoutDeposit = {
  intentId: string;
  currency: Currency;
  checkoutUrl: string;
  status: string;
};
// processing: sent to the bank. pending: provider outcome not confirmed yet, the backend retries.
// pending_approval: held for a quick review. needs_review: being checked by our team.
// A refused withdrawal (money returned) is a 502 WITHDRAWAL_FAILED error, not a status.
export type WithdrawalStatus =
  | "processing"
  | "pending"
  | "pending_approval"
  | "needs_review"
  | "succeeded";
export type WithdrawalResult = { payoutId: string; currency: Currency; status: WithdrawalStatus };

export const startKyc = createServerFn({ method: "POST" })
  .validator((d: { firstName: string; lastName: string; bvn?: string }) => d)
  .handler(async ({ data }): Promise<KycResult> => {
    return await apiAuthed("/v1/kyc/start", { method: "POST", body: JSON.stringify(data) });
  });

export const depositFiat = createServerFn({ method: "POST" })
  .validator((d: { amountMinor: string }) => d)
  .handler(async ({ data }): Promise<CheckoutDeposit> => {
    return await apiAuthed("/v1/deposits/fiat", { method: "POST", body: JSON.stringify(data) });
  });

export const getDepositAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<DepositAccount> => {
    return (await apiAuthed("/v1/deposits/bank-account", {
      method: "POST",
      body: "{}",
    })) as DepositAccount;
  },
);

export const listBanks = createServerFn({ method: "GET" }).handler(async (): Promise<Bank[]> => {
  const res = await apiAuthed("/v1/banks?currency=NGN");
  return (res.banks ?? []) as Bank[];
});

export const resolveBankAccount = createServerFn({ method: "POST" })
  .validator((d: { bankCode: string; accountNumber: string }) => d)
  .handler(async ({ data }): Promise<{ accountName: string }> => {
    return await apiAuthed("/v1/bank-accounts/resolve", {
      method: "POST",
      body: JSON.stringify(data),
    });
  });

export const addBankAccount = createServerFn({ method: "POST" })
  .validator((d: { bankCode: string; accountNumber: string }) => d)
  .handler(async ({ data }): Promise<BankAccount> => {
    const res = await apiAuthed("/v1/bank-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.bankAccount as BankAccount;
  });

export const listBankAccounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<BankAccount[]> => {
    const res = await apiAuthed("/v1/bank-accounts");
    return (res.bankAccounts ?? []) as BankAccount[];
  },
);

export const removeBankAccount = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await apiAuthed(`/v1/bank-accounts/${encodeURIComponent(data.id)}`, { method: "DELETE" });
    return { ok: true };
  });

export const withdrawFiat = createServerFn({ method: "POST" })
  .validator((d: { amountMinor: string; bankAccountId: string }) => d)
  .handler(async ({ data }): Promise<WithdrawalResult> => {
    return await apiAuthed("/v1/withdrawals/fiat", { method: "POST", body: JSON.stringify(data) });
  });

export const getTransactions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Transaction[]> => {
    const res = await apiAuthed("/v1/transactions");
    return (res.transactions ?? []) as Transaction[];
  },
);
