import React, { useEffect, useState } from "react";
import { buildApiUrl } from "../api-url";
import { formatDateTime } from "../utils/formatters";

const DEFAULT_PREFS = {
  email: false,
  slack: false,
  sms: false,
  notifyOffline: true,
  notifyDegraded: true,
  emailRecipients: "",
  slackChannel: "",
  smsRecipients: "",
};

const Settings = () => {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastEmailSentAt, setLastEmailSentAt] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const loadPrefs = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/alerts/preferences"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Unable to load alert preferences");
        }
        const payload = await response.json();
        setPrefs((prev) => ({
          ...prev,
          email: Boolean(payload.emailEnabled),
          notifyOffline: payload.notifyOffline ?? prev.notifyOffline,
          notifyDegraded: payload.notifyDegraded ?? prev.notifyDegraded,
          emailRecipients: payload.emailRecipients ?? prev.emailRecipients,
        }));
        setLastEmailSentAt(payload.lastEmailSentAt ?? null);
        setIsLoaded(true);
      } catch (err) {
        setStatus({ tone: "error", message: err.message });
      }
    };
    loadPrefs();
  }, []);

  const togglePref = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updatePref = (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsSaving(true);
    setStatus({ tone: "", message: "" });
    try {
      const response = await fetch(buildApiUrl("/api/alerts/preferences"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailEnabled: prefs.email,
          notifyOffline: prefs.notifyOffline,
          notifyDegraded: prefs.notifyDegraded,
          emailRecipients: prefs.emailRecipients,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save alert preferences");
      }
      setPrefs((prev) => ({
        ...prev,
        email: Boolean(payload.emailEnabled),
        notifyOffline: payload.notifyOffline ?? prev.notifyOffline,
        notifyDegraded: payload.notifyDegraded ?? prev.notifyDegraded,
        emailRecipients: payload.emailRecipients ?? prev.emailRecipients,
      }));
      setLastEmailSentAt(payload.lastEmailSentAt ?? lastEmailSentAt);
      setStatus({ tone: "success", message: "Alert preferences saved." });
      setIsLoaded(true);
    } catch (err) {
      setStatus({ tone: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsTesting(true);
    setStatus({ tone: "", message: "" });
    try {
      const response = await fetch(buildApiUrl("/api/alerts/test-email"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailRecipients: prefs.emailRecipients,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send test email");
      }
      setStatus({ tone: "success", message: "Test email sent." });
      setLastEmailSentAt(payload?.sentAt ?? new Date().toISOString());
    } catch (err) {
      setStatus({ tone: "error", message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p className="muted">Email alerts are wired to the backend.</p>
        </div>
      </header>

      {status.message ? (
        <div className={`notice ${status.tone ? `is-${status.tone}` : ""}`.trim()}>
          {status.message}
        </div>
      ) : null}

      <div className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Alert subscriptions</h3>
              <p className="muted">Choose how you want to be notified.</p>
            </div>
          </div>
          <div className="stack">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={prefs.email}
                onChange={() => togglePref("email")}
              />
              <span>Email alerts</span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={prefs.slack}
                onChange={() => togglePref("slack")}
                disabled
              />
              <span>Slack alerts (coming soon)</span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={prefs.sms} onChange={() => togglePref("sms")} disabled />
              <span>SMS alerts (coming soon)</span>
            </label>
            <label className="form-field">
              <span>Email recipients</span>
              <input
                className="input"
                type="text"
                placeholder="ops@company.com"
                value={prefs.emailRecipients}
                onChange={(event) => updatePref("emailRecipients", event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Slack channel</span>
              <input
                className="input"
                type="text"
                placeholder="#ops-alerts"
                value={prefs.slackChannel}
                onChange={(event) => updatePref("slackChannel", event.target.value)}
                disabled
              />
            </label>
            <label className="form-field">
              <span>SMS recipients</span>
              <input
                className="input"
                type="text"
                placeholder="+1 555 0100"
                value={prefs.smsRecipients}
                onChange={(event) => updatePref("smsRecipients", event.target.value)}
                disabled
              />
            </label>
            <div className="header-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save preferences"}
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={handleTestEmail}
                disabled={!prefs.email || !isLoaded || isTesting}
              >
                {isTesting ? "Sending..." : "Send test email"}
              </button>
            </div>
            <p className="muted">
              Last email sent{" "}
              {lastEmailSentAt ? formatDateTime(lastEmailSentAt) : "not yet available"}.
            </p>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Alert triggers</h3>
              <p className="muted">Pick which conditions should raise alerts.</p>
            </div>
          </div>
          <div className="stack">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={prefs.notifyOffline}
                onChange={() => togglePref("notifyOffline")}
              />
              <span>Notify when a service is offline</span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={prefs.notifyDegraded}
                onChange={() => togglePref("notifyDegraded")}
              />
              <span>Notify when a service is degraded</span>
            </label>
            <div className="notice">
              Preferences are saved automatically for this browser session.
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default Settings;
