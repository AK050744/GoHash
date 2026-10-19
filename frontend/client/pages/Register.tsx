import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Lock, Mail, User, UserPlus } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
            <AlertDescription>{error}</AlertDescription>
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
