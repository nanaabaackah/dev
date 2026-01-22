import React from "react";
import useDashboardData from "../hooks/useDashboardData";
import { formatDateTime } from "../utils/formatters";

const Inventory = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();

  const lastSyncedLabel = formatDateTime(kpiData?.lastSyncedAt);
  const totalInventory = kpiData?.totalInventoryItems ?? "N/A";
  const reebsInventory = kpiData?.reebs?.inventoryItems ?? 0;
  const reebsUsers = kpiData?.reebs?.users ?? 0;
  const inventoryPerUser =
    kpiData?.insights?.inventoryPerReebsUser ??
    (reebsUsers ? Math.round((reebsInventory / reebsUsers) * 10) / 10 : "N/A");

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Reebs operations</p>
          <h1>Inventory</h1>
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
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading inventory data...</span>
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
              { id: "total", label: "Total inventory items", value: totalInventory },
              { id: "reebs", label: "Reebs inventory items", value: reebsInventory },
              { id: "per-user", label: "Items per Reebs user", value: inventoryPerUser },
            ].map((metric) => (
              <article className="panel metric-card" key={metric.id}>
                <span className="kpi-label">{metric.label}</span>
                <div className="kpi-value">{metric.value}</div>
              </article>
            ))}
          </div>

          <div className="panel-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Inventory signal</h3>
                  <p className="muted">Operational context for stock tracking.</p>
                </div>
              </div>
              <div className="stack">
                <div className="list-row is-split">
                  <span className="table-strong">Reebs users</span>
                  <span>{reebsUsers}</span>
                </div>
                <div className="list-row is-split">
                  <span className="table-strong">Avg items per user</span>
                  <span>{inventoryPerUser}</span>
                </div>
              </div>
            </article>
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Inventory focus</h3>
                  <p className="muted">Highlight what to watch today.</p>
                </div>
              </div>
              <div className="list">
                <div className="list-row is-split">
                  <span className="table-strong">High-volume tenants</span>
                  <span className="muted">Review weekly deltas</span>
                </div>
                <div className="list-row is-split">
                  <span className="table-strong">Low stock alerts</span>
                  <span className="muted">Connect to ops runbook</span>
                </div>
                <div className="list-row is-split">
                  <span className="table-strong">Warehouse sync</span>
                  <span className="muted">Ensure nightly jobs run</span>
                </div>
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default Inventory;
