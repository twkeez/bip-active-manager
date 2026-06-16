"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
export default function LoginForm({ error }: { error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const authCallbackError =
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
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
      
      {(formError || authCallbackError) && (
        <p className="rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-sm text-bip-danger">
          
          {formError ?? authCallbackError}
        </p>
      )}
      <label className="block">
        
        <span className="mb-1 block text-xs font-medium text-white/75">
          
          Email
        </span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bip-input shadow-none"
        />
      </label>
      <label className="block">
        
        <span className="mb-1 block text-xs font-medium text-white/75">
          
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bip-input shadow-none"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-bip-card py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
      </button>
    </form>
  );
}
