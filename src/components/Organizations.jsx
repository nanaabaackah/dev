import React from "react";
import useDashboardData from "../hooks/useDashboardData";
import downloadCsv from "../utils/exportCsv";
import { formatDateTime } from "../utils/formatters";
import { formatStatusLabel, getStatusTone } from "../utils/status";

const Organizations = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();

  const sources = [
    {
      id: "portfolio",
      label: "Portfolio",
      count: kpiData?.portfolio?.organizations ?? 0,
      note: "Primary org data",
    },
    {
      id: "reebs",
      label: "Reebs",
      count: kpiData?.reebs?.organizations ?? 0,
      note: "Commerce tenants",
    },
    {
      id: "faako",
      label: "Faako",
      count: kpiData?.faako?.organizations ?? 0,
      note: "ERP workspace",
    },
  ];

  const organizationStatusBreakdown = kpiData?.organizationStatusBreakdown ?? [];
  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const totalOrganizations = kpiData?.totalOrganizations ?? "N/A";

  const getStatusCount = (status) =>
    organizationStatusBreakdown.find((item) => item.status === status)?.count ?? 0;

  const renderStatusCount = (status, count) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{count}</span>;
  };

  const handleExport = () => {
    if (!kpiData) return;
    const rows = [["Section", "Label", "Count"]];
    sources.forEach((source) => {
      rows.push(["Source", source.label, source.count]);
    });
    organizationStatusBreakdown.forEach((status) => {
      rows.push(["Status", formatStatusLabel(status.status), status.count ?? 0]);
    });
    downloadCsv("organizations_summary.csv", rows);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio coverage</p>
          <h1>Organizations</h1>
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
            onClick={handleExport}
            disabled={!kpiData}
          >
            Export org summary
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading organization data...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {kpiData ? (
        <>
          <div className="panel-grid">
            {[
              { id: "total", label: "Total organizations", value: totalOrganizations },
              { id: "active", label: "Active orgs", value: getStatusCount("active") },
              { id: "pending", label: "Pending orgs", value: getStatusCount("pending") },
            ].map((metric) => (
              <article className="panel metric-card" key={metric.id}>
                <span className="kpi-label">{metric.label}</span>
                <div className="kpi-value">{metric.value}</div>
              </article>
            ))}
          </div>

          <div className="dashboard-grid">
            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Organization sources</h3>
                  <p className="muted">Totals by database.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-3">
                  <span>Source</span>
                  <span>Organizations</span>
                  <span>Notes</span>
                </div>
                {sources.map((source) => (
                  <div className="table-row is-3" key={source.id}>
                    <span className="table-strong">{source.label}</span>
                    <span>{source.count}</span>
                    <span className="muted">{source.note}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Organization statuses</h3>
                  <p className="muted">Active, pending, suspended.</p>
                </div>
              </div>
              <div className="list">
                {organizationStatusBreakdown.length ? (
                  organizationStatusBreakdown.map((item) => (
                    <div className="list-row is-split" key={item.status}>
                      <span className="table-strong">{formatStatusLabel(item.status)}</span>
                      {renderStatusCount(item.status, item.count)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No organization statuses yet.</p>
                )}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default Organizations;
