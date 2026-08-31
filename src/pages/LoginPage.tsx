import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { SessionUser } from "../types";

export default function LoginPage({
  onLoginSuccess,
}: {
  onLoginSuccess: (user: SessionUser) => void;
}) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Username/email dan password wajib diisi.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const user = await invoke<SessionUser>("login", {
        identifier,
        password,
      });

      localStorage.setItem("starboard_user", JSON.stringify(user));
      onLoginSuccess(user);
      navigate("/");
    } catch (err: any) {
      setError(err?.toString() || "Username/email atau password salah.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <div className="brand brand-lg">
            <span className="brand-mark">★</span> Starboard
          </div>
          <p className="login-sub">Stargate operational dashboard</p>
        </div>

        {error && <div className="alert">{error}</div>}

        <label>
          Username atau Email
          <input
            name="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="btn-primary btn-block"
          disabled={loading}
        >
          {loading ? "Memproses…" : "Masuk"}
        </button>

        <div className="login-demo">
          Akses demo: ketik <code>MIOP</code> atau <code>miop@aspire.id</code>
          <br />
          password: <code>password123</code>
        </div>
      </form>
    </div>
  );
}
