"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { registerUser } from "../../../lib/api";
import { isAuthenticated, setSession } from "../../../lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
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
      const result = await registerUser({ email, displayName, password });
      if (!result.userId) {
        throw new Error("REGISTER_USER_MISSING");
      }

      setSession({
        userId: result.userId,
        displayName,
        token: result.token
      });

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container auth-layout">
      <section className="panel auth-panel">
        <h1>Register</h1>
        <p>Create your account for multiplayer rooms.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
          />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
        <p>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
