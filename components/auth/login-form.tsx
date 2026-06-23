"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard, { AuthInput, AuthButton, AuthError } from "./auth-card";

export default function LoginForm({ error }: { error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const callbackError =
    error === "auth" ? "Authentication failed. Try signing in again." : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signError) {
      setFormError(signError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to BIP Client Manager"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        <AuthError message={formError ?? callbackError ?? null} />
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          placeholder="you@beyondindigo.com"
        />
        <div className="space-y-1.5">
          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end">
            <Link
              href="/login/forgot-password"
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <AuthButton loading={loading}>Sign in</AuthButton>
      </form>
    </AuthCard>
  );
}
