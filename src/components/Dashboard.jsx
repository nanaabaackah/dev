import React, { useState } from "react";
import useDashboardData from "../hooks/useDashboardData";
import { formatDateTime, formatPercent, formatRatio } from "../utils/formatters";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../utils/status";
import "./Dashboard.css";

const RANGE_OPTIONS = [
  { value: "24h", label: "24H", description: "Last 24 hours", hours: 24 },
  { value: "7d", label: "7D", description: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "30D", description: "Last 30 days", hours: 24 * 30 },
];

const Dashboard = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [timeRange, setTimeRange] = useState("7d");

  const handleRefresh = () => {
    if (!isRefreshing) {
      reload({ silent: true });
    }
  };

  const activeRange = RANGE_OPTIONS.find((option) => option.value === timeRange) || RANGE_OPTIONS[1];
  const rangeDescription = activeRange.description;
  const rangeWindowMs = activeRange.hours * 60 * 60 * 1000;

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

  const systemEntries = [
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

  const sitePages = siteOverview.flatMap((site) => site.pages);
  const totalServices = systemEntries.filter((entry) => entry.status).length;
  const healthyServices = systemEntries.filter(
    (entry) => entry.status && isHealthyStatus(entry.status)
  ).length;
  const totalSites = siteOverview.length;
  const onlineSites = siteOverview.filter((site) => site.aggregateStatus === "online").length;
  const totalPages = sitePages.length;
  const onlinePages = sitePages.filter((page) => page.status === "online").length;
  const serviceHealthPercent = formatPercent(healthyServices, totalServices);
  const siteHealthPercent = formatPercent(onlineSites, totalSites);
  const pageHealthPercent = formatPercent(onlinePages, totalPages);

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

  const baseTimelineEvents = [
    kpiData?.lastSyncedAt
      ? {
          id: "sync",
          timestamp: kpiData.lastSyncedAt,
          title: "KPI ingestion completed",
          detail: `Orgs ${kpiData.totalOrganizations ?? 0} | Users ${
            kpiData.totalUsers ?? 0
          } | Inventory ${kpiData.totalInventoryItems ?? 0}`,
          badge: "Sync",
          priority: "normal",
        }
      : null,
    kpiData?.siteStatus?.checkedAt
      ? {
          id: "site-check",
          timestamp: kpiData.siteStatus.checkedAt,
          title: "Website health check",
          detail: `${onlineSites}/${totalSites} sites online | ${onlinePages}/${totalPages} pages online`,
          badge: attentionItems.length ? "Alert" : "Check",
          priority: attentionItems.length ? "urgent" : "normal",
        }
      : null,
  ].filter(Boolean);

  const timelineEvents = baseTimelineEvents
    .filter((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      if (Number.isNaN(eventTime)) return false;
      return Date.now() - eventTime <= rangeWindowMs;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <section className="page dashboard">
      <div className="panel dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>ERP KPI Command Center</h1>
          <p className="muted">
            Window {rangeDescription} | Last synced {lastSyncedLabel} | Sites tracked{" "}
            {siteStatuses.length} | Last check {lastCheckedLabel}
          </p>
        </div>
        <div className="hero-actions">
          <div className="segmented" role="tablist" aria-label="Time range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`segment ${option.value === timeRange ? "is-active" : ""}`}
                type="button"
                aria-pressed={option.value === timeRange}
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
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
          <p className="muted">KPI window: {rangeDescription}.</p>
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
                {systemEntries.map((row) => (
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
                  <h3>Operational snapshot</h3>
                  <p className="muted">Services, sites, and page uptime.</p>
                </div>
              </div>
              <div className="stack">
                <div className="health-row">
                  <div className="health-row__header">
                    <span className="table-strong">Services healthy</span>
                    <span>{formatRatio(healthyServices, totalServices)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${serviceHealthPercent}%` }} />
                  </div>
                </div>
                <div className="health-row">
                  <div className="health-row__header">
                    <span className="table-strong">Sites online</span>
                    <span>{formatRatio(onlineSites, totalSites)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${siteHealthPercent}%` }} />
                  </div>
                </div>
                <div className="health-row">
                  <div className="health-row__header">
                    <span className="table-strong">Pages online</span>
                    <span>{formatRatio(onlinePages, totalPages)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${pageHealthPercent}%` }} />
                  </div>
                </div>
              </div>
            </article>

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

            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Activity timeline</h3>
                  <p className="muted">Sync and status checks in the {rangeDescription} window.</p>
                </div>
              </div>
              <div className="timeline">
                {timelineEvents.length ? (
                  timelineEvents.map((event) => (
                    <div className="timeline-row" key={event.id}>
                      <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
                      <div>
                        <span className="table-strong">{event.title}</span>
                        <p className="muted">{event.detail}</p>
                      </div>
                      <span className={`priority is-${event.priority}`}>{event.badge}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No activity logged in this window.</p>
                )}
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
                <p className="muted">
                  Window {rangeDescription} | Last refreshed {lastCheckedLabel}.
                </p>
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
        </>
      ) : null}
    </section>
  );
};

export default Dashboard;
