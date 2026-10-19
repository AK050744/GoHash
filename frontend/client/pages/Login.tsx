import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, Mail, Lock } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedUser = await login({ email, password });
      if (loggedUser.role === "ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else if (loggedUser.role === "NOTARY") {
        navigate("/notary/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
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
            <AlertDescription>{error}</AlertDescription>
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
