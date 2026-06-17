"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard, { AuthInput, AuthButton, AuthError } from "./auth-card";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (signupError) { setError(signupError.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <AuthCard title="Check your email" subtitle="We sent a confirmation link to activate your account.">
        <div className="mt-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(0,201,167,0.15)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#00c9a7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Click the link in your email to confirm your address, then sign in.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-medium underline"
            style={{ color: "#00c9a7" }}
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Join BIP Client Manager"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline" style={{ color: "#00c9a7" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        <AuthError message={error} />
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required placeholder="you@beyondindigo.com" />
        <AuthInput label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        <AuthInput label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
        <AuthButton loading={loading}>Create account</AuthButton>
      </form>
    </AuthCard>
  );
}
