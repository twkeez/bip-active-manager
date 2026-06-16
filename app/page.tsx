import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bip-page px-6">
      
      <main className="max-w-md text-center">
        
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          
          BIP Control Panel
        </h1>
        <p className="mt-2 text-sm text-white/50">
          
          Internal dashboard for client accounts, integrations, and marketing
          ops.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          
          <Link
            href="/login"
            className="rounded-lg bg-bip-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-bip-accent"
          >
            
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
