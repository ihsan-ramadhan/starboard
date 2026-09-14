import { useState } from "react";
import { api, setAuthToken } from "../lib/api";
import EyeIcon from "../assets/icons/eye.svg?react";
import EyeOffIcon from "../assets/icons/eye-off.svg?react";
import AlertCircleIcon from "../assets/icons/alert-circle.svg?react";
import type { SessionUser } from "../types";
import { useT } from "../lib/i18n";

export type LoginPageProps = {
  readonly onLoginSuccess: (u: SessionUser) => void;
};

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const t = useT();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError(t("login.required"));
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(identifier.trim(), password);
      setAuthToken(res.token);
      localStorage.setItem("starboard_user", JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err: any) {
      const raw = err?.message || err?.toString() || "";
      const cleaned = raw.replace(/^Error:\s*/i, "");
      setError(cleaned || t("login.invalid"));
    } finally {
      setLoading(false);
    }
  }

  function handleIdentifierChange(val: string) {
    setIdentifier(val);
    if (error) setError(null);
  }

  function handlePasswordChange(val: string) {
    setPassword(val);
    if (error) setError(null);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="brand brand-lg">
            <span className="brand-mark">★</span> Starboard
          </div>
          <p className="login-sub">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>{t("login.identifier")}</span>
            <input
              type="text"
              name="identifier"
              className={error ? "input-error" : ""}
              placeholder={t("login.identifierPlaceholder")}
              autoComplete="username"
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              required
            />
          </label>

          <label>
            <span>{t("login.password")}</span>
            <div className="login-password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className={error ? "input-error" : ""}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
              </button>
            </div>
            {error && (
              <div className="field-error-text" role="alert">
                <AlertCircleIcon width={14} height={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </label>

          <button
            type="submit"
            className="btn-primary btn-block"
            disabled={loading}
          >
            {loading ? t("common.processing") : t("login.submit")}
          </button>
        </form>

      </div>
    </div>
  );
}
