import React, { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../../api-url";
import useDashboardData from "../../hooks/useDashboardData";
import downloadCsv from "../../utils/exportCsv";
import { formatDateTime } from "../../utils/formatters";
import "./Reports.css";

const EMPTY_TEMPLATE = {
  enabled: true,
  scheduleFrequency: "weekly",
  subjectPrefix: "",
  heading: "",
  introText: "",
  footerText: "",
  contentOptions: {},
  weekdayUtc: 1,
  monthDayUtc: 1,
  hourUtc: 9,
  minuteUtc: 0,
  daysBeforeDue: 2,
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const formatReportDate = (value, fallback) => {
  if (!value) return fallback;
  return formatDateTime(value);
};

const buildSendResultMessage = (report, result) => {
  if (!result) return `${report.title} finished.`;
  if (result.skipped) return result.reason || `${report.title} was skipped.`;
  if (result.ok === false) return result.error || `${report.title} failed.`;

  if (report.key === "weekly_kpi") {
    return `${report.title} sent to ${result.recipientCount ?? 0} recipient${
      result.recipientCount === 1 ? "" : "s"
    }.`;
  }
  if (report.key === "rent_monthly_summary") {
    const summaryLabel =
      result.sentCount === 1 ? "1 tenant summary" : `${result.sentCount ?? 0} tenant summaries`;
    return `${report.title} sent ${summaryLabel} to ${result.recipientCount ?? 0} recipient${
      result.recipientCount === 1 ? "" : "s"
    }.`;
  }
  if (report.key === "accounting_scheduled_reminder") {
    return `${report.title} sent ${result.sentCount ?? 0} reminder email${
      result.sentCount === 1 ? "" : "s"
    } covering ${result.entryCount ?? 0} entr${result.entryCount === 1 ? "y" : "ies"}.`;
  }
  return `${report.title} sent.`;
};

const buildDraftFromReport = (report) => ({
  enabled: report?.enabled !== false,
  scheduleFrequency: report?.schedule?.frequency || report?.scheduleType || "weekly",
  subjectPrefix: report?.template?.subjectPrefix || "",
  heading: report?.template?.heading || "",
  introText: report?.template?.introText || "",
  footerText: report?.template?.footerText || "",
  contentOptions: report?.contentOptions || {},
  weekdayUtc: report?.schedule?.weekdayUtc ?? 1,
  monthDayUtc: report?.schedule?.monthDayUtc ?? 1,
  hourUtc: report?.schedule?.hourUtc ?? 9,
  minuteUtc: report?.schedule?.minuteUtc ?? 0,
  daysBeforeDue: report?.schedule?.daysBeforeDue ?? 2,
});

const Reports = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState("");
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [editingKey, setEditingKey] = useState("");
  const [draft, setDraft] = useState(EMPTY_TEMPLATE);
  const [sendingKey, setSendingKey] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [togglingKey, setTogglingKey] = useState("");

  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const enabledReports = reports.filter((report) => report.enabled);
  const latestReportActivity = useMemo(() => {
    const timestamps = reports
      .map((report) => report.lastRunAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right) - new Date(left));
    return timestamps[0] || null;
  }, [reports]);

  const handleExportSnapshot = () => {
    if (!kpiData) return;
    const organizations = Array.isArray(kpiData?.organizations) ? kpiData.organizations : [];
    const rows = [
      ["Metric", "Value"],
      ["Total organizations", kpiData.totalOrganizations ?? 0],
      ["Top-level groups", kpiData.topLevelOrganizations ?? 0],
      ["Child organizations", kpiData.childOrganizations ?? 0],
      [],
      ["Organization", "Parent", "Child orgs", "Manages"],
      ...organizations.map((organization) => [
        organization.name,
        organization.parentOrganizationName || "",
        organization.childOrganizationsCount ?? 0,
        organization.managedOrganizationsCount ?? 0,
      ]),
    ];
    downloadCsv("dashboard_snapshot.csv", rows);
  };

  const loadReports = async ({ silent = false } = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setReportsError("Missing session. Please sign in again.");
      setReportsLoading(false);
      return;
    }

    if (!silent) {
      setReportsLoading(true);
    }

    try {
      const response = await fetch(buildApiUrl("/api/reports"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load reports.");
      }

      setReports(Array.isArray(payload?.reports) ? payload.reports : []);
      setReportsError("");
    } catch (loadError) {
      setReportsError(loadError.message || "Unable to load reports.");
    } finally {
      if (!silent) {
        setReportsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleRefresh = () => {
    reload({ silent: true });
    loadReports({ silent: true });
  };

  const handleEditToggle = (report) => {
    if (editingKey === report.key) {
      setEditingKey("");
      setDraft(EMPTY_TEMPLATE);
      return;
    }
    setEditingKey(report.key);
    setDraft(buildDraftFromReport(report));
  };

  const handleDraftChange = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleContentOptionChange = (optionKey, checked) => {
    setDraft((current) => ({
      ...current,
      contentOptions: {
        ...(current.contentOptions || {}),
        [optionKey]: checked,
      },
    }));
  };

  const handleSaveReport = async (report) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setSavingKey(report.key);
    setStatus({ tone: "", message: "" });

    try {
      const response = await fetch(buildApiUrl(`/api/reports/${report.key}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update report.");
      }

      setReports((current) =>
        current.map((item) => (item.key === report.key ? payload.report || item : item))
      );
      setStatus({ tone: "success", message: `${report.title} updated.` });
      setEditingKey("");
      setDraft(EMPTY_TEMPLATE);
    } catch (saveError) {
      setStatus({ tone: "error", message: saveError.message || "Unable to update report." });
    } finally {
      setSavingKey("");
    }
  };

  const handleToggleEnabled = async (report) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const nextEnabled = !report.enabled;
    setTogglingKey(report.key);
    setStatus({ tone: "", message: "" });

    try {
      const response = await fetch(buildApiUrl(`/api/reports/${report.key}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...buildDraftFromReport(report),
          enabled: nextEnabled,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update report.");
      }

      const updatedReport = payload.report || report;
      setReports((current) =>
        current.map((item) => (item.key === report.key ? updatedReport : item))
      );

      if (editingKey === report.key) {
        setDraft(buildDraftFromReport(updatedReport));
      }

      setStatus({
        tone: "success",
        message: `${report.title} ${nextEnabled ? "enabled" : "disabled"}.`,
      });
    } catch (toggleError) {
      setStatus({
        tone: "error",
        message: toggleError.message || "Unable to update report.",
      });
    } finally {
      setTogglingKey("");
    }
  };

  const handleSendNow = async (report) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setSendingKey(report.key);
    setStatus({ tone: "", message: "" });

    try {
      const response = await fetch(buildApiUrl(`/api/reports/${report.key}/send`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send report.");
      }

      if (payload?.report) {
        setReports((current) =>
          current.map((item) => (item.key === report.key ? payload.report : item))
        );
      } else {
        loadReports({ silent: true });
      }

      setStatus({
        tone: payload?.result?.ok === false ? "error" : "success",
        message: buildSendResultMessage(report, payload?.result),
      });
    } catch (sendError) {
      setStatus({ tone: "error", message: sendError.message || "Unable to send report." });
    } finally {
      setSendingKey("");
    }
  };

  return (
    <section className="page reports-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Email reports</p>
          <h1>Reports</h1>
          <p className="muted">Last synced {lastSyncedLabel}</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={handleRefresh}
            disabled={loading || isRefreshing || reportsLoading}
          >
            {isRefreshing || reportsLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleExportSnapshot}
            disabled={!kpiData}
          >
            Export dashboard snapshot
          </button>
        </div>
      </header>

      {status.message ? (
        <div className={`notice ${status.tone ? `is-${status.tone}` : ""}`.trim()}>{status.message}</div>
      ) : null}

      {loading || reportsLoading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading report data...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {reportsError ? (
        <div className="notice is-error" role="alert">
          {reportsError}
        </div>
      ) : null}

      <div className="panel-grid">
        <article className="panel metric-card">
          <span className="kpi-label">Automated reports</span>
          <div className="kpi-value">{reports.length}</div>
          <span className="kpi-delta">{enabledReports.length} enabled</span>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Last email activity</span>
          <div className="kpi-value reports-kpi-value">
            {latestReportActivity ? formatDateTime(latestReportActivity) : "No sends yet"}
          </div>
          <span className="kpi-delta">Across all scheduled reports</span>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Export source</span>
          <div className="kpi-value reports-kpi-value">Dashboard snapshot</div>
          <span className="kpi-delta">CSV export remains available on demand</span>
        </article>
      </div>

      <div className="reports-grid">
        {reports.map((report) => {
          const isEditing = editingKey === report.key;
          const isSending = sendingKey === report.key;
          const isSaving = savingKey === report.key;
          const isToggling = togglingKey === report.key;
          const activeScheduleType = draft.scheduleFrequency || report.scheduleType;
          const handleCardOpen = () => {
            if (!isEditing) {
              handleEditToggle(report);
            }
          };

          return (
            <article
              className={`panel report-card ${isEditing ? "is-editing" : "is-collapsed"}`.trim()}
              key={report.key}
              role={isEditing ? undefined : "button"}
              tabIndex={isEditing ? undefined : 0}
              onClick={isEditing ? undefined : handleCardOpen}
              onKeyDown={
                isEditing
                  ? undefined
                  : (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleCardOpen();
                      }
                    }
              }
              aria-expanded={isEditing}
            >
              <div className="panel-header">
                <div>
                  <h3>{report.title}</h3>
                  <p className="muted">{report.description}</p>
                </div>
                <span className={`status-pill is-${report.enabled ? "success" : "warning"}`}>
                  {report.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="report-card__meta">
                <div className="report-card__meta-item">
                  <span>Schedule</span>
                  <strong>{report.scheduleLabel}</strong>
                </div>
                <div className="report-card__meta-item">
                  <span>Delivery</span>
                  <strong>{report.deliveryLabel}</strong>
                </div>
                <div className="report-card__meta-item">
                  <span>Recipients</span>
                  <strong>{report.recipientLabel}</strong>
                </div>
                <div className="report-card__meta-item">
                  <span>From email</span>
                  <strong>{report.sender}</strong>
                </div>
              </div>

              <div className="report-card__runtime">
                <div className="list-row is-split">
                  <span className="table-strong">Last run</span>
                  <span>{formatReportDate(report.lastRunAt, "Not sent yet")}</span>
                </div>
                <div className="list-row is-split">
                  <span className="table-strong">Next scheduled run</span>
                  <span>{formatReportDate(report.lastScheduledFor, "Not scheduled")}</span>
                </div>
                <div className="list-row">
                  <span className="table-strong">Latest result</span>
                  <span className="muted">{report.lastResultLabel}</span>
                </div>
              </div>

              <div className="report-card__actions">
                <button
                  className={`button button-ghost report-card__toggle ${
                    report.enabled ? "" : "is-disabled"
                  }`.trim()}
                  type="button"
                  aria-pressed={report.enabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleEnabled(report);
                  }}
                  disabled={isToggling}
                >
                  {isToggling
                    ? report.enabled
                      ? "Disabling..."
                      : "Enabling..."
                    : report.enabled
                      ? "Disable report"
                      : "Enable report"}
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSendNow(report);
                  }}
                  disabled={isSending}
                >
                  {isSending ? "Sending..." : "Send now"}
                </button>
              </div>

              {isEditing ? (
                <div className="report-editor">
                  <div className="report-editor__schedule">
                    <div className="panel-header">
                      <div>
                        <h4>Schedule</h4>
                        <p className="muted">Choose when this report should run automatically.</p>
                      </div>
                    </div>

                    <div className="report-editor__grid">
                      <label className="form-field">
                        <span>Frequency</span>
                        <select
                          className="input"
                          value={draft.scheduleFrequency}
                          onChange={(event) =>
                            handleDraftChange("scheduleFrequency", event.target.value)
                          }
                          disabled={!Array.isArray(report.scheduleOptions) || report.scheduleOptions.length <= 1}
                        >
                          {(Array.isArray(report.scheduleOptions) && report.scheduleOptions.length
                            ? report.scheduleOptions
                            : [{ value: report.scheduleType, label: report.scheduleType }]).map(
                            (option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      {activeScheduleType === "weekly" ? (
                        <label className="form-field">
                          <span>Scheduled day</span>
                          <select
                            className="input"
                            value={draft.weekdayUtc}
                            onChange={(event) =>
                              handleDraftChange("weekdayUtc", Number(event.target.value))
                            }
                          >
                            {WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {activeScheduleType === "monthly" ? (
                        <label className="form-field">
                          <span>Scheduled day of month</span>
                          <input
                            className="input"
                            type="number"
                            min="1"
                            max="28"
                            value={draft.monthDayUtc}
                            onChange={(event) =>
                              handleDraftChange("monthDayUtc", Number(event.target.value))
                            }
                          />
                        </label>
                      ) : null}

                      {activeScheduleType === "reminder" ? (
                        <label className="form-field">
                          <span>Days before due date</span>
                          <input
                            className="input"
                            type="number"
                            min="1"
                            max="30"
                            value={draft.daysBeforeDue}
                            onChange={(event) =>
                              handleDraftChange("daysBeforeDue", Number(event.target.value))
                            }
                          />
                        </label>
                      ) : null}

                      <label className="form-field">
                        <span>Hour (UTC)</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          max="23"
                          value={draft.hourUtc}
                          onChange={(event) =>
                            handleDraftChange("hourUtc", Number(event.target.value))
                          }
                        />
                      </label>

                      <label className="form-field">
                        <span>Minute (UTC)</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          max="59"
                          value={draft.minuteUtc}
                          onChange={(event) =>
                            handleDraftChange("minuteUtc", Number(event.target.value))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {Array.isArray(report.contentOptionDefinitions) &&
                  report.contentOptionDefinitions.length ? (
                    <div className="report-editor__content">
                      <div className="panel-header">
                        <div>
                          <h4>Included in email</h4>
                          <p className="muted">
                            Choose which summary details should be included when this report is sent.
                          </p>
                        </div>
                      </div>

                      <div className="report-checkbox-grid">
                        {report.contentOptionDefinitions.map((option) => (
                          <label className="report-checkbox" key={option.key}>
                            <input
                              type="checkbox"
                              checked={draft.contentOptions?.[option.key] !== false}
                              onChange={(event) =>
                                handleContentOptionChange(option.key, event.target.checked)
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="report-editor__grid">
                    <label className="form-field">
                      <span>Subject prefix</span>
                      <input
                        className="input"
                        type="text"
                        value={draft.subjectPrefix}
                        onChange={(event) => handleDraftChange("subjectPrefix", event.target.value)}
                        placeholder="Weekly KPI rollup"
                      />
                    </label>
                    <label className="form-field">
                      <span>Email heading</span>
                      <input
                        className="input"
                        type="text"
                        value={draft.heading}
                        onChange={(event) => handleDraftChange("heading", event.target.value)}
                        placeholder="Dev KPI weekly report"
                      />
                    </label>
                  </div>

                  <label className="form-field">
                    <span>Intro message</span>
                    <textarea
                      className="input"
                      rows="4"
                      value={draft.introText}
                      onChange={(event) => handleDraftChange("introText", event.target.value)}
                      placeholder="Optional lead-in shown above the report details."
                    />
                  </label>

                  <label className="form-field">
                    <span>Footer message</span>
                    <textarea
                      className="input"
                      rows="4"
                      value={draft.footerText}
                      onChange={(event) => handleDraftChange("footerText", event.target.value)}
                      placeholder="Optional closing note shown at the end of the report email."
                    />
                  </label>

                  <div className="report-editor__actions">
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingKey("");
                        setDraft(EMPTY_TEMPLATE);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => handleSaveReport(report)}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default Reports;
