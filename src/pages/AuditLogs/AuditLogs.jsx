import React, { useState } from "react";
import useDashboardData from "../../hooks/useDashboardData";
import { formatDateTime } from "../../utils/formatters";

const INCIDENT_NOTES_KEY = "dev-incident-notes";

const AuditLogs = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [incidentNotes] = useState(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(INCIDENT_NOTES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });

  const siteStatuses = kpiData?.siteStatus?.sites ?? [];
  const logs = [
    kpiData?.lastSyncedAt
      ? {
          id: "sync",
          timestamp: kpiData.lastSyncedAt,
          title: "KPI sync completed",
          detail: "Aggregated totals refreshed across portfolio services.",
          badge: "System",
          priority: "normal",
        }
      : null,
    kpiData?.siteStatus?.checkedAt
      ? {
          id: "site-check",
          timestamp: kpiData.siteStatus.checkedAt,
          title: "Site status check",
          detail: `Health scan across ${siteStatuses.length} sites.`,
          badge: "System",
          priority: "normal",
        }
      : null,
    ...incidentNotes.map((note) => ({
      id: `note-${note.id}`,
      timestamp: note.createdAt,
      title: "Incident note",
      detail: note.text,
      badge: "Note",
      priority: "urgent",
    })),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Compliance</p>
          <h1>Audit logs</h1>
          <p className="muted">Track recent system activity and incident notes.</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => reload({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading audit logs...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Recent activity</h3>
            <p className="muted">System checks and operator notes.</p>
          </div>
        </div>
        <div className="timeline">
          {logs.length ? (
            logs.map((entry) => (
              <div className="timeline-row" key={entry.id}>
                <span className="timeline-time">{formatDateTime(entry.timestamp)}</span>
                <div>
                  <span className="table-strong">{entry.title}</span>
                  <p className="muted">{entry.detail}</p>
                </div>
                <span className={`priority is-${entry.priority}`}>{entry.badge}</span>
              </div>
            ))
          ) : (
            <p className="muted">No audit logs yet.</p>
          )}
        </div>
      </article>
    </section>
  );
};

export default AuditLogs;
