import React from "react";
import useDashboardData from "../../hooks/useDashboardData";
import downloadCsv from "../../utils/exportCsv";
import { formatDateTime } from "../../utils/formatters";

const Reports = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();

  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);

  const handleExportSnapshot = () => {
    if (!kpiData) return;
    const rows = [
      ["Metric", "Value"],
      ["Total organizations", kpiData.totalOrganizations ?? 0],
      ["By Nana organizations", kpiData.portfolio?.organizations ?? 0],
      ["Reebs organizations", kpiData.reebs?.organizations ?? 0],
      ["Faako organizations", kpiData.faako?.organizations ?? 0],
    ];
    downloadCsv("dashboard_snapshot.csv", rows);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Exports</p>
          <h1>Reports</h1>
          <p className="muted">Last synced {lastSyncedLabel}</p>
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

      {loading ? (
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

      {kpiData ? (
        <div className="panel-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Available exports</h3>
                <p className="muted">Quick CSV snapshots for ops review.</p>
              </div>
            </div>
            <div className="stack">
              <button
                className="button button-ghost"
                type="button"
                onClick={handleExportSnapshot}
                disabled={!kpiData}
              >
                Dashboard snapshot CSV
              </button>
              <div className="notice">
                Exports are generated from the latest dashboard sync.
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Report queue</h3>
                <p className="muted">Schedule recurring exports.</p>
              </div>
            </div>
            <div className="list">
              <div className="list-row is-split">
                <span className="table-strong">Weekly KPI rollup</span>
                <span className="muted">Mondays at 09:00 UTC • dev@nanaabaackah.com</span>
              </div>
              <div className="list-row is-split">
                <span className="table-strong">Accounting audit</span>
                <span className="muted">Not scheduled</span>
              </div>
              <div className="list-row is-split">
                <span className="table-strong">Access review</span>
                <span className="muted">Not scheduled</span>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
};

export default Reports;
