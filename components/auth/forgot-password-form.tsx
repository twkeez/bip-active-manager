"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard, { AuthInput, AuthButton, AuthError } from "./auth-card";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard title="Email sent" subtitle="Check your inbox for the reset link.">
        <div className="mt-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(0,201,167,0.15)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            If an account exists for {email}, you'll receive a reset link shortly.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-medium underline"
            style={{ color: "var(--primary)" }}
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle="Enter your email and we'll send you a link."
      footer={
        <Link href="/login" className="font-medium underline" style={{ color: "var(--primary)" }}>
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        <AuthError message={error} />
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required placeholder="you@beyondindigo.com" />
        <AuthButton loading={loading}>Send reset link</AuthButton>
      </form>
    </AuthCard>
  );
}
