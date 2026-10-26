import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, Mail, Lock } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { useGoogleAuth } from "@/context/GoogleAuthContext";
import { api } from "@/lib/api";
import {
  parseGoogleAuthError,
  GOOGLE_SCRIPT_LOAD_ERROR,
} from "@/lib/google-auth-errors";

export default function Login() {
  const { login, loginWithToken } = useAuth();
  const { googleEnabled, scriptLoadError } = useGoogleAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccountExistsError, setIsAccountExistsError] = useState(false);

  const redirectByRole = (user: AuthUser) => {
    if (user.role === "ADMIN") {
      navigate("/admin/dashboard", { replace: true });
    } else if (user.role === "NOTARY") {
      navigate("/notary/dashboard", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsAccountExistsError(false);
    setLoading(true);
    try {
      const loggedUser = await login({ email, password });
      redirectByRole(loggedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Google sign-in failed: No credential received.");
      return;
    }

    setError(null);
    setIsAccountExistsError(false);
    setLoading(true);

    try {
      const data = await api.post<{
        success: true;
        token: string;
        user: AuthUser;
      }>("/auth/google", {
        credential: credentialResponse.credential,
      });

      loginWithToken(data.token, data.user);
      redirectByRole(data.user);
    } catch (err) {
      const parsed = parseGoogleAuthError(err);
      setError(parsed.message);
      setIsAccountExistsError(parsed.isAccountExists);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError(GOOGLE_SCRIPT_LOAD_ERROR);
  };

  return (
    <PageContainer className="flex flex-col items-center gap-8 pt-12 md:pt-16">
      <div className="w-full max-w-md">
        <PageHeader
          icon={<LogIn />}
          title="Log in"
          subtitle="Access your documents and notarization requests."
        />
      </div>

      <Card className="flex w-full max-w-md flex-col gap-6 p-6 md:p-8">
        {error && (
          <Alert variant="error">
            <AlertTitle>Login failed</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{error}</span>
              {isAccountExistsError && (
                <button
                  type="button"
                  onClick={() => {
                    const passInput = document.getElementById("login-password");
                    passInput?.focus();
                  }}
                  className="w-fit text-left text-sm font-bold text-navy underline hover:text-navy/80"
                >
                  Enter your password above
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              leadingIcon={<Mail />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              leadingIcon={<Lock />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={loading}
          >
            Log in
          </Button>
        </form>

        {googleEnabled && (
          <div className="flex flex-col gap-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-3 text-xs font-bold uppercase tracking-wider text-slate">
                or
              </span>
            </div>

            {scriptLoadError ? (
              <Alert variant="error">
                <AlertDescription>{GOOGLE_SCRIPT_LOAD_ERROR}</AlertDescription>
              </Alert>
            ) : (
              <div
                className={`flex w-full justify-center ${
                  loading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <GoogleLogin
                  text="continue_with"
                  shape="rectangular"
                  size="large"
                  theme="outline"
                  width="100%"
                  auto_select={false}
                  useOneTap={false}
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                />
              </div>
            )}
          </div>
        )}

        <p className="text-center text-sm font-medium text-slate">
          Need an account?{" "}
          <Link to="/register" className="py-3.5 font-bold text-navy underline">
            Register
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}

