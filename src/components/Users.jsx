import React from "react";
import useDashboardData from "../hooks/useDashboardData";
import downloadCsv from "../utils/exportCsv";
import { formatDateTime } from "../utils/formatters";
import { formatStatusLabel, getStatusTone } from "../utils/status";

const Users = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();

  const sources = [
    {
      id: "portfolio",
      label: "Portfolio",
      count: kpiData?.portfolio?.users ?? 0,
      note: "Org directory users",
    },
    {
      id: "reebs",
      label: "Reebs",
      count: kpiData?.reebs?.users ?? 0,
      note: "Commerce operators",
    },
    {
      id: "faako",
      label: "Faako",
      count: kpiData?.faako?.users ?? 0,
      note: "ERP staff",
    },
  ];

  const roleBreakdown = kpiData?.roleBreakdown ?? [];
  const userStatusBreakdown = kpiData?.userStatusBreakdown ?? [];
  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const totalUsers = kpiData?.totalUsers ?? "N/A";

  const getStatusCount = (status) =>
    userStatusBreakdown.find((item) => item.status === status)?.count ?? 0;

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
    roleBreakdown.forEach((role) => {
      rows.push(["Role", role.name, role.users ?? 0]);
    });
    userStatusBreakdown.forEach((status) => {
      rows.push(["Status", formatStatusLabel(status.status), status.count ?? 0]);
    });
    downloadCsv("users_summary.csv", rows);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Identity operations</p>
          <h1>Users</h1>
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
            Export user summary
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading user data...</span>
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
              { id: "total", label: "Total users", value: totalUsers },
              { id: "active", label: "Active users", value: getStatusCount("active") },
              { id: "suspended", label: "Suspended users", value: getStatusCount("suspended") },
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
                  <h3>User sources</h3>
                  <p className="muted">Totals by product.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-3">
                  <span>Source</span>
                  <span>Users</span>
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
                  <h3>Role distribution</h3>
                  <p className="muted">Portfolio org users.</p>
                </div>
              </div>
              <div className="list">
                {roleBreakdown.length ? (
                  roleBreakdown.map((role) => (
                    <div className="list-row is-split" key={role.name}>
                      <span className="table-strong">{role.name}</span>
                      <span>{role.users ?? 0}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No roles yet.</p>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>User statuses</h3>
                  <p className="muted">Active, pending, suspended.</p>
                </div>
              </div>
              <div className="list">
                {userStatusBreakdown.length ? (
                  userStatusBreakdown.map((item) => (
                    <div className="list-row is-split" key={item.status}>
                      <span className="table-strong">{formatStatusLabel(item.status)}</span>
                      {renderStatusCount(item.status, item.count)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No user statuses yet.</p>
                )}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default Users;
