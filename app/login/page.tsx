import Link from "next/link";
import LoginForm from "@/components/auth/login-form";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bip-page px-4">
      
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-bip-card p-8 shadow-none">
        
        <h1 className="text-center text-xl font-semibold text-white">
          
          BIP Client Manager
        </h1>
        <p className="mt-1 text-center text-sm text-white/50">
          
          Sign in to continue
        </p>
        <LoginForm error={error} />
        <p className="mt-6 text-center text-xs text-white/50">
          
          <Link href="/" className="text-white/75 underline hover:text-white">
            
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
