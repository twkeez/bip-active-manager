import Link from "next/link";
import { ArrowLeft, MapPinOff } from "lucide-react";

/**
 * Shown when someone opens Reputation for a client that has no Google Place ID.
 * The tool genuinely can't run without one, and the honest dead end is safer
 * than quietly showing a different client's reviews.
 */
export default function ReputationUnavailable({
  clientName,
  clientId,
}: {
  clientName: string | null;
  clientId: number;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bip-page">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <div className="rounded-xl border border-bip-border bg-bip-card p-8">
          <MapPinOff className="h-6 w-6 text-bip-muted" aria-hidden />
          <h1 className="mt-4 text-lg font-semibold text-bip-text">
            Reputation isn&apos;t set up for {clientName ?? "this client"}
          </h1>
          <p className="mt-2 text-sm text-bip-muted">
            This tool reads reviews from the client&apos;s Google Business
            Profile, and {clientName ?? "this client"} doesn&apos;t have a Google
            Place ID on file yet. Add one on the client&apos;s Profile tab and
            this page will work.
          </p>
          <Link
            href={`/dashboard/clients/${clientId}?tab=profile`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-bip-border px-4 py-2 text-sm font-medium text-bip-text transition hover:bg-bip-page"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to {clientName ?? "the client"}
          </Link>
        </div>
      </main>
    </div>
  );
}
