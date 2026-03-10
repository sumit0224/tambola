"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession } from "../../lib/session";
import { disconnectSocket } from "../../lib/socket";

export function TopNav() {
  const router = useRouter();

  function handleLogout(): void {
    disconnectSocket();
    clearSession();
    router.replace("/login");
  }

  return (
    <header className="top-nav-wrap">
      <div className="top-nav">
        <Link href="/" className="top-nav-brand">
          Tambola
        </Link>

        <nav className="top-nav-links" aria-label="Main">
          <Link href="/" className="top-nav-link">
            Dashboard
          </Link>
          <Link href="/rooms/create" className="top-nav-link">
            Create Room
          </Link>
          <button type="button" className="btn btn-ghost top-nav-logout" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
