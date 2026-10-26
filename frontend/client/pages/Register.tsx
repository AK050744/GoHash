import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Lock, Mail, User, UserPlus } from "lucide-react";
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

export default function Register() {
  const { register, loginWithToken } = useAuth();
  const { googleEnabled, scriptLoadError } = useGoogleAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register({ name, email, password, confirmPassword });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
          icon={<UserPlus />}
          title="Create an account"
          subtitle="Register to upload and track documents."
        />
      </div>

      <Card className="flex w-full max-w-md flex-col gap-6 p-6 md:p-8">
        {error && (
          <Alert variant="error">
            <AlertTitle>Registration failed</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{error}</span>
              {isAccountExistsError && (
                <Link
                  to="/login"
                  className="w-fit text-sm font-bold text-navy underline hover:text-navy/80"
                >
                  Sign in with your password
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="register-name">Full name</Label>
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              placeholder="Alice Doe"
              leadingIcon={<User />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
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
            <Label htmlFor="register-password">Password</Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password (min 8 chars)"
              leadingIcon={<Lock />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="register-confirm">Confirm password</Label>
            <Input
              id="register-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              leadingIcon={<Lock />}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            Create account
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

        <p className="flex items-start gap-2 text-sm font-medium text-slate">
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          GoHash never asks for your private key or seed phrase.
        </p>

        <p className="text-center text-sm font-medium text-slate">
          Already registered?{" "}
          <Link to="/login" className="py-3.5 font-bold text-navy underline">
            Log in
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}

