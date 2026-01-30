import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../api-url";

const RANGE_OPTIONS = [
  { value: "mtd", label: "MTD" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const RANGE_LABELS = {
  mtd: "Month to date",
  weekly: "Week to date",
  monthly: "Last 30 days",
  quarterly: "Quarter to date",
  yearly: "Year to date",
};

const STATUS_TONE = {
  PAID: "success",
  PENDING: "warning",
  SCHEDULED: "info",
  OVERDUE: "danger",
};

const TYPE_OPTIONS = [
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
];

const STATUS_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "OVERDUE", label: "Overdue" },
];

const CURRENCY_OPTIONS = ["CAD", "GHS"];
const INTERVAL_OPTIONS = [
  { value: "", label: "One-time" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatAmountValue = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatAmount = (amount, currency) => `${currency} ${formatAmountValue(amount)}`;

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const resolveEntryDate = (entry) => {
  if (entry.status === "PAID") {
    return entry.paidAt || entry.createdAt;
  }
  return entry.dueAt || entry.createdAt;
};

const Accounting = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("mtd");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [faakoStatus, setFaakoStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formState, setFormState] = useState({
    type: "EXPENSE",
    status: "PENDING",
    currency: "CAD",
    amount: "",
    serviceName: "",
    detail: "",
    date: buildTodayDate(),
    recurringInterval: "",
  });

  const loadEntries = useCallback(
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
        const response = await fetch(
          buildApiUrl(`/api/accounting/entries?range=${encodeURIComponent(timeRange)}`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          throw new Error(payload?.error || "Unable to load accounting data");
        }
        setEntries(payload.entries || []);
        setFaakoStatus(payload.faakoStatus || "");
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigate, timeRange]
  );

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const summary = useMemo(() => {
    const base = {
      paidRevenue: { CAD: 0, GHS: 0 },
      paidExpenses: { CAD: 0, GHS: 0 },
      pendingPayables: { CAD: 0, GHS: 0 },
      counts: {
        paidRevenue: 0,
        paidExpenses: 0,
        pendingPayables: 0,
      },
    };

    entries.forEach((entry) => {
      const amount = Number(entry.amount || 0);
      if (!Number.isFinite(amount)) return;
      if (entry.type === "REVENUE" && entry.status === "PAID") {
        base.paidRevenue[entry.currency] += amount;
        base.counts.paidRevenue += 1;
      }
      if (entry.type === "EXPENSE" && entry.status === "PAID") {
        base.paidExpenses[entry.currency] += amount;
        base.counts.paidExpenses += 1;
      }
      if (entry.type === "EXPENSE" && entry.status !== "PAID") {
        base.pendingPayables[entry.currency] += amount;
        base.counts.pendingPayables += 1;
      }
    });

    return base;
  }, [entries]);

  const netTotals = useMemo(
    () => ({
      CAD: summary.paidRevenue.CAD - summary.paidExpenses.CAD,
      GHS: summary.paidRevenue.GHS - summary.paidExpenses.GHS,
    }),
    [summary]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const amountValue = Number(formState.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError("Amount must be a positive number.");
      return;
    }

    if (!formState.serviceName.trim()) {
      setFormError("Service name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        type: formState.type,
        status: formState.status,
        currency: formState.currency,
        amount: amountValue,
        serviceName: formState.serviceName.trim(),
        detail: formState.detail.trim() || undefined,
        paidAt: formState.status === "PAID" ? formState.date : undefined,
        dueAt: formState.status !== "PAID" ? formState.date : undefined,
        recurringInterval: formState.recurringInterval || undefined,
      };

      const response = await fetch(buildApiUrl("/api/accounting/entries"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to save entry");
      }

      setShowForm(false);
      setFormState((prev) => ({
        ...prev,
        amount: "",
        serviceName: "",
        detail: "",
        date: buildTodayDate(),
        recurringInterval: "",
      }));
      loadEntries({ silent: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aDate = new Date(resolveEntryDate(a));
      const bDate = new Date(resolveEntryDate(b));
      return bDate - aDate;
    });
  }, [entries]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Accounting</h1>
          <p className="muted">
            Paid services revenue and expenses, including pending payables. Window:{" "}
            {RANGE_LABELS[timeRange] || "Month to date"}.
          </p>
        </div>
        <div className="header-actions">
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
            className="button button-ghost"
            type="button"
            onClick={() => loadEntries({ silent: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Sync ledger"}
          </button>
          <button className="button button-primary" type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close entry" : "Add transaction"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading accounting data...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {faakoStatus && faakoStatus !== "ok" ? (
        <div className="notice" role="status">
          Faako subscription sync status: {faakoStatus.replace(/_/g, " ")}.
        </div>
      ) : null}

      {showForm ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Manual entry</h3>
              <p className="muted">Add expenses or one-off revenue not from Faako subscriptions.</p>
            </div>
          </div>

          {formError ? (
            <div className="notice is-error" role="alert">
              {formError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="stack">
            <div className="page-grid">
              <div className="stack">
                <label className="form-field">
                  <span>Type</span>
                  <select
                    className="input"
                    value={formState.type}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, type: event.target.value }))
                    }
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Status</span>
                  <select
                    className="input"
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, status: event.target.value }))
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Currency</span>
                  <select
                    className="input"
                    value={formState.currency}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, currency: event.target.value }))
                    }
                  >
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Billing cadence</span>
                  <select
                    className="input"
                    value={formState.recurringInterval}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, recurringInterval: event.target.value }))
                    }
                  >
                    {INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value || "once"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="stack">
                <label className="form-field">
                  <span>Amount</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.amount}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    placeholder="0.00"
                  />
                </label>
                <label className="form-field">
                  <span>Service name</span>
                  <input
                    className="input"
                    type="text"
                    value={formState.serviceName}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, serviceName: event.target.value }))
                    }
                    placeholder="Consulting retainer"
                  />
                </label>
                <label className="form-field">
                  <span>{formState.status === "PAID" ? "Paid date" : "Due date"}</span>
                  <input
                    className="input"
                    type="date"
                    value={formState.date}
                    onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
              </div>
            </div>
            <label className="form-field">
              <span>Details (optional)</span>
              <textarea
                className="input"
                value={formState.detail}
                onChange={(event) => setFormState((prev) => ({ ...prev, detail: event.target.value }))}
                placeholder="Add extra context for this transaction"
              />
            </label>
            <div className="header-actions">
              <button className="button button-ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="button button-primary" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save entry"}
              </button>
            </div>
          </form>
        </article>
      ) : null}

      <div className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="muted">Paid revenue</p>
              <div className="health-row">
                <span className="table-strong">{formatAmount(summary.paidRevenue.CAD, "CAD")}</span>
                <span className="table-strong">{formatAmount(summary.paidRevenue.GHS, "GHS")}</span>
              </div>
            </div>
            <span className="status-pill is-success">{summary.counts.paidRevenue} paid</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="muted">Paid expenses</p>
              <div className="health-row">
                <span className="table-strong">{formatAmount(summary.paidExpenses.CAD, "CAD")}</span>
                <span className="table-strong">{formatAmount(summary.paidExpenses.GHS, "GHS")}</span>
              </div>
            </div>
            <span className="status-pill is-info">{summary.counts.paidExpenses} paid</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="muted">Net profit</p>
              <div className="health-row">
                <span className="table-strong">{formatAmount(netTotals.CAD, "CAD")}</span>
                <span className="table-strong">{formatAmount(netTotals.GHS, "GHS")}</span>
              </div>
            </div>
            <span className="status-pill is-success">After paid expenses</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="muted">Pending payables</p>
              <div className="health-row">
                <span className="table-strong">{formatAmount(summary.pendingPayables.CAD, "CAD")}</span>
                <span className="table-strong">{formatAmount(summary.pendingPayables.GHS, "GHS")}</span>
              </div>
            </div>
            <span className="status-pill is-warning">{summary.counts.pendingPayables} pending</span>
          </div>
        </article>
      </div>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Paid services ledger</h3>
            <p className="muted">
              {sortedEntries.length} entries • Amounts tracked in CAD and GHS.
            </p>
          </div>
          <span className="status-pill is-info">{RANGE_LABELS[timeRange] || "Month to date"}</span>
        </div>

        <div className="data-table">
          <div className="table-row is-7 table-head">
            <span>ID</span>
            <span>Service</span>
            <span>Type</span>
            <span>Paid date</span>
            <span>Amount</span>
            <span>Currency</span>
            <span>Status</span>
          </div>
          {sortedEntries.map((entry) => {
            const dateLabel = entry.status === "PAID" ? "Paid date" : "Due date";
            const cadenceLabel = entry.recurringInterval
              ? `Recurring ${entry.recurringInterval.toLowerCase()}`
              : null;
            return (
              <div className="table-row is-7" key={entry.id}>
                <span className="table-strong">{entry.id}</span>
                <div>
                  <div className="table-strong">{entry.serviceName}</div>
                  <span className="muted">
                    {[entry.detail, cadenceLabel].filter(Boolean).join(" • ") || "—"}
                  </span>
                </div>
                <span>{entry.type}</span>
                <div>
                  <div className="table-strong">{formatDate(resolveEntryDate(entry))}</div>
                  <span className="muted">{dateLabel}</span>
                </div>
                <span className="table-strong">{formatAmountValue(entry.amount)}</span>
                <span>{entry.currency}</span>
                <span className={`status-pill is-${STATUS_TONE[entry.status] || "info"}`}>
                  {entry.status}
                </span>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
};

export default Accounting;
