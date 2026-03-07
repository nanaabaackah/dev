import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { getApiErrorMessage, readJsonResponse } from "../../utils/http";
import "./Rent.css";

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const isRentManagerRole = (roleName) => roleName === "Admin" || roleName === "Landlord";

const formatAmount = (amount, currency) =>
  `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const toInputDate = (value, fallback = "") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
};

const buildDefaultTenantForm = ({ landlordName = "", landlordEmail = "" } = {}) => ({
  tenantName: "",
  tenantEmail: "",
  landlordName,
  landlordEmail,
  currency: "GHS",
  monthlyRent: "",
  leaseStartDate: buildTodayDate(),
  leaseEndDate: "",
  openingBalance: "0",
  status: "ACTIVE",
  notes: "",
});

const buildTenantFormFromRecord = (tenant, landlordDefaults = {}) => ({
  tenantName: String(tenant?.tenantName || ""),
  tenantEmail: String(tenant?.tenantEmail || ""),
  landlordName: String(tenant?.landlordName || landlordDefaults.landlordName || ""),
  landlordEmail: String(tenant?.landlordEmail || landlordDefaults.landlordEmail || ""),
  currency: String(tenant?.currency || "GHS"),
  monthlyRent:
    tenant?.monthlyRent === undefined || tenant?.monthlyRent === null
      ? ""
      : String(tenant.monthlyRent),
  leaseStartDate: toInputDate(tenant?.leaseStartDate, buildTodayDate()),
  leaseEndDate: toInputDate(tenant?.leaseEndDate),
  openingBalance:
    tenant?.openingBalance === undefined || tenant?.openingBalance === null
      ? "0"
      : String(tenant.openingBalance),
  status: String(tenant?.status || "ACTIVE"),
  notes: String(tenant?.notes || ""),
});

const DEFAULT_PAYMENT_FORM = {
  tenantId: "",
  amount: "",
  paidAt: buildTodayDate(),
  method: "",
  reference: "",
  notes: "",
};

const Rent = () => {
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredUser(), []);
  const roleName = String(storedUser?.role?.name || "");
  const isLandlord = roleName === "Landlord";
  const canManageRent = isRentManagerRole(roleName);
  const landlordDefaults = useMemo(
    () => ({
      landlordName: isLandlord ? String(storedUser?.fullName || "").trim() : "",
      landlordEmail: isLandlord
        ? String(storedUser?.email || "")
            .trim()
            .toLowerCase()
        : "",
    }),
    [isLandlord, storedUser]
  );
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tenantForm, setTenantForm] = useState(() => buildDefaultTenantForm(landlordDefaults));
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(DEFAULT_PAYMENT_FORM);
  const [tenantError, setTenantError] = useState("");
  const [tenantNotice, setTenantNotice] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [isTenantSaving, setIsTenantSaving] = useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);

  const tenants = useMemo(
    () => (Array.isArray(dashboard?.tenants) ? dashboard.tenants : []),
    [dashboard?.tenants]
  );

  const resetTenantForm = useCallback(() => {
    setEditingTenantId(null);
    setTenantForm(buildDefaultTenantForm(landlordDefaults));
  }, [landlordDefaults]);

  const startTenantEdit = useCallback(
    (tenant) => {
      setTenantError("");
      setTenantNotice("");
      setEditingTenantId(Number(tenant?.id || 0));
      setTenantForm(buildTenantFormFromRecord(tenant, landlordDefaults));
    },
    [landlordDefaults]
  );

  useEffect(() => {
    if (!tenants.length) {
      setPaymentForm((prev) => ({ ...prev, tenantId: "" }));
      return;
    }

    const isStillValid = tenants.some((tenant) => String(tenant.id) === paymentForm.tenantId);
    if (!isStillValid) {
      setPaymentForm((prev) => ({ ...prev, tenantId: String(tenants[0].id) }));
    }
  }, [tenants, paymentForm.tenantId]);

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        localStorage.removeItem("user");
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
        const response = await fetch(buildApiUrl("/api/rent/dashboard"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          throw new Error(getApiErrorMessage(payload, "Unable to load rent dashboard"));
        }

        setDashboard(payload || null);
      } catch (requestError) {
        setError(requestError.message || "Unable to load rent dashboard");
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

  const submitTenant = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    setTenantError("");
    setTenantNotice("");
    setIsTenantSaving(true);

    const requestPath = editingTenantId ? `/api/rent/tenants/${editingTenantId}` : "/api/rent/tenants";
    const requestMethod = editingTenantId ? "PATCH" : "POST";

    try {
      const response = await fetch(buildApiUrl(requestPath), {
        method: requestMethod,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...tenantForm,
          landlordEmail: isLandlord ? landlordDefaults.landlordEmail : tenantForm.landlordEmail || null,
          leaseEndDate: tenantForm.leaseEndDate || null,
          openingBalance: tenantForm.openingBalance || 0,
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, editingTenantId ? "Unable to update tenant" : "Unable to create tenant")
        );
      }

      setTenantNotice(editingTenantId ? "Tenant updated." : "Tenant added.");
      resetTenantForm();
      await loadDashboard({ silent: true });
    } catch (requestError) {
      setTenantError(
        requestError.message || (editingTenantId ? "Unable to update tenant" : "Unable to create tenant")
      );
    } finally {
      setIsTenantSaving(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    setPaymentError("");
    setPaymentNotice("");
    setIsPaymentSaving(true);

    try {
      const response = await fetch(buildApiUrl("/api/rent/payments"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...paymentForm,
          tenantId: Number(paymentForm.tenantId),
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to record payment"));
      }

      setPaymentNotice("Payment recorded.");
      setPaymentForm((prev) => ({
        ...DEFAULT_PAYMENT_FORM,
        tenantId: prev.tenantId,
      }));
      await loadDashboard({ silent: true });
    } catch (requestError) {
      setPaymentError(requestError.message || "Unable to record payment");
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const currencyTotals = Object.entries(dashboard?.totals?.currencyTotals || {});

  return (
    <section className="page rent-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Rent</p>
          <h1>Rent Dashboard</h1>
          <p className="muted">
            Track tenant payments, quarterly progress, and outstanding balances.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadDashboard({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading rent dashboard...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="panel-grid">
        <article className="panel metric-card">
          <span className="kpi-label">Quarter</span>
          <div className="kpi-value">{dashboard?.quarter?.label || "Current quarter"}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Tenants tracked</span>
          <div className="kpi-value">{dashboard?.totals?.tenantsTracked ?? 0}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Active tenants</span>
          <div className="kpi-value">{dashboard?.totals?.activeTenants ?? 0}</div>
        </article>
      </div>

      <div className="panel-grid rent-currency-grid">
        {currencyTotals.length ? (
          currencyTotals.map(([currency, totals]) => (
            <article className="panel rent-currency-card" key={currency}>
              <h3>{currency} Summary</h3>
              <dl>
                <div>
                  <dt>Paid this quarter</dt>
                  <dd>{formatAmount(totals.paidThisQuarter, currency)}</dd>
                </div>
                <div>
                  <dt>Expected this quarter</dt>
                  <dd>{formatAmount(totals.expectedThisQuarter, currency)}</dd>
                </div>
                <div>
                  <dt>Outstanding this quarter</dt>
                  <dd>{formatAmount(totals.outstandingThisQuarter, currency)}</dd>
                </div>
                <div>
                  <dt>Total outstanding</dt>
                  <dd>{formatAmount(totals.outstandingTotal, currency)}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <article className="panel">
            <p className="muted">No rent tenants have been added yet.</p>
          </article>
        )}
      </div>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Tenant payment breakdown</h3>
            <p className="muted">
              Showing paid and owed balances for {dashboard?.quarter?.label || "the selected quarter"}.
            </p>
          </div>
        </div>

        {tenants.length ? (
          <div className="rent-table-wrap">
            <table className="rent-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Monthly rent</th>
                  <th>Paid this quarter</th>
                  <th>Outstanding this quarter</th>
                  <th>Total outstanding</th>
                  <th>Last payment</th>
                  <th>Last quarterly update</th>
                  {canManageRent ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <div className="rent-tenant-cell">
                        <strong>{tenant.tenantName}</strong>
                        <span className="muted">{tenant.tenantEmail}</span>
                      </div>
                    </td>
                    <td>{formatAmount(tenant.monthlyRent, tenant.currency)}</td>
                    <td>{formatAmount(tenant.paidThisQuarter, tenant.currency)}</td>
                    <td>{formatAmount(tenant.outstandingThisQuarter, tenant.currency)}</td>
                    <td>{formatAmount(tenant.outstandingTotal, tenant.currency)}</td>
                    <td>{formatDate(tenant.lastPaymentAt)}</td>
                    <td>{formatDate(tenant.lastQuarterlySummaryAt)}</td>
                    {canManageRent ? (
                      <td>
                        <button
                          className="button button-plain"
                          type="button"
                          onClick={() => startTenantEdit(tenant)}
                        >
                          <FiEdit2 aria-hidden="true" />
                          Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No tenant records found for this account.</p>
        )}
      </article>

      {canManageRent ? (
        <div className="panel-grid rent-admin-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>{editingTenantId ? "Edit tenant" : "Add tenant"}</h3>
                <p className="muted">
                  {editingTenantId
                    ? "Update the selected tenant profile."
                    : "Create a tenant profile for rent tracking."}
                </p>
              </div>
            </div>

            {tenantError ? (
              <div className="notice is-error" role="alert">
                {tenantError}
              </div>
            ) : null}
            {tenantNotice ? <div className="notice is-success">{tenantNotice}</div> : null}
            {isLandlord ? (
              <p className="muted rent-form-note">
                Landlord records you create stay linked to {landlordDefaults.landlordEmail}.
              </p>
            ) : null}

            <form className="stack" onSubmit={submitTenant}>
              <label className="form-field">
                <span>Tenant name</span>
                <input
                  className="input"
                  value={tenantForm.tenantName}
                  onChange={(event) =>
                    setTenantForm((prev) => ({ ...prev, tenantName: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Tenant email</span>
                <input
                  className="input"
                  type="email"
                  value={tenantForm.tenantEmail}
                  onChange={(event) =>
                    setTenantForm((prev) => ({ ...prev, tenantEmail: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Landlord name</span>
                <input
                  className="input"
                  value={tenantForm.landlordName}
                  onChange={(event) =>
                    setTenantForm((prev) => ({ ...prev, landlordName: event.target.value }))
                  }
                />
              </label>

              <label className="form-field">
                <span>Landlord email</span>
                <input
                  className="input"
                  type="email"
                  value={isLandlord ? landlordDefaults.landlordEmail : tenantForm.landlordEmail}
                  onChange={(event) =>
                    setTenantForm((prev) => ({ ...prev, landlordEmail: event.target.value }))
                  }
                  disabled={isLandlord}
                />
              </label>

              <div className="rent-form-row">
                <label className="form-field">
                  <span>Currency</span>
                  <select
                    className="input"
                    value={tenantForm.currency}
                    onChange={(event) =>
                      setTenantForm((prev) => ({ ...prev, currency: event.target.value }))
                    }
                    required
                  >
                    <option value="GHS">GHS</option>
                    <option value="CAD">CAD</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Monthly rent</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tenantForm.monthlyRent}
                    onChange={(event) =>
                      setTenantForm((prev) => ({ ...prev, monthlyRent: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>

              <div className="rent-form-row">
                <label className="form-field">
                  <span>Lease start</span>
                  <input
                    className="input"
                    type="date"
                    value={tenantForm.leaseStartDate}
                    onChange={(event) =>
                      setTenantForm((prev) => ({ ...prev, leaseStartDate: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Lease end</span>
                  <input
                    className="input"
                    type="date"
                    value={tenantForm.leaseEndDate}
                    onChange={(event) =>
                      setTenantForm((prev) => ({ ...prev, leaseEndDate: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="rent-form-row">
                <label className="form-field">
                  <span>Opening balance</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tenantForm.openingBalance}
                    onChange={(event) =>
                      setTenantForm((prev) => ({ ...prev, openingBalance: event.target.value }))
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Status</span>
                  <select
                    className="input"
                    value={tenantForm.status}
                    onChange={(event) =>
                      setTenantForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={tenantForm.notes}
                  onChange={(event) =>
                    setTenantForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>

              <div className="rent-form-actions">
                <button className="button button-primary" type="submit" disabled={isTenantSaving}>
                  {isTenantSaving
                    ? "Saving..."
                    : editingTenantId
                      ? "Save changes"
                      : "Add tenant"}
                </button>
                {editingTenantId ? (
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={resetTenantForm}
                    disabled={isTenantSaving}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Record payment</h3>
                <p className="muted">Log a payment made by a tenant.</p>
              </div>
            </div>

            {paymentError ? (
              <div className="notice is-error" role="alert">
                {paymentError}
              </div>
            ) : null}
            {paymentNotice ? <div className="notice is-success">{paymentNotice}</div> : null}

            <form className="stack" onSubmit={submitPayment}>
              <label className="form-field">
                <span>Tenant</span>
                <select
                  className="input"
                  value={paymentForm.tenantId}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, tenantId: event.target.value }))
                  }
                  required
                >
                  <option value="" disabled>
                    Select tenant
                  </option>
                  {tenants.map((tenant) => (
                    <option value={tenant.id} key={tenant.id}>
                      {tenant.tenantName} ({tenant.currency})
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Amount</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Paid date</span>
                <input
                  className="input"
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, paidAt: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Payment method</span>
                <input
                  className="input"
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, method: event.target.value }))
                  }
                  placeholder="Bank transfer, mobile money, etc."
                />
              </label>

              <label className="form-field">
                <span>Reference</span>
                <input
                  className="input"
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))
                  }
                />
              </label>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  className="input"
                  rows={3}
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>

              <button className="button button-primary" type="submit" disabled={isPaymentSaving}>
                {isPaymentSaving ? "Saving..." : "Record payment"}
              </button>
            </form>
          </article>
        </div>
      ) : null}
    </section>
  );
};

export default Rent;
