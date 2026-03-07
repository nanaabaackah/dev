import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import ThemeToggle from "../../components/ThemeToggle";
import "./Login.css";

const Login = ({ theme, onToggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotStatus, setForgotStatus] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (!data?.user) {
          throw new Error("Login succeeded but user details were missing.");
        }
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error or server unavailable");
      console.error("Login error:", err);
    }
  };
  
  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      setForgotError("Please provide the email you used to register.");
      return;
    }
    setIsSendingReset(true);
    setForgotError("");
    setForgotStatus("");
    try {
      const response = await fetch(buildApiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to request password help");
      }
      const deliveredTo = String(payload?.deliveryEmail || "").trim();
      const statusMessage = deliveredTo
        ? `${payload.message || "Password reset instructions sent."} Check ${deliveredTo}.`
        : payload.message || "If that email exists we sent instructions.";
      setForgotStatus(statusMessage);
      setForgotError("");
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <span className="brand">Dev KPI</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="auth-layout">
        <div className="panel auth-hero">
          <p className="eyebrow">Dev KPI Portal</p>
          <h1>Monitor every ERP signal in one place</h1>
          <p className="muted">
            dev.nanaabaackah.com surfaces live metrics from all databases along with system health
            insights.
          </p>
          <div className="auth-list">
            <div className="auth-list-row">
              <span>Live API data</span>
              <strong>Real time</strong>
            </div>
            <div className="auth-list-row">
              <span>Secure access</span>
              <strong>JWT protected</strong>
            </div>
            <div className="auth-list-row">
              <span>System visibility</span>
              <strong>Status checks</strong>
            </div>
          </div>
        </div>
        <div className="panel auth-card">
          <div className="auth-card__header">
            <h2>Sign in</h2>
            <p className="muted">
              Use your admin credentials to access the KPI dashboard.
            </p>
          </div>
          {error ? (
            <div className="notice is-error" role="alert">
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-field" htmlFor="loginEmail">
              <span>Email address</span>
              <input
                id="loginEmail"
                className="input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="form-field" htmlFor="loginPassword">
              <span>Password</span>
              <div className="input-group">
                <input
                  id="loginPassword"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="input-button"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button className="button button-primary auth-submit" type="submit">
              Sign in
            </button>
          </form>
          <div className="auth-helper">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setForgotMode((prev) => !prev);
                setForgotStatus("");
                setForgotError("");
              }}
            >
              {forgotMode ? "Back to sign in" : "Forgot password?"}
            </button>
          </div>
          {forgotMode ? (
            <form className="auth-forgot" onSubmit={handleForgotSubmit}>
              <p className="muted">
                Enter the email you use for this dashboard and we will send recovery steps.
              </p>
              {forgotStatus ? <div className="notice is-success">{forgotStatus}</div> : null}
              {forgotError ? (
                <div className="notice is-error" role="alert">
                  {forgotError}
                </div>
              ) : null}
              <label className="form-field" htmlFor="forgotEmail">
                <span>Email address</span>
                <input
                  id="forgotEmail"
                  className="input"
                  type="email"
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </label>
              <button
                className="button button-ghost auth-submit"
                type="submit"
                disabled={isSendingReset}
              >
                {isSendingReset ? "Sending reset link..." : "Send reset link"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Login;
