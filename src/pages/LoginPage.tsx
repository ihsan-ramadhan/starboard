import { useState } from "react";
import { api, setAuthToken } from "../lib/api";
import type { SessionUser } from "../types";

export type LoginPageProps = {
  readonly onLoginSuccess: (u: SessionUser) => void;
};

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Username / email dan password wajib diisi.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(identifier, password);
      setAuthToken(res.token);
      localStorage.setItem("starboard_user", JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err?.toString() || "Login gagal. Cek kembali akun Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="brand brand-lg">
            <span className="brand-mark">★</span> Starboard
          </div>
          <p className="login-sub">Masuk dengan akun departemen</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert">{error}</div>}

          <label>
            <span>Username atau Email</span>
            <input
              type="text"
              name="identifier"
              placeholder="MIOP / miop@aspire.id"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="btn-primary btn-block"
            disabled={loading}
          >
            {loading ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <div className="login-demo">
          Gunakan akun demo: <strong>MIOP</strong> / <strong>password123</strong>
        </div>
      </div>
    </div>
  );
}
