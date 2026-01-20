import React, { useState, useEffect, useCallback } from 'react';
import { Spinner, Alert, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../api-url';
import './Dashboard.css';

const STATUS_LABELS = {
  ok: "Healthy",
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  error: "Error",
  unknown: "Unknown",
  not_configured: "Not configured",
};

const formatStatusLabel = (status) => {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] || status.replace(/_/g, " ");
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const renderStatusBadge = (status) => {
    let variant = "secondary";
    if (status === "ok") variant = "success";
    else if (["error", "offline"].includes(status)) variant = "danger";
    else if (status === "degraded") variant = "warning";
    return (
      <span className={`badge bg-${variant} status-pill`} aria-label={formatStatusLabel(status)}>
        {formatStatusLabel(status)}
      </span>
    );
  };

  const summaryCards = [
    { label: "Organizations", value: kpiData?.totalOrganizations, accent: "cyan" },
    { label: "Users", value: kpiData?.totalUsers, accent: "violet" },
    { label: "Inventory items", value: kpiData?.totalInventoryItems, accent: "amber" },
  ];

  const roleBreakdown = kpiData?.roleBreakdown ?? [];
  const userStatusBreakdown = kpiData?.userStatusBreakdown ?? [];
  const organizationStatusBreakdown = kpiData?.organizationStatusBreakdown ?? [];
  const insights = kpiData?.insights ?? {};

  const siteStatuses = kpiData?.siteStatus?.sites ?? [];
  const systemStatus = kpiData?.status ?? {};
  const lastSyncedLabel = kpiData?.lastSyncedAt ? formatDateTime(kpiData.lastSyncedAt) : "—";
  const lastCheckedLabel = kpiData?.siteStatus?.checkedAt ? formatDateTime(kpiData.siteStatus.checkedAt) : "—";

  return (
    <div className="dashboard-page">
      <header className="dashboard-nav">
        <div>
          <p className="dashboard-nav__eyebrow">dev.nanaabaackah.com</p>
          <h1 className="dashboard-nav__title">ERP KPI Command Center</h1>
        </div>
        <div className="dashboard-nav__actions">
          <Button variant="outline-light" onClick={handleRefresh} disabled={isRefreshing || loading} className="me-2">
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button variant="light" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="dashboard-main">
        {loading ? (
          <div className="dashboard-spinner">
            <Spinner animation="grow" role="status" variant="light" />
            <span className="visually-hidden">Loading...</span>
          </div>
        ) : null}

        {error && (
          <Alert variant="danger" className="dashboard-alert">
            {error}
          </Alert>
        )}

        {kpiData && (
          <>
            <section className="dashboard-hero">
              <div>
                <p className="dashboard-hero__eyebrow">Live ERP data</p>
                <h2 className="dashboard-hero__title">Everything in sync</h2>
                <p className="dashboard-hero__subtitle">
                  KPI insight collected from the portfolio, Reebs, and Faako databases along with system health checks and uptime data.
                </p>
              </div>
              <div className="dashboard-hero__meta">
                <div>
                  <span>Last synced</span>
                  <strong>{lastSyncedLabel}</strong>
                </div>
                <div>
                  <span>Sites checked</span>
                  <strong>{siteStatuses.length}</strong>
                </div>
                <div>
                  <span>Last site check</span>
                  <strong>{lastCheckedLabel}</strong>
                </div>
              </div>
            </section>

            <section className="summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className={`summary-card summary-card--${card.accent}`}>
                  <p className="summary-card__label">{card.label}</p>
                  <p className="summary-card__value">{card.value ?? "—"}</p>
                </article>
              ))}
            </section>

            <section className="insight-grid">
              <div className="insight-card">
                <p className="insight-card__label">Avg. users per org</p>
                <p className="insight-card__value">{insights.averageUsersPerOrg ?? "—"}</p>
                <p className="insight-card__hint">Portfolio database</p>
              </div>
              <div className="insight-card">
                <p className="insight-card__label">Inventory / Reebs user</p>
                <p className="insight-card__value">{insights.inventoryPerReebsUser ?? "—"}</p>
                <p className="insight-card__hint">Operational load</p>
              </div>
            </section>

            <section className="panel-grid">
              <article className="panel">
                <div className="panel__header">
                  <h3>System status</h3>
                  <span className="panel__meta">API + databases</span>
                </div>
                <div className="panel__content panel__grid">
                  <div>
                    <p className="panel__label">API</p>
                    {renderStatusBadge(systemStatus.api)}
                  </div>
                  <div>
                    <p className="panel__label">Portfolio DB</p>
                    {renderStatusBadge(systemStatus.portfolioDb)}
                  </div>
                  <div>
                    <p className="panel__label">Reebs DB</p>
                    {renderStatusBadge(systemStatus.reebsDb)}
                  </div>
                  <div>
                    <p className="panel__label">Faako DB</p>
                    {renderStatusBadge(systemStatus.faakoDb)}
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel__header">
                  <h3>Role distribution</h3>
                  <span className="panel__meta">Portfolio org users</span>
                </div>
                <ul className="panel__list">
                  {roleBreakdown.map((role) => (
                    <li key={role.name}>
                      <span>{role.name}</span>
                      <strong>{role.users ?? 0}</strong>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="panel">
                <div className="panel__header">
                  <h3>User statuses</h3>
                  <span className="panel__meta">Active / pending / suspended</span>
                </div>
                <div className="panel__status-chips">
                  {userStatusBreakdown.map((item) => (
                    <span key={item.status} className="status-chip">
                      <strong>{item.count}</strong>
                      <span>{formatStatusLabel(item.status)}</span>
                    </span>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel__header">
                  <h3>Organization statuses</h3>
                  <span className="panel__meta">All orgs tracked</span>
                </div>
                <ul className="panel__list">
                  {organizationStatusBreakdown.map((item) => (
                    <li key={item.status}>
                      <span>{formatStatusLabel(item.status)}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="site-status">
              <div className="panel__header">
                <h3>Website health</h3>
                <span className="panel__meta">Last refreshed: {lastCheckedLabel}</span>
              </div>
              <div className="site-status__grid">
                {siteStatuses.map((site) => (
                  <article key={site.id} className="site-card">
                    <div className="site-card__header">
                      <strong>{site.title}</strong>
                      {renderStatusBadge(site.status)}
                    </div>
                    <ul>
                      {site.pages.map((page) => (
                        <li key={page.url}>
                          <span>{page.label}</span>
                          {renderStatusBadge(page.status)}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>Built for Nana Aba Ackah — SaaS KPI monitoring</p>
        <p>
          API: <a href="https://nanaabaackah.com/api/dashboard">nanaabaackah.com/api</a> · contact{" "}
          <a href="mailto:hello@nanaabaackah.com">hello@nanaabaackah.com</a>
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
