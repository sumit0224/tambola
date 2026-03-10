"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ClientSession } from "../lib/session";
import { getSession } from "../lib/session";

type AuthGuardResult = {
  user: { id: string; displayName: string } | null;
  token: string | null;
  loading: boolean;
};

export function useAuthGuard(): AuthGuardResult {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentSession = getSession();

    if (!currentSession) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    setSession(currentSession);
    setLoading(false);
  }, [router]);

  return {
    user: session
      ? {
          id: session.userId,
          displayName: session.displayName
        }
      : null,
    token: session?.token ?? null,
    loading
  };
}
