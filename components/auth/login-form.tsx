"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth/allowed-domain";
import AuthCard, { AuthInput, AuthButton, AuthError } from "./auth-card";

export default function LoginForm({
  error,
  fallback = false,
}: {
  error?: string;
  fallback?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const callbackError =
    error === "domain"
      ? `Use your @${ALLOWED_EMAIL_DOMAIN} Google account to sign in.`
      : error === "auth"
        ? "Authentication failed. Try signing in again."
        : null;

  async function handleGoogle() {
    setFormError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
      },
    });
    if (oauthError) {
      setGoogleLoading(false);
      setFormError(oauthError.message);
    }
    // On success the browser is redirected to Google — no further action here.
  }

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
    <AuthCard title="Welcome back" subtitle="Sign in to BIP Client Manager">
      <div className="mt-6 space-y-4">
        <AuthError message={formError ?? callbackError ?? null} />

        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-60"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          {googleLoading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
            </svg>
          )}
          Sign in with Google
        </button>

        {fallback && (
          <>
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>or use a password</span>
              <span className="h-px flex-1" style={{ background: "var(--border)" }} />
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
                  <Link href="/login/forgot-password" className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Forgot password?
                  </Link>
                </div>
              </div>
              <AuthButton loading={loading}>Sign in</AuthButton>
            </form>
          </>
        )}
      </div>
    </AuthCard>
  );
}
