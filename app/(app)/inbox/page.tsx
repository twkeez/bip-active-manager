import { redirect } from "next/navigation";
import InboxManager from "@/components/inbox/inbox-manager";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return <InboxManager userEmail={user.email} />;
}
