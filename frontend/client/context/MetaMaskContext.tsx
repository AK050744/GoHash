import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ethers } from "ethers";

const EXPECTED_CHAIN_ID_DECIMAL = Number(
  import.meta.env.VITE_CHAIN_ID || import.meta.env.VITE_EXPECTED_CHAIN_ID || 31337
);
const EXPECTED_CHAIN_ID_HEX = "0x" + EXPECTED_CHAIN_ID_DECIMAL.toString(16);
const EXPECTED_CHAIN_NAME =
  import.meta.env.VITE_EXPECTED_CHAIN_NAME || "Hardhat Local";
const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export interface MetaMaskContextValue {
  isInstalled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  chainId: string | null;
  balance: string | null;
  isCorrectNetwork: boolean;
  expectedChainId: number;
  expectedChainHex: string;
  expectedChainName: string;
  error: string | null;
  connect: () => Promise<string | null>;
  switchNetwork: () => Promise<boolean>;
  refreshState: () => Promise<void>;
  clearError: () => void;
}

const MetaMaskContext = createContext<MetaMaskContextValue>({
  isInstalled: false,
  isConnected: false,
  isConnecting: false,
  account: null,
  chainId: null,
  balance: null,
  isCorrectNetwork: false,
  expectedChainId: EXPECTED_CHAIN_ID_DECIMAL,
  expectedChainHex: EXPECTED_CHAIN_ID_HEX,
  expectedChainName: EXPECTED_CHAIN_NAME,
  error: null,
  connect: async () => null,
  switchNetwork: async () => false,
  refreshState: async () => {},
  clearError: () => {},
});

export function MetaMaskProvider({ children }: { children: ReactNode }) {
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if ethereum is injected
  const getEthereum = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = typeof window !== "undefined" ? (window as any).ethereum : undefined;
    if (eth?.providers && Array.isArray(eth.providers)) {
      // Multiple wallets installed (e.g. Coinbase, Phantom, MetaMask)
      return eth.providers.find((p: { isMetaMask?: boolean }) => p.isMetaMask) || eth.providers[0];
    }
    return eth;
  }, []);

  const fetchBalance = useCallback(
    async (acc: string, providerEth: any) => {
      try {
        const provider = new ethers.BrowserProvider(providerEth);
        const balWei = await provider.getBalance(acc);
        const balEth = ethers.formatEther(balWei);
        setBalance(parseFloat(balEth).toFixed(4));
      } catch {
        setBalance(null);
      }
    },
    []
  );

  const refreshState = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setIsInstalled(false);
      setIsConnected(false);
      setAccount(null);
      setChainId(null);
      setBalance(null);
      return;
    }

    setIsInstalled(true);

    try {
      const accounts: string[] = await eth.request({ method: "eth_accounts" });
      const currentChain: string = await eth.request({ method: "eth_chainId" });

      setChainId(currentChain ? currentChain.toLowerCase() : null);

      if (accounts && accounts.length > 0 && accounts[0]) {
        const primaryAcc = accounts[0].toLowerCase();
        setAccount(primaryAcc);
        setIsConnected(true);
        void fetchBalance(primaryAcc, eth);
      } else {
        setAccount(null);
        setIsConnected(false);
        setBalance(null);
      }
    } catch {
      setIsConnected(false);
      setAccount(null);
      setBalance(null);
    }
  }, [getEthereum, fetchBalance]);

  useEffect(() => {
    void refreshState();

    const eth = getEthereum();
    if (!eth) {
      // Check after a brief delay in case extension injected asynchronously
      const timeout = setTimeout(() => {
        void refreshState();
      }, 500);

      const handleInitialized = () => {
        void refreshState();
      };
      window.addEventListener("ethereum#initialized", handleInitialized);

      return () => {
        clearTimeout(timeout);
        window.removeEventListener("ethereum#initialized", handleInitialized);
      };
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0 && accounts[0]) {
        const primaryAcc = accounts[0].toLowerCase();
        setAccount(primaryAcc);
        setIsConnected(true);
        void fetchBalance(primaryAcc, eth);
      } else {
        setAccount(null);
        setIsConnected(false);
        setBalance(null);
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId ? newChainId.toLowerCase() : null);
      if (account) {
        void fetchBalance(account, eth);
      }
    };

    eth.on?.("accountsChanged", handleAccountsChanged);
    eth.on?.("chainChanged", handleChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
      eth.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [getEthereum, refreshState, fetchBalance, account]);

  const connect = useCallback(async (): Promise<string | null> => {
    const eth = getEthereum();
    if (!eth) {
      setError("MetaMask is not installed. Please install the MetaMask extension to continue.");
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0 || !accounts[0]) {
        throw new Error("No accounts selected in MetaMask.");
      }

      const selected = accounts[0].toLowerCase();
      setAccount(selected);
      setIsConnected(true);

      const currentChain: string = await eth.request({ method: "eth_chainId" });
      setChainId(currentChain ? currentChain.toLowerCase() : null);

      void fetchBalance(selected, eth);
      return selected;
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Connection request was rejected in MetaMask.");
      } else {
        setError(err.message || "Failed to connect to MetaMask.");
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [getEthereum, fetchBalance]);

  const switchNetwork = useCallback(async (): Promise<boolean> => {
    const eth = getEthereum();
    if (!eth) {
      setError("MetaMask is not installed.");
      return false;
    }

    setError(null);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EXPECTED_CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchError: any) {
      // 4902 indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902 || switchError.message?.includes("Unrecognized chain ID")) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: EXPECTED_CHAIN_ID_HEX,
                chainName: EXPECTED_CHAIN_NAME,
                rpcUrls: [RPC_URL],
                nativeCurrency: {
                  name: "Ethereum",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });
          return true;
        } catch (addError: any) {
          setError(addError.message || "Failed to add network to MetaMask.");
          return false;
        }
      }
      setError(switchError.message || "Failed to switch network in MetaMask.");
      return false;
    }
  }, [getEthereum]);

  const clearError = () => setError(null);

  const isCorrectNetwork =
    Boolean(chainId) &&
    chainId?.toLowerCase() === EXPECTED_CHAIN_ID_HEX.toLowerCase();

  return (
    <MetaMaskContext.Provider
      value={{
        isInstalled,
        isConnected,
        isConnecting,
        account,
        chainId,
        balance,
        isCorrectNetwork,
        expectedChainId: EXPECTED_CHAIN_ID_DECIMAL,
        expectedChainHex: EXPECTED_CHAIN_ID_HEX,
        expectedChainName: EXPECTED_CHAIN_NAME,
        error,
        connect,
        switchNetwork,
        refreshState,
        clearError,
      }}
    >
      {children}
    </MetaMaskContext.Provider>
  );
}

export function useMetaMask() {
  return useContext(MetaMaskContext);
}
