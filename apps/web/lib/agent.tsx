"use client";

// Shared buyer state for the app shell: the connected wallet and the local budget with its runs.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, NETWORK, type AccountStatus } from "./api";
import { loadBudget, saveBudget, type Budget, type Run } from "./buyer";
import { connectWallet as connectSigner } from "./signer";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const PUBNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export interface AgentState {
  wallet: { address: string; account?: AccountStatus; wrongNetwork?: boolean } | null;
  connectWallet(): Promise<void>;
  refreshAccount(): Promise<void>;
  budget: Budget | null;
  updateBudget(b: Budget): void;
  recordRun(r: Run): void;
  error: string | null;
}

const AgentContext = createContext<AgentState | null>(null);

const fetchAccount = (address: string) => api<AccountStatus>(`/api/accounts/${address}`).catch(() => undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<AgentState["wallet"]>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBudget(loadBudget()), []);

  const updateBudget = useCallback((next: Budget) => {
    setBudget(next);
    saveBudget(next);
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);
    try {
      const { address, networkPassphrase } = await connectSigner();
      const expected = NETWORK === "stellar:pubnet" ? PUBNET_PASSPHRASE : TESTNET_PASSPHRASE;
      const wrongNetwork = networkPassphrase !== expected;
      setWallet({ address, wrongNetwork });
      const account = await fetchAccount(address);
      setWallet((w) => (w?.address === address ? { ...w, account } : w));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    const address = wallet?.address;
    if (!address) return;
    const account = await fetchAccount(address);
    if (account) setWallet((w) => (w?.address === address ? { ...w, account } : w));
  }, [wallet?.address]);

  // Functional update: a run can finish after other budget edits, so never write back a stale copy.
  const recordRun = useCallback((run: Run) => {
    setBudget((current) => {
      if (!current) return current;
      const next = { ...current, spentUnits: current.spentUnits + run.amountUnits, runs: [run, ...current.runs].slice(0, 50) };
      saveBudget(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ wallet, connectWallet, refreshAccount, budget, updateBudget, recordRun, error }),
    [wallet, connectWallet, refreshAccount, budget, updateBudget, recordRun, error],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentState {
  const agent = useContext(AgentContext);
  if (!agent) throw new Error("useAgent outside AgentProvider");
  return agent;
}
