"use client";

// Shared buyer state for the app shell: wallet and budget. WP-0 stub with the final shape;
// WP-B moves the playground onto it.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, NETWORK, type AccountStatus } from "./api";
import { loadBudget, saveBudget, type Budget, type Run } from "./buyer";
import { connectWallet as connectSigner } from "./signer";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

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
      const wrongNetwork = NETWORK === "stellar:testnet" && networkPassphrase !== TESTNET_PASSPHRASE;
      const account = await api<AccountStatus>(`/api/accounts/${address}`).catch(() => undefined);
      setWallet({ address, account, wrongNetwork });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!wallet) return;
    const account = await api<AccountStatus>(`/api/accounts/${wallet.address}`).catch(() => wallet.account);
    setWallet({ ...wallet, account });
  }, [wallet]);

  const recordRun = useCallback(
    (run: Run) => {
      if (!budget) return;
      updateBudget({ ...budget, spentUnits: budget.spentUnits + run.amountUnits, runs: [run, ...budget.runs].slice(0, 20) });
    },
    [budget, updateBudget],
  );

  return (
    <AgentContext.Provider value={{ wallet, connectWallet, refreshAccount, budget, updateBudget, recordRun, error }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent(): AgentState {
  const agent = useContext(AgentContext);
  if (!agent) throw new Error("useAgent outside AgentProvider");
  return agent;
}
