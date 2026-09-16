import { notFound, redirect } from "next/navigation";
import { loadClientExpectations } from "@/lib/onboarding/load-client-expectations";
import { createClient } from "@/lib/supabase/server";
import ClientDocumentEditor from "@/components/onboarding/client-document-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review & edit" };

/**
 * Reviewing and editing one client's document before it is printed.
 *
 * Open to anyone who can open the client, like the strategist note and the PDF
 * itself. Loads the document with this client's edits applied but left-out
 * sections kept, so they can be brought back.
 */
export default async function ClientDocumentPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const model = await loadClientExpectations(supabase, id, { edits: "editor" });
  if (!model) notFound();

  const generatedAt = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return <ClientDocumentEditor clientId={id} model={model} generatedAt={generatedAt} />;
}
