import { redirect } from "next/navigation";

type Params = Promise<{ clientId: string }>;

export default async function ReportDraftPage({ params }: { params: Params }) {
  const { clientId } = await params;
  redirect(`/reports/${clientId}`);
}
