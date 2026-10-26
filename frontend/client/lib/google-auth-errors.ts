/**
 * google-auth-errors.ts - Maps Google authentication error responses to clear, readable messages.
 */

export const GOOGLE_SCRIPT_LOAD_ERROR =
  "Google sign-in is unavailable. Check that this site's address is listed in the Google client's authorized origins.";

export interface ParsedGoogleAuthError {
  message: string;
  isAccountExists: boolean;
  code?: string;
  status?: number;
}

export function parseGoogleAuthError(err: unknown): ParsedGoogleAuthError {
  const errorObj = err as {
    code?: string;
    status?: number;
    message?: string;
  } | null;

  const code = errorObj?.code;
  const status = errorObj?.status;
  const rawMsg = errorObj?.message || "";

  // 1. Rate limiting (429)
  if (code === "RATE_LIMITED" || status === 429) {
    return {
      message: "Too many authentication attempts. Please wait a moment and try again.",
      isAccountExists: false,
      code: "RATE_LIMITED",
      status: 429,
    };
  }

  // 2. Google token invalid
  if (
    code === "GOOGLE_TOKEN_INVALID" ||
    (status === 401 && rawMsg.toLowerCase().includes("invalid google token"))
  ) {
    return {
      message: "Invalid Google token. Please try signing in again.",
      isAccountExists: false,
      code: "GOOGLE_TOKEN_INVALID",
      status: 401,
    };
  }

  // 3. Google email not verified
  if (
    code === "GOOGLE_EMAIL_NOT_VERIFIED" ||
    rawMsg.toLowerCase().includes("not verified")
  ) {
    return {
      message: "Your Google email is not verified. Please verify your email with Google first.",
      isAccountExists: false,
      code: "GOOGLE_EMAIL_NOT_VERIFIED",
      status: 401,
    };
  }

  // 4. Google email not supported (must be Gmail or Workspace)
  if (
    code === "GOOGLE_EMAIL_NOT_SUPPORTED" ||
    rawMsg.toLowerCase().includes("gmail or google workspace")
  ) {
    return {
      message: "Use a Gmail or Google Workspace account.",
      isAccountExists: false,
      code: "GOOGLE_EMAIL_NOT_SUPPORTED",
      status: 403,
    };
  }

  // 5. Account exists, use password
  if (
    code === "ACCOUNT_EXISTS_USE_PASSWORD" ||
    rawMsg.toLowerCase().includes("sign in with your password")
  ) {
    return {
      message:
        "An account with this email already exists. Sign in with your password, then link Google in your profile.",
      isAccountExists: true,
      code: "ACCOUNT_EXISTS_USE_PASSWORD",
      status: 409,
    };
  }

  // 6. Account disabled
  if (
    code === "ACCOUNT_DISABLED" ||
    rawMsg.toLowerCase().includes("disabled")
  ) {
    return {
      message: "This account has been disabled. Please contact an administrator.",
      isAccountExists: false,
      code: "ACCOUNT_DISABLED",
      status: 403,
    };
  }

  // 7. Google authentication disabled
  if (
    code === "GOOGLE_AUTH_DISABLED" ||
    status === 503 ||
    rawMsg.toLowerCase().includes("google authentication is currently disabled")
  ) {
    return {
      message: "Google authentication is currently disabled on this server.",
      isAccountExists: false,
      code: "GOOGLE_AUTH_DISABLED",
      status: 503,
    };
  }

  // 8. Google already linked to another account
  if (code === "GOOGLE_ALREADY_LINKED") {
    return {
      message: "This Google account is already linked to another GoHash account.",
      isAccountExists: false,
      code: "GOOGLE_ALREADY_LINKED",
      status: 409,
    };
  }

  // 9. Profile already linked to a different Google account
  if (code === "ALREADY_LINKED") {
    return {
      message: "A different Google account is already linked to this profile.",
      isAccountExists: false,
      code: "ALREADY_LINKED",
      status: 409,
    };
  }

  // 10. Network failure
  if (
    rawMsg.includes("Cannot reach the GoHash server") ||
    rawMsg.toLowerCase().includes("failed to fetch") ||
    rawMsg.toLowerCase().includes("networkerror")
  ) {
    return {
      message: "Cannot reach the GoHash server. Check that the backend is running.",
      isAccountExists: false,
      code: "NETWORK_ERROR",
    };
  }

  // Fallback to provided message or generic
  return {
    message: rawMsg || "Authentication failed. Please try again.",
    isAccountExists: false,
    code,
    status,
  };
}
