import { loginAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="login-screen">
      <form className="login-card" action={loginAction}>
        <div className="login-header">
          <div className="brand brand-lg">
            <span className="brand-mark">★</span> Starboard
          </div>
          <p className="login-sub">Stargate operational dashboard</p>
        </div>

        {error === "invalid" && (
          <div className="alert">Username/email atau password salah.</div>
        )}
        {error === "empty" && (
          <div className="alert">Username/email dan password wajib diisi.</div>
        )}

        <label>
          Username atau Email
          <input
            name="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="btn-primary btn-block">
          Masuk
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
