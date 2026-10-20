import { api } from "@/lib/api";

export interface FeeConfig {
  enabled: boolean;
  amountEth?: string;
  amountWei?: string;
  recipient?: string;
  chainId?: number;
  symbol?: string;
}

let cachedFeeConfig: FeeConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000;

export async function getFeeConfig(forceRefresh = false): Promise<FeeConfig> {
  const now = Date.now();
  if (!forceRefresh && cachedFeeConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedFeeConfig;
  }

  try {
    const res = await api.get<{
      success: true;
      enabled: boolean;
      amountEth?: string;
      amountWei?: string;
      recipient?: string;
      chainId?: number;
      symbol?: string;
    }>("/config/fees");

    const config: FeeConfig = {
      enabled: Boolean(res.enabled),
      amountEth: res.amountEth,
      amountWei: res.amountWei,
      recipient: res.recipient,
      chainId: res.chainId,
      symbol: res.symbol ?? "ETH",
    };

    cachedFeeConfig = config;
    lastFetchTime = now;
    return config;
  } catch {
    // If endpoint fails, default to disabled to not block UI
    return { enabled: false };
  }
}

export function mapPaymentError(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Payment failed. Please try again.";
  }

  const errObj = err as {
    code?: string | number;
    message?: string;
    details?: { reason?: string };
    status?: number;
  };

  const code = String(errObj.code ?? "");
  const msg = errObj.message ?? "";
  const reason = errObj.details?.reason ?? "";

  // User rejection in MetaMask
  if (
    code === "4001" ||
    code === "ACTION_REJECTED" ||
    msg.toLowerCase().includes("user rejected") ||
    msg.toLowerCase().includes("denied")
  ) {
    return "Transaction was rejected in MetaMask.";
  }

  // Known backend API codes
  if (code === "WALLET_NOT_LINKED" || msg.includes("WALLET_NOT_LINKED")) {
    return "Your wallet is not linked to your GoHash account. Link your wallet before submitting payment.";
  }

  if (code === "FEE_NOT_ENABLED" || msg.includes("FEE_NOT_ENABLED")) {
    return "Notarization fees are currently disabled on this network.";
  }

  if (code === "PAYMENT_ALREADY_USED" || msg.includes("PAYMENT_ALREADY_USED")) {
    return "This payment transaction hash has already been used for another notarization.";
  }

  if (code === "ALREADY_PAID" || msg.includes("ALREADY_PAID")) {
    return "This notarization request has already been paid.";
  }

  if (code === "PAYMENT_REQUIRED" || msg.includes("PAYMENT_REQUIRED")) {
    return "A notarization fee is required before this request can be approved.";
  }

  // PAYMENT_INVALID with reasons
  if (code === "PAYMENT_INVALID" || msg.includes("PAYMENT_INVALID") || reason) {
    const activeReason =
      reason ||
      (msg.includes("TX_NOT_FOUND")
        ? "TX_NOT_FOUND"
        : msg.includes("TX_REVERTED")
          ? "TX_REVERTED"
          : msg.includes("WRONG_CHAIN")
            ? "WRONG_CHAIN"
            : msg.includes("WRONG_RECIPIENT")
              ? "WRONG_RECIPIENT"
              : msg.includes("WRONG_PAYER")
                ? "WRONG_PAYER"
                : msg.includes("AMOUNT_TOO_LOW")
                  ? "AMOUNT_TOO_LOW"
                  : msg.includes("NOT_A_PLAIN_TRANSFER")
                    ? "NOT_A_PLAIN_TRANSFER"
                    : "");

    switch (activeReason) {
      case "TX_NOT_FOUND":
        return "Transaction not found on-chain. Please verify the transaction hash or wait for block confirmation.";
      case "TX_REVERTED":
        return "The payment transaction failed or reverted on the blockchain.";
      case "WRONG_CHAIN":
        return "The payment transaction was broadcast on the wrong blockchain network.";
      case "WRONG_RECIPIENT":
        return "The transaction was sent to an incorrect address. It must be sent directly to the fee recipient.";
      case "WRONG_PAYER":
        return "The payment was sent from an unlinked address. You must pay from your linked GoHash wallet.";
      case "AMOUNT_TOO_LOW":
        return "The transferred amount is less than the required notarization fee.";
      case "NOT_A_PLAIN_TRANSFER":
        return "The transaction contained contract call data. Only plain ETH transfers are accepted.";
      default:
        return `Payment validation failed: ${msg || "Invalid transaction"}`;
    }
  }

  if (msg.includes("insufficient funds")) {
    return "Insufficient test ETH in your MetaMask wallet to cover the fee and network gas.";
  }

  return msg || "Payment processing failed. Please try again.";
}
