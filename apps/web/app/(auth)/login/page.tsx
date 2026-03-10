"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { loginUser } from "../../../lib/api";
import { isAuthenticated, setSession } from "../../../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const result = await loginUser({ email, password });
      if (!result.user) {
        throw new Error("LOGIN_USER_MISSING");
      }

      setSession({
        userId: result.user.id,
        displayName: result.user.displayName,
        token: result.token
      });

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container auth-layout">
      <section className="panel auth-panel">
        <h1>Login</h1>
        <p>Sign in and continue to your game dashboard.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Signing In..." : "Login"}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        <p>
          New player? <Link href="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
