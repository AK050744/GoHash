import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function formatWalletError(err: unknown): string {
  if (err && typeof err === "object") {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message ?? "";
    if (
      code === "WALLET_IN_USE" ||
      code === "WALLET_ALREADY_LINKED" ||
      msg.includes("WALLET_IN_USE") ||
      msg.includes("WALLET_ALREADY_LINKED") ||
      msg.toLowerCase().includes("already linked")
    ) {
      return "This wallet is linked to another GoHash account. In MetaMask select the notary account, then try again.";
    }
    if (msg.includes("user rejected") || msg.toLowerCase().includes("denied")) {
      return "Transaction was rejected in MetaMask.";
    }
    return msg || "Wallet action failed";
  }
  return "Wallet action failed";
}

export async function linkMetaMaskWallet(refreshUser: () => Promise<void>): Promise<string> {
  const nonceRes = await api.post<{ success: true; message: string }>("/auth/wallet/nonce");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask to continue.");
  }

  const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
  const address = accounts[0];
  if (!address) {
    throw new Error("No wallet account selected in MetaMask.");
  }

  const signature: string = await ethereum.request({
    method: "personal_sign",
    params: [nonceRes.message, address],
  });

  await api.patch("/auth/wallet", { walletAddress: address, signature });
  await refreshUser();
  return address;
}

export function useConnectedWallet(linkedAddress?: string | null) {
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    const queryAccounts = async () => {
      try {
        const accounts: string[] = await ethereum.request({ method: "eth_accounts" });
        setConnectedAccount(accounts[0] ? accounts[0].toLowerCase() : null);
      } catch {
        // Ignore
      }
    };

    void queryAccounts();

    const handleAccountsChanged = (accounts: string[]) => {
      setConnectedAccount(accounts[0] ? accounts[0].toLowerCase() : null);
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const isMismatch = Boolean(
    linkedAddress &&
      connectedAccount &&
      linkedAddress.toLowerCase() !== connectedAccount.toLowerCase()
  );

  return { connectedAccount, isMismatch };
}
