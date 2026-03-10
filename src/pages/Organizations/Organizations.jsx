import React from "react";
import useDashboardData from "../../hooks/useDashboardData";
import downloadCsv from "../../utils/exportCsv";
import { formatDateTime } from "../../utils/formatters";
import { formatStatusLabel, getStatusTone } from "../../utils/status";

const Organizations = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const organizations = Array.isArray(kpiData?.organizations) ? kpiData.organizations : [];
  const organizationStatusBreakdown = kpiData?.organizationStatusBreakdown ?? [];
  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const totalOrganizations = kpiData?.totalOrganizations ?? 0;
  const topLevelOrganizations =
    kpiData?.topLevelOrganizations ?? organizations.filter((item) => item.isTopLevel).length;
  const childOrganizations =
    kpiData?.childOrganizations ??
    organizations.filter((item) => item.parentOrganizationId).length;

  const renderStatusPill = (status) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{formatStatusLabel(status)}</span>;
  };

  const renderStatusCount = (status, count) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{count}</span>;
  };

  const handleExport = () => {
    const rows = [["Organization", "Parent", "Child orgs", "Manages", "Status"]];
    organizations.forEach((organization) => {
      rows.push([
        organization.name,
        organization.parentOrganizationName || "",
        organization.childOrganizationsCount ?? 0,
        organization.managedOrganizationsCount ?? 0,
        formatStatusLabel(organization.status),
      ]);
    });
    downloadCsv("organizations_summary.csv", rows);
  };

  return (
    <section className="page organizations-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Organization hierarchy</p>
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
              { id: "top-level", label: "Top-level groups", value: topLevelOrganizations },
              { id: "child", label: "Child organizations", value: childOrganizations },
            ].map((metric) => (
              <article className="panel metric-card" key={metric.id}>
                <span className="kpi-label">{metric.label}</span>
                <div className="kpi-value">{metric.value}</div>
              </article>
            ))}
          </div>

          <div className="dashboard-grid organizations-grid">
            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Organization structure</h3>
                  <p className="muted">Parent-child hierarchy and managed organization totals.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-5">
                  <span>Organization</span>
                  <span>Parent</span>
                  <span>Child orgs</span>
                  <span>Manages</span>
                  <span>Status</span>
                </div>
                {organizations.map((organization) => (
                  <div className="table-row is-5" key={organization.id}>
                    <div className="table-cell-stack">
                      <span className="table-strong">{organization.name}</span>
                      <span className="muted">{organization.slug}</span>
                      {organization.childOrganizationsCount ? (
                        <span className="muted">
                          Children:{" "}
                          {organization.childOrganizations.map((child) => child.name).join(", ")}
                        </span>
                      ) : null}
                    </div>
                    <span>{organization.parentOrganizationName || "—"}</span>
                    <span>{organization.childOrganizationsCount ?? 0}</span>
                    <span>{organization.managedOrganizationsCount ?? 0}</span>
                    {renderStatusPill(organization.status)}
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Organization statuses</h3>
                  <p className="muted">Status counts across all organizations.</p>
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
