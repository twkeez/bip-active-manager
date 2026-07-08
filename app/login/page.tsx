import LoginForm from "@/components/auth/login-form";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; fallback?: string }>;
}) {
  const { error, fallback } = await searchParams;
  return <LoginForm error={error} fallback={fallback != null} />;
}
