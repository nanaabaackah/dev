import React, { useEffect, useState } from "react";
import useDashboardData from "../../hooks/useDashboardData";
import { formatDateTime } from "../../utils/formatters";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../../utils/status";

const INCIDENT_NOTES_KEY = "dev-incident-notes";

const SystemHealth = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [noteDraft, setNoteDraft] = useState("");
  const [incidentNotes, setIncidentNotes] = useState(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(INCIDENT_NOTES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(INCIDENT_NOTES_KEY, JSON.stringify(incidentNotes));
  }, [incidentNotes]);

  const renderStatusPill = (status) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{formatStatusLabel(status)}</span>;
  };

  const getAggregateStatus = (pages = []) => {
    if (!pages.length) return "unknown";
    if (pages.some((page) => page.status === "offline")) return "offline";
    if (pages.some((page) => page.status === "degraded")) return "degraded";
    if (pages.every((page) => page.status === "online")) return "online";
    return "unknown";
  };

  const systemStatus = kpiData?.status ?? {};
  const siteStatuses = kpiData?.siteStatus?.sites ?? [];
  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const lastCheckedLabel = kpiData?.siteStatus?.checkedAt
    ? formatDateTime(kpiData.siteStatus.checkedAt)
    : "N/A";

  const systemEntries = [
    { id: "api", label: "API", status: systemStatus.api, note: "Auth + metrics" },
    {
      id: "portfolio",
      label: "By Nana DB",
      status: systemStatus.portfolioDb,
      note: "Primary org data",
    },
    {
      id: "reebs",
      label: "Reebs DB",
      status: systemStatus.reebsDb,
      note: "Operational data",
    },
    {
      id: "faako",
      label: "Faako DB",
      status: systemStatus.faakoDb,
      note: "ERP members",
    },
  ];

  const siteOverview = siteStatuses.map((site) => {
    const pages = site.pages ?? [];
    return {
      id: site.id,
      title: site.title,
      pages,
      aggregateStatus: getAggregateStatus(pages),
    };
  });

  const attentionItems = [
    ...systemEntries
      .filter((entry) => entry.status && !isHealthyStatus(entry.status))
      .map((entry) => ({
        id: `system-${entry.id}`,
        label: entry.label,
        status: entry.status,
        note: entry.note,
      })),
    ...siteOverview
      .filter(
        (site) => site.aggregateStatus === "offline" || site.aggregateStatus === "degraded"
      )
      .map((site) => ({
        id: `site-${site.id}`,
        label: site.title,
        status: site.aggregateStatus,
        note: `${site.pages.length} pages tracked`,
      })),
  ];

  const handleAddNote = (event) => {
    event.preventDefault();
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const newNote = {
      id: `${Date.now()}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setIncidentNotes((prev) => [newNote, ...prev]);
    setNoteDraft("");
  };

  const handleClearNotes = () => {
    setIncidentNotes([]);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">System operations</p>
          <h1>System health</h1>
          <p className="muted">
            Last synced {lastSyncedLabel} | Site check {lastCheckedLabel}
          </p>
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
          <a className="button button-ghost" href="#incident-notes">
            Incident notes
          </a>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading system health...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {kpiData ? (
        <div className="page-grid">
          <div className="stack">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Service status</h3>
                  <p className="muted">API and database checks.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-3">
                  <span>Service</span>
                  <span>Status</span>
                  <span>Notes</span>
                </div>
                {systemEntries.map((row) => (
                  <div className="table-row is-3" key={row.id}>
                    <span className="table-strong">{row.label}</span>
                    {renderStatusPill(row.status)}
                    <span className="muted">{row.note}</span>
                  </div>
                ))}
              </div>
            </article>

            <section className="panel site-status" id="site-health">
              <div className="panel-header">
                <div>
                  <h3>Website health</h3>
                  <p className="muted">Last refreshed {lastCheckedLabel}.</p>
                </div>
              </div>
              <div className="site-grid">
                {siteOverview.length ? (
                  siteOverview.map((site) => (
                    <article key={site.id} className="site-card">
                      <div className="site-card__header">
                        <span className="table-strong">{site.title}</span>
                        {renderStatusPill(site.aggregateStatus)}
                      </div>
                      <div className="site-card__list">
                        {site.pages.map((page) => (
                          <div className="site-card__row" key={page.url}>
                            <span>{page.label}</span>
                            {renderStatusPill(page.status)}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">No site checks yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="stack">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Attention required</h3>
                  <p className="muted">Items needing a quick check.</p>
                </div>
              </div>
              <div className="list">
                {attentionItems.length ? (
                  attentionItems.map((item) => (
                    <div className="list-row is-split" key={item.id}>
                      <div>
                        <span className="table-strong">{item.label}</span>
                        <span className="muted">{item.note}</span>
                      </div>
                      {renderStatusPill(item.status)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No alerts right now.</p>
                )}
              </div>
            </article>

            <article className="panel" id="incident-notes">
              <div className="panel-header">
                <div>
                  <h3>Incident notes</h3>
                  <p className="muted">Track observations during incidents.</p>
                </div>
              </div>
              <form className="stack" onSubmit={handleAddNote}>
                <label className="form-field" htmlFor="incidentNote">
                  <span>New note</span>
                  <textarea
                    id="incidentNote"
                    className="input"
                    placeholder="Add a short incident summary or next step."
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                </label>
                <div className="header-actions">
                  <button className="button button-primary" type="submit">
                    Add note
                  </button>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={handleClearNotes}
                    disabled={!incidentNotes.length}
                  >
                    Clear notes
                  </button>
                </div>
              </form>
              <div className="list">
                {incidentNotes.length ? (
                  incidentNotes.map((note) => (
                    <div className="list-row" key={note.id}>
                      <span className="table-strong">{note.text}</span>
                      <span className="muted">{formatDateTime(note.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No incident notes yet.</p>
                )}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SystemHealth;
