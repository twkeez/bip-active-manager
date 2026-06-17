import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0f1117 0%, #131929 100%)" }}>
      {/* Logo mark */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "#00c9a7" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="white" fillOpacity="0.9" />
          </svg>
        </div>
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
          Beyond Indigo Pets
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "#1a1f2e",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        <h1 className="text-center text-xl font-semibold" style={{ color: "#ffffff" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-center text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {subtitle}
          </p>
        )}

        {children}
      </div>

      {footer && (
        <div className="mt-5 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#ffffff",
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid #00c9a7";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,201,167,0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = "1px solid rgba(255,255,255,0.15)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </label>
  );
}

export function AuthButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all disabled:opacity-60"
      style={{ background: "#00c9a7", color: "#0f1117" }}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rounded-lg px-3.5 py-2.5 text-sm"
      style={{ background: "rgba(255,77,79,0.12)", border: "1px solid rgba(255,77,79,0.3)", color: "#ff6b6b" }}
    >
      {message}
    </div>
  );
}

export function AuthDivider() {
  return <div className="my-1" />;
}

export { Link };
