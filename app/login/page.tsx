import LoginForm from "@/components/auth/login-form";
import { safeReturnPath } from "@/lib/mcp-oauth/core";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; fallback?: string; next?: string }>;
}) {
  const { error, fallback, next } = await searchParams;
  return <LoginForm error={error} fallback={fallback != null} next={next ? safeReturnPath(next) : undefined} />;
}
