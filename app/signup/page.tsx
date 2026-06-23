import { redirect } from "next/navigation";

// Public self-signup is disabled — accounts are invite-only (admins invite from
// the Team page). Anyone hitting /signup is sent to the login screen.
export default function SignupPage() {
  redirect("/login");
}
