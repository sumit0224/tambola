"use client";

import type { ReactNode } from "react";
import { AuthLoading } from "../Common/AuthLoading";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { TopNav } from "./TopNav";

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuthGuard();

  if (loading || !user) {
    return <AuthLoading message="Redirecting to login..." />;
  }

  return (
    <div className="protected-shell">
      <TopNav />
      <div className="protected-content">{children}</div>
    </div>
  );
}
