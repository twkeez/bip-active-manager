"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard, { AuthInput, AuthButton, AuthError } from "./auth-card";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard title="Set new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        <AuthError message={error} />
        <AuthInput label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        <AuthInput label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />
        <AuthButton loading={loading}>Set new password</AuthButton>
      </form>
    </AuthCard>
  );
}
