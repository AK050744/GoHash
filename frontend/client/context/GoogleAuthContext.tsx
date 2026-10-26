/**
 * GoogleAuthContext.tsx – Manages Google OAuth dynamic configuration and provider lifecycle.
 *
 * Calls GET /api/auth/config on startup.
 * If googleEnabled is false, renders children directly and exposes googleEnabled: false.
 * If googleEnabled is true, wraps the application in GoogleOAuthProvider with the server-supplied clientId.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { api } from "@/lib/api";

interface GoogleAuthContextValue {
  googleEnabled: boolean;
  googleClientId: string | null;
  scriptLoaded: boolean;
  scriptLoadError: boolean;
  loading: boolean;
  setScriptLoadError: (error: boolean) => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextValue>({
  googleEnabled: false,
  googleClientId: null,
  scriptLoaded: false,
  scriptLoadError: false,
  loading: true,
  setScriptLoadError: () => {},
});

interface AuthConfigResponse {
  success: boolean;
  googleEnabled: boolean;
  googleClientId?: string;
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptLoadError, setScriptLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const res = await api.get<AuthConfigResponse>("/auth/config");
        if (!mounted) return;
        if (res.success && res.googleEnabled && res.googleClientId) {
          setGoogleEnabled(true);
          setGoogleClientId(res.googleClientId);
        } else {
          setGoogleEnabled(false);
          setGoogleClientId(null);
        }
      } catch {
        if (!mounted) return;
        setGoogleEnabled(false);
        setGoogleClientId(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  const contextValue: GoogleAuthContextValue = {
    googleEnabled,
    googleClientId,
    scriptLoaded,
    scriptLoadError,
    loading,
    setScriptLoadError,
  };

  // If Google is enabled and we have a valid clientId, wrap in GoogleOAuthProvider
  if (googleEnabled && googleClientId) {
    return (
      <GoogleOAuthProvider
        clientId={googleClientId}
        onScriptLoadSuccess={() => {
          setScriptLoaded(true);
          setScriptLoadError(false);
        }}
        onScriptLoadError={() => {
          setScriptLoaded(false);
          setScriptLoadError(true);
        }}
      >
        <GoogleAuthContext.Provider value={contextValue}>
          {children}
        </GoogleAuthContext.Provider>
      </GoogleOAuthProvider>
    );
  }

  // If disabled or loading, render without GoogleOAuthProvider
  return (
    <GoogleAuthContext.Provider value={contextValue}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth(): GoogleAuthContextValue {
  return useContext(GoogleAuthContext);
}
