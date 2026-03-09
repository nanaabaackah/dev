import React, { useEffect, useMemo, useState } from "react";
import useDashboardData from "../../hooks/useDashboardData";
import { formatDateTime } from "../../utils/formatters";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../../utils/status";

const INCIDENT_NOTES_KEY = "dev-incident-notes";
const INCIDENT_NOTE_DISMISSED_KEY = "dev-incident-note-dismissed";

const readStoredJsonArray = (storageKey) => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(storageKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toIncidentKey = (item) => `${item.id}:${item.status}`;

const buildAutomaticIncidentNote = (item) => {
  const statusLabel = formatStatusLabel(item.status).toLowerCase();
  return `${item.label} marked ${statusLabel}. ${item.note}`;
};

const SystemHealth = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [noteDraft, setNoteDraft] = useState("");
  const [incidentNotes, setIncidentNotes] = useState(() => readStoredJsonArray(INCIDENT_NOTES_KEY));
  const [dismissedIncidentKeys, setDismissedIncidentKeys] = useState(() =>
    readStoredJsonArray(INCIDENT_NOTE_DISMISSED_KEY)
  );

  useEffect(() => {
    localStorage.setItem(INCIDENT_NOTES_KEY, JSON.stringify(incidentNotes));
  }, [incidentNotes]);

  useEffect(() => {
    localStorage.setItem(INCIDENT_NOTE_DISMISSED_KEY, JSON.stringify(dismissedIncidentKeys));
  }, [dismissedIncidentKeys]);

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
  const rawSiteStatuses = kpiData?.siteStatus?.sites;
  const siteStatuses = useMemo(
    () => (Array.isArray(rawSiteStatuses) ? rawSiteStatuses : []),
    [rawSiteStatuses]
  );
  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const lastCheckedLabel = kpiData?.siteStatus?.checkedAt
    ? formatDateTime(kpiData.siteStatus.checkedAt)
    : "N/A";

  const systemEntries = useMemo(
    () => [
      { id: "api", label: "API", status: systemStatus.api, note: "Auth + metrics" },
      {
        id: "portfolio",
        label: "Primary DB",
        status: systemStatus.portfolioDb,
        note: "Core organization data",
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
    ],
    [systemStatus.api, systemStatus.faakoDb, systemStatus.portfolioDb, systemStatus.reebsDb]
  );

  const siteOverview = useMemo(
    () =>
      siteStatuses.map((site) => {
        const pages = site.pages ?? [];
        return {
          id: site.id,
          title: site.title,
          pages,
          aggregateStatus: getAggregateStatus(pages),
        };
      }),
    [siteStatuses]
  );

  const attentionItems = useMemo(
    () => [
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
    ],
    [siteOverview, systemEntries]
  );

  useEffect(() => {
    const activeIncidentKeys = attentionItems.map(toIncidentKey);
    setDismissedIncidentKeys((prev) => {
      const next = prev.filter((incidentKey) => activeIncidentKeys.includes(incidentKey));
      return next.length === prev.length ? prev : next;
    });
  }, [attentionItems]);

  useEffect(() => {
    if (!attentionItems.length) return;

    setIncidentNotes((prev) => {
      const existingIncidentKeys = new Set(
        prev
          .map((note) => String(note?.incidentKey || "").trim())
          .filter(Boolean)
      );
      const suppressedIncidentKeys = new Set(
        dismissedIncidentKeys.map((incidentKey) => String(incidentKey || "").trim()).filter(Boolean)
      );
      const createdAt = new Date().toISOString();
      const automaticNotes = attentionItems
        .filter((item) => {
          const incidentKey = toIncidentKey(item);
          return (
            !existingIncidentKeys.has(incidentKey) &&
            !suppressedIncidentKeys.has(incidentKey)
          );
        })
        .map((item) => ({
          id: `incident-${item.id}-${item.status}-${Date.now()}`,
          text: buildAutomaticIncidentNote(item),
          createdAt,
          incidentKey: toIncidentKey(item),
          kind: "auto",
        }));

      return automaticNotes.length ? [...automaticNotes, ...prev] : prev;
    });
  }, [attentionItems, dismissedIncidentKeys]);

  const handleAddNote = (event) => {
    event.preventDefault();
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const newNote = {
      id: `${Date.now()}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
      kind: "manual",
    };
    setIncidentNotes((prev) => [newNote, ...prev]);
    setNoteDraft("");
  };

  const handleClearNotes = () => {
    setDismissedIncidentKeys(attentionItems.map(toIncidentKey));
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
                      <div className="table-cell-stack">
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
                      <div className="table-cell-stack">
                        <span className="table-strong">{note.text}</span>
                        {note.kind === "auto" ? (
                          <span className="muted">Automatic incident note</span>
                        ) : null}
                      </div>
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
