import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { getApiErrorMessage, readJsonResponse } from "../../utils/http";
import "./SetupAccount.css";

const MIN_PASSWORD_LENGTH = 14;
const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (value) => value.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "At least one number",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "special",
    label: "At least one special character",
    test: (value) => /[^A-Za-z0-9\s]/.test(value),
  },
  {
    id: "spaces",
    label: "No spaces",
    test: (value) => !/\s/.test(value),
  },
];

const SetupAccount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );

  const [isVerifying, setIsVerifying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordChecks = PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    passed: requirement.test(password),
  }));

  useEffect(() => {
    let isActive = true;

    const verifyToken = async () => {
      if (!token) {
        setUser(null);
        setError("Invitation token is missing.");
        setIsVerifying(false);
        return;
      }

      setIsVerifying(true);
      setError("");
      try {
        const query = new URLSearchParams({ token });
        const response = await fetch(buildApiUrl(`/api/auth/setup-account/verify?${query.toString()}`));
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Invitation link is invalid or expired."));
        }
        if (!isActive) return;
        setUser(payload?.user || null);
      } catch (requestError) {
        if (!isActive) return;
        setUser(null);
        setError(requestError.message || "Unable to verify invitation.");
      } finally {
        if (isActive) {
          setIsVerifying(false);
        }
      }
    };

    verifyToken();
    return () => {
      isActive = false;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setError("Invitation token is missing.");
      return;
    }

    const trimmedPassword = String(password || "").trim();
    const trimmedConfirmPassword = String(confirmPassword || "").trim();
    if (!trimmedPassword || !trimmedConfirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (trimmedPassword !== trimmedConfirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(buildApiUrl("/api/auth/setup-account/complete"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: trimmedPassword,
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        const message = getApiErrorMessage(payload, "Unable to complete account setup.");
        const policy =
          payload && typeof payload === "object" && typeof payload.passwordPolicy === "string"
            ? ` ${payload.passwordPolicy}`
            : "";
        throw new Error(`${message}${policy}`.trim());
      }

      setSuccess(payload?.message || "Account setup complete. You can now sign in.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (requestError) {
      setError(requestError.message || "Unable to complete account setup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPasswordForm = !isVerifying && !success && Boolean(user);

  return (
    <div className="setup-account-page">
      <div className="setup-account-card panel">
        <p className="eyebrow">Invitation</p>
        <h1>Set Up Account</h1>
        <p className="muted">
          {user?.email ? `Create your password for ${user.email}.` : "Complete your account setup."}
        </p>

        {isVerifying ? (
          <div className="notice" role="status">
            Verifying invitation...
          </div>
        ) : null}

        {error ? (
          <div className="notice is-error" role="alert">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="notice is-success" role="status">
            {success}
          </div>
        ) : null}

        {showPasswordForm ? (
          <form className="stack" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>New password</span>
              <div className="password-input-inline">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="password-input-inline__toggle"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                </button>
              </div>
            </label>

            <label className="form-field">
              <span>Confirm password</span>
              <div className="password-input-inline">
                <input
                  className="input"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  className="password-input-inline__toggle"
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? (
                    <FiEyeOff aria-hidden="true" />
                  ) : (
                    <FiEye aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            <div className="setup-account-checklist" aria-live="polite">
              {passwordChecks.map((requirement) => (
                <div
                  key={requirement.id}
                  className={`setup-account-checklist__item ${
                    requirement.passed ? "is-passed" : "is-failed"
                  }`}
                >
                  <span className="setup-account-checklist__icon" aria-hidden="true">
                    {requirement.passed ? <FiCheck /> : <FiX />}
                  </span>
                  <span>{requirement.label}</span>
                </div>
              ))}
            </div>

            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Complete setup"}
            </button>
          </form>
        ) : null}

        <div className="setup-account-actions">
          <Link className="button button-ghost" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SetupAccount;
