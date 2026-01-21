import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../api-url";
import "./Dashboard.css";

const STATUS_LABELS = {
  ok: "Healthy",
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  error: "Error",
  unknown: "Unknown",
  not_configured: "Not configured",
};

const STATUS_TONES = {
  ok: "success",
  online: "success",
  degraded: "warning",
  offline: "danger",
  error: "danger",
  unknown: "info",
  not_configured: "info",
  active: "success",
  pending: "warning",
  suspended: "danger",
};

const formatStatusLabel = (status) => {
  if (!status) return "Unknown";
  const label = STATUS_LABELS[status] || status.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const Dashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
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
        const response = await fetch(buildApiUrl("/api/dashboard"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          throw new Error(payload?.error || "Unable to load dashboard");
        }
        setKpiData(payload);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = () => {
    if (!isRefreshing) {
      loadDashboard({ silent: true });
    }
  };

  const getStatusTone = (status) => STATUS_TONES[status] || "info";

  const renderStatusPill = (status) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{formatStatusLabel(status)}</span>;
  };

  const renderStatusCount = (status, count) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{count}</span>;
  };

  const getAggregateStatus = (pages = []) => {
    if (!pages.length) return "unknown";
    if (pages.some((page) => page.status === "offline")) return "offline";
    if (pages.some((page) => page.status === "degraded")) return "degraded";
    if (pages.every((page) => page.status === "online")) return "online";
    return "unknown";
  };

  const roleBreakdown = kpiData?.roleBreakdown ?? [];
  const userStatusBreakdown = kpiData?.userStatusBreakdown ?? [];
  const organizationStatusBreakdown = kpiData?.organizationStatusBreakdown ?? [];
  const insights = kpiData?.insights ?? {};

  const siteStatuses = kpiData?.siteStatus?.sites ?? [];
  const systemStatus = kpiData?.status ?? {};
  const lastSyncedLabel = kpiData?.lastSyncedAt ? formatDateTime(kpiData.lastSyncedAt) : "N/A";
  const lastCheckedLabel = kpiData?.siteStatus?.checkedAt
    ? formatDateTime(kpiData.siteStatus.checkedAt)
    : "N/A";

  return (
    <section className="page dashboard">
      <div className="panel dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>ERP KPI Command Center</h1>
          <p className="muted">
            Last synced {lastSyncedLabel} | Sites tracked {siteStatuses.length} | Last check{" "}
            {lastCheckedLabel}
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? "Refreshing..." : "Refresh metrics"}
          </button>
          <a className="button button-ghost" href="#site-status">
            Site status
          </a>
        </div>
      </div>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading dashboard data...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {kpiData ? (
        <>
          <div className="kpi-grid">
            {[
              {
                id: "orgs",
                label: "Organizations",
                value: kpiData.totalOrganizations,
                delta: `Portfolio ${kpiData.portfolio?.organizations ?? 0} | Reebs ${
                  kpiData.reebs?.organizations ?? 0
                } | Faako ${kpiData.faako?.organizations ?? 0}`,
              },
              {
                id: "users",
                label: "Users",
                value: kpiData.totalUsers,
                delta: `Portfolio ${kpiData.portfolio?.users ?? 0} | Reebs ${
                  kpiData.reebs?.users ?? 0
                } | Faako ${kpiData.faako?.users ?? 0}`,
              },
              {
                id: "inventory",
                label: "Inventory items",
                value: kpiData.totalInventoryItems,
                delta: `Reebs inventory tracked`,
                tone: "warning",
              },
            ].map((card) => (
              <article className="panel kpi-card" key={card.id}>
                <span className="kpi-label">{card.label}</span>
                <div className="kpi-value">{card.value ?? "N/A"}</div>
                <span className={`kpi-delta ${card.tone ? `is-${card.tone}` : ""}`.trim()}>
                  {card.delta}
                </span>
              </article>
            ))}
          </div>

          <div className="panel-grid">
            {[
              {
                id: "avg-users",
                label: "Avg users per org",
                value: insights.averageUsersPerOrg ?? "N/A",
                hint: "Portfolio data",
              },
              {
                id: "inventory-per-user",
                label: "Inventory per Reebs user",
                value: insights.inventoryPerReebsUser ?? "N/A",
                hint: "Reebs ops signal",
              },
            ].map((insight) => (
              <article className="panel metric-card" key={insight.id}>
                <span className="kpi-label">{insight.label}</span>
                <div className="kpi-value">{insight.value}</div>
                <span className="muted">{insight.hint}</span>
              </article>
            ))}
          </div>

          <div className="dashboard-grid">
            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Data sources</h3>
                  <p className="muted">Portfolio, Reebs, and Faako totals.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-4">
                  <span>Source</span>
                  <span>Orgs</span>
                  <span>Users</span>
                  <span>Inventory</span>
                </div>
                {[
                  {
                    id: "portfolio",
                    label: "Portfolio",
                    orgs: kpiData.portfolio?.organizations ?? 0,
                    users: kpiData.portfolio?.users ?? 0,
                    inventory: "N/A",
                  },
                  {
                    id: "reebs",
                    label: "Reebs",
                    orgs: kpiData.reebs?.organizations ?? 0,
                    users: kpiData.reebs?.users ?? 0,
                    inventory: kpiData.reebs?.inventoryItems ?? 0,
                  },
                  {
                    id: "faako",
                    label: "Faako",
                    orgs: kpiData.faako?.organizations ?? 0,
                    users: kpiData.faako?.users ?? 0,
                    inventory: "N/A",
                  },
                ].map((row) => (
                  <div className="table-row is-4" key={row.id}>
                    <span className="table-strong">{row.label}</span>
                    <span>{row.orgs}</span>
                    <span>{row.users}</span>
                    <span>{row.inventory}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>System status</h3>
                  <p className="muted">API and database checks.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-3">
                  <span>Service</span>
                  <span>Status</span>
                  <span>Notes</span>
                </div>
                {[
                  { id: "api", label: "API", status: systemStatus.api, note: "Auth + metrics" },
                  {
                    id: "portfolio",
                    label: "Portfolio DB",
                    status: systemStatus.portfolioDb,
                    note: "Primary org data",
                  },
                  {
                    id: "reebs",
                    label: "Reebs DB",
                    status: systemStatus.reebsDb,
                    note: "Products and inventory",
                  },
                  {
                    id: "faako",
                    label: "Faako DB",
                    status: systemStatus.faakoDb,
                    note: "ERP users",
                  },
                ].map((row) => (
                  <div className="table-row is-3" key={row.id}>
                    <span className="table-strong">{row.label}</span>
                    {renderStatusPill(row.status)}
                    <span className="muted">{row.note}</span>
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

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Organization statuses</h3>
                  <p className="muted">All orgs tracked.</p>
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
                  <p className="muted">No org statuses yet.</p>
                )}
              </div>
            </article>
          </div>

          <section className="panel site-status" id="site-status">
            <div className="panel-header">
              <div>
                <h3>Website health</h3>
                <p className="muted">Last refreshed {lastCheckedLabel}.</p>
              </div>
            </div>
            <div className="site-grid">
              {siteStatuses.length ? (
                siteStatuses.map((site) => {
                  const pages = site.pages ?? [];
                  const aggregateStatus = getAggregateStatus(pages);
                  return (
                    <article key={site.id} className="site-card">
                      <div className="site-card__header">
                        <span className="table-strong">{site.title}</span>
                        {renderStatusPill(aggregateStatus)}
                      </div>
                      <div className="site-card__list">
                        {pages.map((page) => (
                          <div className="site-card__row" key={page.url}>
                            <span>{page.label}</span>
                            {renderStatusPill(page.status)}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="muted">No site checks yet.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
};

export default Dashboard;
