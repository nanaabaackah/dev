import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { getApiErrorMessage, readJsonResponse } from "../../utils/http";
import { formatDateTime } from "../../utils/formatters";

const readLocalUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const buildFullName = (profile) => {
  const fullName = String(profile?.fullName || "").trim();
  if (fullName) return fullName;
  const firstName = String(profile?.firstName || "").trim();
  const lastName = String(profile?.lastName || "").trim();
  return `${firstName} ${lastName}`.trim() || "N/A";
};

const Profile = () => {
  const navigate = useNavigate();
  const initialLocalUser = useMemo(() => readLocalUser(), []);
  const [profile, setProfile] = useState(initialLocalUser);
  const [formState, setFormState] = useState(() => ({
    firstName: String(initialLocalUser?.firstName || ""),
    lastName: String(initialLocalUser?.lastName || ""),
  }));
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const loadProfile = async ({ silent = false } = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const response = await fetch(buildApiUrl("/api/users/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(payload, "Unable to load profile"));
      }

      const currentLocalUser = readLocalUser();
      const nextLocalUser = {
        ...(currentLocalUser && typeof currentLocalUser === "object" ? currentLocalUser : {}),
        ...(payload && typeof payload === "object" ? payload : {}),
      };
      localStorage.setItem("user", JSON.stringify(nextLocalUser));
      setProfile(nextLocalUser);
      setFormState({
        firstName: String(nextLocalUser?.firstName || ""),
        lastName: String(nextLocalUser?.lastName || ""),
      });
      setLastLoadedAt(new Date().toISOString());
    } catch (requestError) {
      setError(requestError.message || "Unable to load profile");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const fullName = buildFullName(profile);
  const emailLabel = String(profile?.email || "").trim() || "N/A";
  const lastLoadedLabel = useMemo(
    () => (lastLoadedAt ? formatDateTime(lastLoadedAt) : "N/A"),
    [lastLoadedAt]
  );
  const isDirty =
    formState.firstName.trim() !== String(profile?.firstName || "").trim() ||
    formState.lastName.trim() !== String(profile?.lastName || "").trim();

  const handleFormField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (saveError) setSaveError("");
    if (saveNotice) setSaveNotice("");
  };

  const handleResetForm = () => {
    setFormState({
      firstName: String(profile?.firstName || ""),
      lastName: String(profile?.lastName || ""),
    });
    setSaveError("");
    setSaveNotice("");
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    const firstName = formState.firstName.trim();
    const lastName = formState.lastName.trim();
    if (!firstName || !lastName) {
      setSaveError("First name and last name are required.");
      return;
    }

    setSaveError("");
    setSaveNotice("");
    setIsSaving(true);

    try {
      const response = await fetch(buildApiUrl("/api/users/me"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firstName, lastName }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(payload, "Unable to save profile"));
      }

      const currentLocalUser = readLocalUser();
      const nextLocalUser = {
        ...(currentLocalUser && typeof currentLocalUser === "object" ? currentLocalUser : {}),
        ...(payload && typeof payload === "object" ? payload : {}),
      };
      localStorage.setItem("user", JSON.stringify(nextLocalUser));
      setProfile(nextLocalUser);
      setFormState({
        firstName: String(nextLocalUser?.firstName || ""),
        lastName: String(nextLocalUser?.lastName || ""),
      });
      setLastLoadedAt(new Date().toISOString());
      setSaveNotice("Profile updated.");
    } catch (requestError) {
      setSaveError(requestError.message || "Unable to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile</h1>
          <p className="muted">{profile?.email || "Signed-in account"}</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadProfile({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading profile...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="panel-grid">
        <article className="panel metric-card">
          <span className="kpi-label">Full name</span>
          <div className="kpi-value">{fullName}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Email</span>
          <div className="kpi-value">{emailLabel}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Profile sync</span>
          <div className="kpi-value">{lastLoadedLabel}</div>
        </article>
      </div>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Edit profile</h3>
            <p className="muted">Update your first and last name.</p>
          </div>
        </div>
        {saveError ? (
          <div className="notice is-error" role="alert">
            {saveError}
          </div>
        ) : null}
        {saveNotice ? (
          <div className="notice is-success" role="status">
            {saveNotice}
          </div>
        ) : null}

        <form className="stack" onSubmit={handleSaveProfile}>
          <label className="form-field">
            <span>First name</span>
            <input
              className="input"
              type="text"
              autoComplete="given-name"
              value={formState.firstName}
              onChange={(event) => handleFormField("firstName", event.target.value)}
              disabled={loading || isSaving}
            />
          </label>

          <label className="form-field">
            <span>Last name</span>
            <input
              className="input"
              type="text"
              autoComplete="family-name"
              value={formState.lastName}
              onChange={(event) => handleFormField("lastName", event.target.value)}
              disabled={loading || isSaving}
            />
          </label>

          <label className="form-field">
            <span>Email</span>
            <input className="input" type="email" value={emailLabel === "N/A" ? "" : emailLabel} readOnly />
          </label>

          <div className="header-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={handleResetForm}
              disabled={loading || isSaving || !isDirty}
            >
              Reset
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={loading || isSaving || !isDirty}
            >
              {isSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};

export default Profile;
