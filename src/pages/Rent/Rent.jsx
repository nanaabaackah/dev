import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowUpRight, FiTrash2 } from "react-icons/fi";
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
const buildCurrentMonthInput = () => new Date().toISOString().slice(0, 7);

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

const formatMonthValue = (value) => {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) return "-";
  const date = new Date(`${normalized}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

const formatStatusLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

const formatLeaseRange = (startValue, endValue) => {
  const startLabel = formatDate(startValue);
  const endLabel = endValue ? formatDate(endValue) : "Open-ended";
  return startLabel === "-" ? endLabel : `${startLabel} - ${endLabel}`;
};

const getPaymentSortTimestamp = (payment) => {
  const candidate = payment?.paidAt || payment?.createdAt || null;
  if (!candidate) return 0;
  const timestamp = new Date(candidate).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const toPaymentDateValue = (value) => {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(normalized) ? `${normalized}-01` : normalized;
};

const toMonthInputValue = (value, fallback = buildCurrentMonthInput()) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 7);
};

const toInputDate = (value, fallback = "") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
};

const buildDefaultTenantForm = () => ({
  tenantName: "",
  tenantEmail: "",
  landlordName: "",
  landlordEmail: "",
  currency: "GHS",
  monthlyRent: "",
  leaseStartDate: buildTodayDate(),
  leaseEndDate: "",
  openingBalance: "0",
  status: "ACTIVE",
  notes: "",
});

const buildTenantFormFromRecord = (tenant) => ({
  tenantName: String(tenant?.tenantName || ""),
  tenantEmail: String(tenant?.tenantEmail || ""),
  landlordName: String(tenant?.landlordName || ""),
  landlordEmail: String(tenant?.landlordEmail || ""),
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
  paidAt: buildCurrentMonthInput(),
  method: "",
  reference: "",
  notes: "",
};

const buildPaymentFormFromRecord = (payment) => ({
  tenantId: String(payment?.tenantId || ""),
  amount:
    payment?.amount === undefined || payment?.amount === null
      ? ""
      : String(payment.amount),
  paidAt: toMonthInputValue(payment?.paidAt),
  method: String(payment?.method || ""),
  reference: String(payment?.reference || ""),
  notes: String(payment?.notes || ""),
});

const Rent = () => {
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredUser(), []);
  const roleName = String(storedUser?.role?.name || "");
  const isLandlord = roleName === "Landlord";
  const canManageRent = isRentManagerRole(roleName);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tenantForm, setTenantForm] = useState(() => buildDefaultTenantForm());
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(DEFAULT_PAYMENT_FORM);
  const [payments, setPayments] = useState([]);
  const [tenantError, setTenantError] = useState("");
  const [tenantNotice, setTenantNotice] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentsError, setPaymentsError] = useState("");
  const [isTenantSaving, setIsTenantSaving] = useState(false);
  const [deletingTenantId, setDeletingTenantId] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
  const [isMissedMonthsOpen, setIsMissedMonthsOpen] = useState(false);
  const tenantEditorRef = useRef(null);
  const paymentEditorRef = useRef(null);

  const tenants = useMemo(
    () => (Array.isArray(dashboard?.tenants) ? dashboard.tenants : []),
    [dashboard?.tenants]
  );
  const missedMonths = useMemo(
    () => (Array.isArray(dashboard?.missedMonths) ? dashboard.missedMonths : []),
    [dashboard?.missedMonths]
  );
  const missedMonthsByTenant = useMemo(() => {
    const groups = new Map();
    missedMonths.forEach((entry) => {
      const key = String(entry?.tenantId || "");
      if (!key) return;
      const existing = groups.get(key) || {
        tenantId: entry.tenantId,
        tenantName: entry.tenantName,
        tenantEmail: entry.tenantEmail,
        currency: entry.currency,
        months: [],
      };
      existing.months.push(entry);
      groups.set(key, existing);
    });
    return Array.from(groups.values());
  }, [missedMonths]);
  const selectedPaymentTenant = useMemo(
    () => tenants.find((tenant) => String(tenant.id) === paymentForm.tenantId) || null,
    [tenants, paymentForm.tenantId]
  );
  const paymentsWithTenants = useMemo(
    () =>
      [...payments]
        .sort((left, right) => {
          const timeDifference = getPaymentSortTimestamp(right) - getPaymentSortTimestamp(left);
          if (timeDifference !== 0) return timeDifference;
          return Number(right.id || 0) - Number(left.id || 0);
        })
        .map((payment) => ({
          ...payment,
          tenant:
            tenants.find((tenant) => Number(tenant.id) === Number(payment.tenantId)) || null,
        })),
    [payments, tenants]
  );
  const resolveDefaultPaymentMonth = useCallback((tenant) => {
    const oldestMissedMonth = Array.isArray(tenant?.missedMonths) ? tenant.missedMonths[0] : null;
    const periodStart = String(oldestMissedMonth?.periodStart || "").trim();
    return /^\d{4}-\d{2}/.test(periodStart) ? periodStart.slice(0, 7) : buildCurrentMonthInput();
  }, []);
  const resetPaymentForm = useCallback(
    (tenantIdValue = paymentForm.tenantId) => {
      const tenant = tenants.find((entry) => String(entry.id) === String(tenantIdValue)) || null;
      setEditingPaymentId(null);
      setIsPaymentDetailsOpen(false);
      setPaymentForm({
        ...DEFAULT_PAYMENT_FORM,
        tenantId: tenant ? String(tenant.id) : String(tenantIdValue || ""),
        paidAt: resolveDefaultPaymentMonth(tenant),
      });
    },
    [paymentForm.tenantId, resolveDefaultPaymentMonth, tenants]
  );

  const resetTenantForm = useCallback(() => {
    setEditingTenantId(null);
    setTenantForm(buildDefaultTenantForm());
  }, []);

  const startTenantEdit = useCallback(
    (tenant) => {
      setTenantError("");
      setTenantNotice("");
      setEditingTenantId(Number(tenant?.id || 0));
      setTenantForm(buildTenantFormFromRecord(tenant));
      setPaymentForm((prev) => ({
        ...prev,
        tenantId: String(tenant?.id || ""),
        paidAt: resolveDefaultPaymentMonth(tenant),
      }));
      window.requestAnimationFrame(() => {
        tenantEditorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [resolveDefaultPaymentMonth]
  );

  const handleTenantRowKeyDown = (event, tenant) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    startTenantEdit(tenant);
  };

  useEffect(() => {
    if (!tenants.length) {
      setPaymentForm((prev) => ({ ...prev, tenantId: "", paidAt: buildCurrentMonthInput() }));
      return;
    }

    const selectedTenant = tenants.find((tenant) => String(tenant.id) === paymentForm.tenantId) || null;
    if (!selectedTenant) {
      const defaultTenant = tenants[0];
      setPaymentForm((prev) => ({
        ...prev,
        tenantId: String(defaultTenant.id),
        paidAt: resolveDefaultPaymentMonth(defaultTenant),
      }));
    } else if (!String(paymentForm.paidAt || "").trim()) {
      setPaymentForm((prev) => ({
        ...prev,
        paidAt: resolveDefaultPaymentMonth(selectedTenant),
      }));
    }
  }, [
    tenants,
    paymentForm.paidAt,
    paymentForm.tenantId,
    resolveDefaultPaymentMonth,
  ]);

  const loadPayments = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (!silent) {
        setIsPaymentsLoading(true);
      }
      setPaymentsError("");

      try {
        const response = await fetch(buildApiUrl("/api/rent/payments"), {
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
          throw new Error(getApiErrorMessage(payload, "Unable to load rent payments"));
        }

        setPayments(Array.isArray(payload?.payments) ? payload.payments : []);
      } catch (requestError) {
        setPaymentsError(requestError.message || "Unable to load rent payments");
      } finally {
        setIsPaymentsLoading(false);
      }
    },
    [navigate]
  );

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

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

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

    const requestBody = {
      tenantName: tenantForm.tenantName,
      tenantEmail: tenantForm.tenantEmail,
      currency: tenantForm.currency,
      monthlyRent: tenantForm.monthlyRent,
      leaseStartDate: tenantForm.leaseStartDate,
      leaseEndDate: tenantForm.leaseEndDate || null,
      openingBalance: tenantForm.openingBalance || 0,
      status: tenantForm.status,
      notes: tenantForm.notes,
    };

    try {
      const response = await fetch(buildApiUrl(requestPath), {
        method: requestMethod,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, editingTenantId ? "Unable to update tenant" : "Unable to create tenant")
        );
      }

      const invitationRecipient =
        payload && typeof payload === "object" && typeof payload.invitationRecipient === "string"
          ? payload.invitationRecipient
          : "";
      const invitationIntendedRecipient =
        payload && typeof payload === "object" && typeof payload.invitationIntendedRecipient === "string"
          ? payload.invitationIntendedRecipient
          : "";
      const invitationSent =
        payload && typeof payload === "object" && payload.invitationSent === true;
      const invitationRerouted =
        payload && typeof payload === "object" && payload.invitationRerouted === true;
      const tenantAccessAlreadyExists =
        payload && typeof payload === "object" && payload.tenantAccessAlreadyExists === true;

      const createNotice = invitationSent
        ? invitationRerouted && invitationRecipient && invitationIntendedRecipient
          ? `Tenant added. Setup link sent to ${invitationRecipient} for ${invitationIntendedRecipient}.`
          : invitationRecipient
            ? `Tenant added. Setup link sent to ${invitationRecipient}.`
            : "Tenant added. Setup link sent."
        : tenantAccessAlreadyExists
          ? "Tenant added. Tenant access already exists."
          : "Tenant added.";

      setTenantNotice(editingTenantId ? "Tenant updated." : createNotice);
      resetTenantForm();
      await Promise.all([loadDashboard({ silent: true }), loadPayments({ silent: true })]);
    } catch (requestError) {
      setTenantError(
        requestError.message || (editingTenantId ? "Unable to update tenant" : "Unable to create tenant")
      );
    } finally {
      setIsTenantSaving(false);
    }
  };

  const deleteTenant = async (tenantRecord = null) => {
    const tenantId = Number(tenantRecord?.id || editingTenantId || 0);
    if (!tenantId) return;

    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    const tenantLabel = tenantRecord?.tenantName || "this tenant";
    const shouldDelete = window.confirm(
      `Remove ${tenantLabel}? This will also delete that tenant's recorded payments.`
    );
    if (!shouldDelete) return;

    setTenantError("");
    setTenantNotice("");
    setDeletingTenantId(tenantId);

    try {
      const response = await fetch(buildApiUrl(`/api/rent/tenants/${tenantId}`), {
        method: "DELETE",
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
        throw new Error(getApiErrorMessage(payload, "Unable to remove tenant"));
      }

      if (editingTenantId === tenantId) {
        resetTenantForm();
      }
      setTenantNotice("Tenant removed.");
      await Promise.all([loadDashboard({ silent: true }), loadPayments({ silent: true })]);
    } catch (requestError) {
      setTenantError(requestError.message || "Unable to remove tenant");
    } finally {
      setDeletingTenantId(null);
    }
  };

  const startPaymentEdit = useCallback((payment) => {
    setPaymentError("");
    setPaymentNotice("");
    setEditingPaymentId(Number(payment?.id || 0));
    setPaymentForm(buildPaymentFormFromRecord(payment));
    setIsPaymentDetailsOpen(
      Boolean(
        String(payment?.method || "").trim() ||
          String(payment?.reference || "").trim() ||
          String(payment?.notes || "").trim()
      )
    );
    window.requestAnimationFrame(() => {
      paymentEditorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

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

    const requestPath = editingPaymentId ? `/api/rent/payments/${editingPaymentId}` : "/api/rent/payments";
    const requestMethod = editingPaymentId ? "PATCH" : "POST";
    const submittedTenantId = String(paymentForm.tenantId || "");
    const submittedMonth = String(paymentForm.paidAt || "").trim() || buildCurrentMonthInput();

    try {
      const response = await fetch(buildApiUrl(requestPath), {
        method: requestMethod,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...paymentForm,
          paidAt: toPaymentDateValue(paymentForm.paidAt),
          tenantId: Number(paymentForm.tenantId),
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, editingPaymentId ? "Unable to update payment" : "Unable to record payment")
        );
      }

      setPaymentNotice(editingPaymentId ? "Payment updated." : "Payment recorded.");
      setEditingPaymentId(null);
      setIsPaymentDetailsOpen(false);
      setPaymentForm({
        ...DEFAULT_PAYMENT_FORM,
        tenantId: submittedTenantId,
        paidAt: submittedMonth,
      });
      await Promise.all([loadDashboard({ silent: true }), loadPayments({ silent: true })]);
    } catch (requestError) {
      setPaymentError(
        requestError.message || (editingPaymentId ? "Unable to update payment" : "Unable to record payment")
      );
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const deletePayment = async (payment) => {
    const paymentId = Number(payment?.id || editingPaymentId || 0);
    if (!paymentId) return;

    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    const tenantLabel = payment?.tenant?.tenantName || payment?.tenantName || "this payment";
    const shouldDelete = window.confirm(`Delete the payment recorded for ${tenantLabel}?`);
    if (!shouldDelete) return;

    setPaymentError("");
    setPaymentNotice("");
    setDeletingPaymentId(paymentId);

    try {
      const response = await fetch(buildApiUrl(`/api/rent/payments/${paymentId}`), {
        method: "DELETE",
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
        throw new Error(getApiErrorMessage(payload, "Unable to remove payment"));
      }

      if (editingPaymentId === paymentId) {
        resetPaymentForm(payment?.tenantId || paymentForm.tenantId);
      }
      setPaymentNotice("Payment removed.");
      await Promise.all([loadDashboard({ silent: true }), loadPayments({ silent: true })]);
    } catch (requestError) {
      setPaymentError(requestError.message || "Unable to remove payment");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const setPaymentAmount = (amount) => {
    setPaymentForm((prev) => ({
      ...prev,
      amount: amount === undefined || amount === null ? "" : String(amount),
    }));
  };

  const startPaymentForMissedMonth = useCallback((tenantGroup, missedMonth) => {
    if (!canManageRent) return;
    const targetMonth = String(missedMonth?.periodStart || "").slice(0, 7) || buildCurrentMonthInput();
    setPaymentError("");
    setPaymentNotice("");
    setEditingPaymentId(null);
    setIsPaymentDetailsOpen(false);
    setPaymentForm({
      ...DEFAULT_PAYMENT_FORM,
      tenantId: String(tenantGroup?.tenantId || ""),
      amount:
        missedMonth?.amountOutstanding === undefined || missedMonth?.amountOutstanding === null
          ? ""
          : String(missedMonth.amountOutstanding),
      paidAt: targetMonth,
    });
    window.requestAnimationFrame(() => {
      paymentEditorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [canManageRent]);

  const currencyTotals = Object.entries(dashboard?.totals?.currencyTotals || {});
  const singleTenant = tenants.length === 1 ? tenants[0] : null;
  const isSingleTenantView = Boolean(singleTenant);

  return (
    <section className="page rent-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Rent</p>
          <h1>Rent Dashboard</h1>
          <p className="muted">
            Track tenant payments, monthly progress, and outstanding balances.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              loadDashboard({ silent: true });
              loadPayments({ silent: true });
            }}
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
          <span className="kpi-label">Month</span>
          <div className="kpi-value">{dashboard?.month?.label || "Current month"}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Tenants tracked</span>
          <div className="kpi-value">{dashboard?.totals?.tenantsTracked ?? 0}</div>
        </article>
        <article className="panel metric-card">
          <span className="kpi-label">Active tenants</span>
          <div className="kpi-value">{dashboard?.totals?.activeTenants ?? 0}</div>
        </article>
        <button
          className={`panel metric-card rent-metric-card-button ${isMissedMonthsOpen ? "is-active" : ""}`.trim()}
          type="button"
          onClick={() => setIsMissedMonthsOpen((prev) => !prev)}
          aria-expanded={isMissedMonthsOpen}
          aria-controls="rent-missed-months-panel"
        >
          <span className="kpi-label">Periods missed</span>
          <div className="kpi-value">{dashboard?.totals?.periodsMissed ?? 0}</div>
          <span className="rent-metric-card__hint">
            {isMissedMonthsOpen ? "Hide missed months" : "Show missed months"}
          </span>
        </button>
      </div>

      {isMissedMonthsOpen ? (
        <article className="panel rent-missed-months-panel" id="rent-missed-months-panel">
          <div className="panel-header">
            <div>
              <h3>Missed months</h3>
              <p className="muted">Open balances grouped by tenant and billing month.</p>
            </div>
          </div>

          {missedMonthsByTenant.length ? (
            <div className="rent-missed-months-list">
              {missedMonthsByTenant.map((tenantGroup) => (
                <section className="rent-missed-months-item" key={tenantGroup.tenantId}>
                  <div className="rent-missed-months-item__head">
                    <div>
                      <strong>{tenantGroup.tenantName}</strong>
                      <div className="muted">{tenantGroup.tenantEmail}</div>
                    </div>
                    <span className="muted">
                      {tenantGroup.months.length} missed {tenantGroup.months.length === 1 ? "month" : "months"}
                    </span>
                  </div>
                  <div className="rent-missed-months-actions">
                    {tenantGroup.months.map((entry) => (
                      <button
                        key={`${tenantGroup.tenantId}-${entry.periodStart}`}
                        className="rent-missed-month-button"
                        type="button"
                        onClick={() => startPaymentForMissedMonth(tenantGroup, entry)}
                        disabled={!canManageRent}
                      >
                        <span className="rent-missed-month-button__main">
                          <strong>{entry.monthLabel}</strong>
                          <span>{formatAmount(entry.amountOutstanding, tenantGroup.currency)} outstanding</span>
                        </span>
                        <span className="rent-missed-month-button__action">
                          {canManageRent ? (
                            <>
                              Pay this month
                              <FiArrowUpRight aria-hidden="true" />
                            </>
                          ) : (
                            "Outstanding"
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="muted">No missed months right now.</p>
          )}
        </article>
      ) : null}

      {isSingleTenantView ? (
        <article className="rent-single-tenant-panel">
          <div className="panel-header">
            <div>
              <h3>Tenant overview</h3>
              <p className="muted">
                Everything for {singleTenant.tenantName} in one place for{" "}
                {dashboard?.month?.label || "the selected month"}.
              </p>
            </div>
            <div className="rent-single-tenant-panel__actions">
              <span
                className={`rent-single-tenant-card__status ${
                  String(singleTenant.status || "").toUpperCase() === "ACTIVE"
                    ? "rent-single-tenant-card__status--active"
                    : "rent-single-tenant-card__status--inactive"
                }`.trim()}
              >
                {formatStatusLabel(singleTenant.status)}
              </span>
              {canManageRent ? (
                <button
                  className="icon-button rent-tenant-remove-button"
                  type="button"
                  onClick={() => deleteTenant(singleTenant)}
                  disabled={isTenantSaving || Boolean(deletingTenantId)}
                  aria-label={
                    deletingTenantId === singleTenant.id
                      ? `Removing ${singleTenant.tenantName}`
                      : `Remove ${singleTenant.tenantName}`
                  }
                  title={deletingTenantId === singleTenant.id ? "Removing..." : "Remove tenant"}
                >
                  {deletingTenantId === singleTenant.id ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <FiTrash2 aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
          </div>

          <button
            className={`rent-single-tenant-card ${
              canManageRent ? "rent-single-tenant-card--clickable" : ""
            } ${editingTenantId === singleTenant.id ? "is-editing" : ""}`.trim()}
            type="button"
            onClick={canManageRent ? () => startTenantEdit(singleTenant) : undefined}
            disabled={!canManageRent}
          >
            <div className="rent-single-tenant-card__head">
              <div className="rent-single-tenant-card__identity">
                <strong>{singleTenant.tenantName}</strong>
                <span className="muted">{singleTenant.tenantEmail}</span>
              </div>
              <span className="rent-single-tenant-card__currency">{singleTenant.currency}</span>
            </div>

            <div className="rent-single-tenant-summary-grid">
              <div className="rent-single-tenant-summary-item">
                <span>Paid this month</span>
                <strong>{formatAmount(singleTenant.paidThisMonth, singleTenant.currency)}</strong>
              </div>
              <div className="rent-single-tenant-summary-item">
                <span>Expected this month</span>
                <strong>{formatAmount(singleTenant.expectedThisMonth, singleTenant.currency)}</strong>
              </div>
              <div className="rent-single-tenant-summary-item">
                <span>Outstanding this month</span>
                <strong>{formatAmount(singleTenant.outstandingThisMonth, singleTenant.currency)}</strong>
              </div>
              <div className="rent-single-tenant-summary-item">
                <span>Total outstanding</span>
                <strong>{formatAmount(singleTenant.outstandingTotal, singleTenant.currency)}</strong>
              </div>
            </div>

            <div className="rent-single-tenant-details">
              <div className="rent-single-tenant-details__item">
                <span>Monthly rent</span>
                <strong>{formatAmount(singleTenant.monthlyRent, singleTenant.currency)}</strong>
              </div>
              <div className="rent-single-tenant-details__item">
                <span>Lease window</span>
                <strong>{formatLeaseRange(singleTenant.leaseStartDate, singleTenant.leaseEndDate)}</strong>
              </div>
              <div className="rent-single-tenant-details__item">
                <span>Last payment</span>
                <strong>{formatDate(singleTenant.lastPaymentAt)}</strong>
              </div>
              <div className="rent-single-tenant-details__item">
                <span>Last monthly update</span>
                <strong>{formatDate(singleTenant.lastMonthlySummaryAt)}</strong>
              </div>
            </div>

            {singleTenant.notes ? (
              <p className="rent-single-tenant-card__notes">{singleTenant.notes}</p>
            ) : null} 
          </button>
        </article>
      ) : (
        <>
          <div className="panel-grid rent-currency-grid">
            {currencyTotals.length ? (
              currencyTotals.map(([currency, totals]) => (
                <article className="panel rent-currency-card" key={currency}>
                  <h3>{currency} Summary</h3>
                  <dl>
                    <div>
                      <dt>Paid this month</dt>
                      <dd>{formatAmount(totals.paidThisMonth, currency)}</dd>
                    </div>
                    <div>
                      <dt>Expected this month</dt>
                      <dd>{formatAmount(totals.expectedThisMonth, currency)}</dd>
                    </div>
                    <div>
                      <dt>Outstanding this month</dt>
                      <dd>{formatAmount(totals.outstandingThisMonth, currency)}</dd>
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
                  Showing paid and owed balances for {dashboard?.month?.label || "the selected month"}.
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
                      <th>Paid this month</th>
                      <th>Outstanding this month</th>
                      <th>Total outstanding</th>
                      <th>Last payment</th>
                      <th>Last monthly update</th>
                      {canManageRent ? <th className="rent-table__actions-column">Remove</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className={`rent-table__row ${
                          canManageRent ? "rent-table__row--clickable" : ""
                        } ${editingTenantId === tenant.id ? "is-editing" : ""}`.trim()}
                        tabIndex={canManageRent ? 0 : undefined}
                        onClick={canManageRent ? () => startTenantEdit(tenant) : undefined}
                        onKeyDown={canManageRent ? (event) => handleTenantRowKeyDown(event, tenant) : undefined}
                        aria-label={canManageRent ? `Edit ${tenant.tenantName}` : undefined}
                      >
                        <td>
                          <div className="rent-tenant-cell">
                            <strong>{tenant.tenantName}</strong>
                            <span className="muted">{tenant.tenantEmail}</span>
                          </div>
                        </td>
                        <td>{formatAmount(tenant.monthlyRent, tenant.currency)}</td>
                        <td>{formatAmount(tenant.paidThisMonth, tenant.currency)}</td>
                        <td>{formatAmount(tenant.outstandingThisMonth, tenant.currency)}</td>
                        <td>{formatAmount(tenant.outstandingTotal, tenant.currency)}</td>
                        <td>{formatDate(tenant.lastPaymentAt)}</td>
                        <td>{formatDate(tenant.lastMonthlySummaryAt)}</td>
                        {canManageRent ? (
                          <td className="rent-table__action-cell">
                            <button
                              className="icon-button rent-tenant-remove-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteTenant(tenant);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                              disabled={isTenantSaving || Boolean(deletingTenantId)}
                              aria-label={
                                deletingTenantId === tenant.id
                                  ? `Removing ${tenant.tenantName}`
                                  : `Remove ${tenant.tenantName}`
                              }
                              title={deletingTenantId === tenant.id ? "Removing..." : "Remove tenant"}
                            >
                              {deletingTenantId === tenant.id ? (
                                <span className="spinner" aria-hidden="true" />
                              ) : (
                                <FiTrash2 aria-hidden="true" />
                              )}
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
        </>
      )}

      {canManageRent ? (
        <>
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Recent payments</h3>
                <p className="muted">Edit or remove recorded payments from here.</p>
              </div>
            </div>

            {paymentsError ? (
              <div className="notice is-error" role="alert">
                {paymentsError}
              </div>
            ) : null}

            {isPaymentsLoading ? (
              <div className="loading-card rent-payments-loading" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>Loading payments...</span>
              </div>
            ) : paymentsWithTenants.length ? (
              <div className="rent-payments-history">
                {paymentsWithTenants.map((payment) => (
                  <div
                    className={`rent-payment-history-item ${
                      editingPaymentId === payment.id ? "is-editing" : ""
                    }`.trim()}
                    key={payment.id}
                  >
                    <button
                      className="rent-payment-history-item__main"
                      type="button"
                      onClick={() => startPaymentEdit(payment)}
                    >
                      <div className="rent-payment-history-item__top">
                        <strong>{payment.tenant?.tenantName || `Tenant #${payment.tenantId}`}</strong>
                        <span>{formatAmount(payment.amount, payment.currency)}</span>
                      </div>
                      <div className="rent-payment-history-item__meta">
                        <span>{formatMonthValue(toMonthInputValue(payment.paidAt))}</span>
                        {payment.reference ? <span>Ref {payment.reference}</span> : null}
                        {payment.method ? <span>{payment.method}</span> : null}
                      </div>
                    </button>
                    <button
                      className="icon-button rent-payment-history-item__delete"
                      type="button"
                      onClick={() => deletePayment(payment)}
                      disabled={isPaymentSaving || Boolean(deletingPaymentId)}
                      aria-label={
                        deletingPaymentId === payment.id
                          ? `Removing payment for ${payment.tenant?.tenantName || `tenant ${payment.tenantId}`}`
                          : `Remove payment for ${payment.tenant?.tenantName || `tenant ${payment.tenantId}`}`
                      }
                      title={deletingPaymentId === payment.id ? "Removing..." : "Remove payment"}
                    >
                      {deletingPaymentId === payment.id ? (
                        <span className="spinner" aria-hidden="true" />
                      ) : (
                        <FiTrash2 aria-hidden="true" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No payments recorded yet.</p>
            )}
          </article>

          <div className="panel-grid rent-admin-grid">
            <article className="panel" ref={tenantEditorRef}>
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
                Landlord accounts can manage all tenant records in this organization.
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
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isTenantSaving || Boolean(deletingTenantId)}
                >
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
                    disabled={isTenantSaving || Boolean(deletingTenantId)}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </article>

          <article className="panel" ref={paymentEditorRef}>
            <div className="panel-header">
              <div>
                <h3>{editingPaymentId ? "Edit payment" : "Record payment"}</h3>
                <p className="muted">
                  {editingPaymentId
                    ? "Update the selected payment record."
                    : "Pick a tenant, enter the amount and month, then save. Everything else is optional."}
                </p>
              </div>
            </div>

            {paymentError ? (
              <div className="notice is-error" role="alert">
                {paymentError}
              </div>
            ) : null}
            {paymentNotice ? <div className="notice is-success">{paymentNotice}</div> : null}

            <form className="stack rent-payment-form" onSubmit={submitPayment}>
              <div className="rent-payment-main-row">
                <label className="form-field">
                  <span>Tenant</span>
                  <select
                    className="input"
                    value={paymentForm.tenantId}
                    onChange={(event) => {
                      const nextTenant =
                        tenants.find((tenant) => String(tenant.id) === event.target.value) || null;
                      setPaymentForm((prev) => ({
                        ...prev,
                        tenantId: event.target.value,
                        paidAt: resolveDefaultPaymentMonth(nextTenant),
                      }));
                    }}
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
                  <span>Payment month</span>
                  <input
                    className="input"
                    type="month"
                    value={paymentForm.paidAt}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, paidAt: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>

              {selectedPaymentTenant ? (
                <div className="rent-payment-summary">
                  <div className="rent-payment-summary__head">
                    <strong>{selectedPaymentTenant.tenantName}</strong>
                    <span className="muted">Posting for {formatMonthValue(paymentForm.paidAt) || "this month"}</span>
                  </div>
                  <div className="rent-payment-summary__stats">
                    <span>
                      Due this month:{" "}
                      <strong>
                        {formatAmount(
                          selectedPaymentTenant.outstandingThisMonth,
                          selectedPaymentTenant.currency
                        )}
                      </strong>
                    </span>
                    <span>
                      Monthly rent:{" "}
                      <strong>
                        {formatAmount(selectedPaymentTenant.monthlyRent, selectedPaymentTenant.currency)}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : null}

              {selectedPaymentTenant ? (
                <div className="rent-payment-quick-actions">
                  <button
                    className="button button-ghost rent-payment-fill-button"
                    type="button"
                    onClick={() => setPaymentAmount(selectedPaymentTenant.outstandingThisMonth)}
                  >
                    Use amount due
                  </button>
                  <button
                    className="button button-ghost rent-payment-fill-button"
                    type="button"
                    onClick={() => setPaymentAmount(selectedPaymentTenant.monthlyRent)}
                  >
                    Use monthly rent
                  </button>
                </div>
              ) : null}

              <div className="rent-payment-actions">
                <button className="button button-primary" type="submit" disabled={isPaymentSaving}>
                  {isPaymentSaving ? "Saving..." : editingPaymentId ? "Save payment changes" : "Record payment"}
                </button>
                {editingPaymentId ? (
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => resetPaymentForm()}
                    disabled={isPaymentSaving || Boolean(deletingPaymentId)}
                  >
                    Cancel edit
                  </button>
                ) : null}
                <button
                  className="button button-plain"
                  type="button"
                  onClick={() => setIsPaymentDetailsOpen((prev) => !prev)}
                >
                  {isPaymentDetailsOpen ? "Hide extra details" : "Add details"}
                </button>
              </div>

              {isPaymentDetailsOpen ? (
                <div className="rent-payment-details">
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
                </div>
              ) : null}

              <p className="muted rent-payment-helper">
                Tip: click a tenant row first to preselect that tenant here.
              </p>
            </form>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default Rent;
