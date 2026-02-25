import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentDownload } from "iconsax-react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../api-url";
import { getApiErrorMessage, readJsonResponse } from "../utils/http";
import { calculateInvoiceTotals, downloadInvoicePdf } from "../utils/invoicePdf";

const INVOICE_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "VOID", label: "Void" },
];

const FILTER_STATUS_OPTIONS = [{ value: "all", label: "All" }, ...INVOICE_STATUS_OPTIONS];

const STATUS_TONE = {
  DRAFT: "info",
  SENT: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "danger",
};

const CURRENCY_OPTIONS = ["CAD", "GHS"];

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatAmount = (amount, currency) =>
  `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const buildFutureDate = (offsetDays = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const createLineItemId = () =>
  `invoice-line-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const buildInvoiceForm = ({ organizationId = "", invoice = null } = {}) => ({
  organizationId,
  invoiceNumber: invoice?.invoiceNumber || "",
  status: invoice?.status || "DRAFT",
  currency: invoice?.currency || "CAD",
  issueDate: invoice?.issueDate ? toDateInput(invoice.issueDate) : buildTodayDate(),
  dueDate: invoice?.dueDate ? toDateInput(invoice.dueDate) : buildFutureDate(14),
  clientName: invoice?.clientName || "",
  clientEmail: invoice?.clientEmail || "",
  clientAddress: invoice?.clientAddress || "",
  notes: invoice?.notes || "",
  taxRate: invoice?.taxRate !== undefined ? String(invoice.taxRate) : "0",
  discount: invoice?.discount !== undefined ? String(invoice.discount) : "0",
  lineItems:
    Array.isArray(invoice?.lineItems) && invoice.lineItems.length
      ? invoice.lineItems.map((lineItem) => ({
          id: createLineItemId(),
          description: lineItem.description || "",
          quantity: String(lineItem.quantity ?? "1"),
          rate: String(lineItem.unitPrice ?? "0"),
        }))
      : [
          {
            id: createLineItemId(),
            description: "",
            quantity: "1",
            rate: "",
          },
        ],
});

const Invoicing = () => {
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const userOrgId = storedUser?.organizationId ? String(storedUser.organizationId) : "";

  const [organizations, setOrganizations] = useState([]);
  const [organizationError, setOrganizationError] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    isAdmin ? "all" : userOrgId || ""
  );
  const [statusFilter, setStatusFilter] = useState("all");

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [formState, setFormState] = useState(() =>
    buildInvoiceForm({ organizationId: userOrgId || "" })
  );
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

  const loadOrganizations = useCallback(async () => {
    if (!isAdmin) return;
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setOrganizationError("");
    try {
      const response = await fetch(buildApiUrl("/api/organizations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(payload, "Unable to load organizations"));
      }

      setOrganizations(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setOrganizationError(loadError.message || "Unable to load organizations");
    }
  }, [isAdmin, navigate]);

  const loadInvoices = useCallback(
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
        const query = new URLSearchParams();
        if (statusFilter !== "all") {
          query.set("status", statusFilter);
        }
        if (selectedOrganizationId) {
          if (isAdmin && selectedOrganizationId === "all") {
            query.set("organizationId", "all");
          } else if (selectedOrganizationId !== "all") {
            query.set("organizationId", selectedOrganizationId);
          }
        }

        const response = await fetch(buildApiUrl(`/api/invoices?${query.toString()}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonResponse(response);

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          throw new Error(getApiErrorMessage(payload, "Unable to load invoices"));
        }

        setInvoices(Array.isArray(payload?.invoices) ? payload.invoices : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load invoices");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAdmin, navigate, selectedOrganizationId, statusFilter]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!showForm) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showForm]);

  const invoiceTotals = useMemo(
    () =>
      calculateInvoiceTotals({
        lineItems: formState.lineItems,
        taxRate: formState.taxRate,
        discount: formState.discount,
      }),
    [formState.lineItems, formState.taxRate, formState.discount]
  );

  const summary = useMemo(() => {
    const base = {
      openCount: 0,
      overdueCount: 0,
      paidCount: 0,
      openTotal: { CAD: 0, GHS: 0 },
      paidTotal: { CAD: 0, GHS: 0 },
    };

    invoices.forEach((invoice) => {
      const amount = Number(invoice.total || 0);
      const currency = invoice.currency === "GHS" ? "GHS" : "CAD";

      if (invoice.status === "OVERDUE") {
        base.overdueCount += 1;
      }
      if (invoice.status === "PAID") {
        base.paidCount += 1;
        base.paidTotal[currency] += amount;
      } else if (invoice.status !== "VOID") {
        base.openCount += 1;
        base.openTotal[currency] += amount;
      }
    });

    return base;
  }, [invoices]);

  const openCreateModal = () => {
    const defaultOrgId =
      selectedOrganizationId && selectedOrganizationId !== "all"
        ? selectedOrganizationId
        : userOrgId || "";
    setFormState(buildInvoiceForm({ organizationId: defaultOrgId }));
    setEditingInvoiceId(null);
    setFormError("");
    setShowForm(true);
  };

  const openEditModal = (invoice) => {
    const invoiceOrganizationId = invoice.organization?.id ? String(invoice.organization.id) : userOrgId || "";
    setFormState(buildInvoiceForm({ organizationId: invoiceOrganizationId, invoice }));
    setEditingInvoiceId(invoice.id);
    setFormError("");
    setShowForm(true);
  };

  const closeFormModal = () => {
    setShowForm(false);
    setEditingInvoiceId(null);
    setFormError("");
  };

  const updateFormField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (lineId, field, value) => {
    setFormState((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((lineItem) =>
        lineItem.id === lineId ? { ...lineItem, [field]: value } : lineItem
      ),
    }));
  };

  const addLineItem = () => {
    setFormState((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: createLineItemId(),
          description: "",
          quantity: "1",
          rate: "",
        },
      ],
    }));
  };

  const removeLineItem = (lineId) => {
    setFormState((prev) => {
      if (prev.lineItems.length <= 1) return prev;
      return {
        ...prev,
        lineItems: prev.lineItems.filter((lineItem) => lineItem.id !== lineId),
      };
    });
  };

  const handleSaveInvoice = async (event) => {
    event.preventDefault();
    setFormError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const clientName = formState.clientName.trim();
    if (!clientName) {
      setFormError("Client name is required.");
      return;
    }

    if (!formState.issueDate) {
      setFormError("Issue date is required.");
      return;
    }

    if (!formState.lineItems.length) {
      setFormError("Add at least one line item.");
      return;
    }

    const missingDescription = formState.lineItems.some(
      (lineItem) => !String(lineItem.description || "").trim()
    );
    if (missingDescription) {
      setFormError("Each line item needs a description.");
      return;
    }

    if (!invoiceTotals.items.length) {
      setFormError("Add at least one valid line item.");
      return;
    }

    const payload = {
      invoiceNumber: formState.invoiceNumber.trim() || undefined,
      status: formState.status,
      currency: formState.currency,
      issueDate: formState.issueDate,
      dueDate: formState.dueDate || null,
      clientName,
      clientEmail: formState.clientEmail.trim() || null,
      clientAddress: formState.clientAddress.trim() || null,
      notes: formState.notes.trim() || null,
      taxRate: Number(formState.taxRate || 0),
      discount: Number(formState.discount || 0),
      lineItems: formState.lineItems.map((lineItem) => ({
        description: String(lineItem.description || "").trim(),
        quantity: Number(lineItem.quantity || 0),
        unitPrice: Number(lineItem.rate || 0),
      })),
      organizationId:
        isAdmin && formState.organizationId ? Number(formState.organizationId) : undefined,
    };

    setIsSaving(true);
    try {
      const endpoint = editingInvoiceId
        ? `/api/invoices/${editingInvoiceId}`
        : "/api/invoices";
      const method = editingInvoiceId ? "PATCH" : "POST";

      const response = await fetch(buildApiUrl(endpoint), {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(result, "Unable to save invoice"));
      }

      closeFormModal();
      await loadInvoices({ silent: true });
      setNotice(editingInvoiceId ? "Invoice updated." : "Invoice created.");
    } catch (saveError) {
      setFormError(saveError.message || "Unable to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (invoice, nextStatus) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setError("");
      const response = await fetch(buildApiUrl(`/api/invoices/${invoice.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(result, "Unable to update invoice status"));
      }

      await loadInvoices({ silent: true });
      setNotice(`Invoice ${invoice.invoiceNumber} marked ${nextStatus.toLowerCase()}.`);
    } catch (statusError) {
      setError(statusError.message || "Unable to update invoice status");
    }
  };

  const handleDownloadPdf = async (invoice) => {
    if (isPdfDownloading) return;
    setIsPdfDownloading(true);
    setError("");

    try {
      await downloadInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        billFrom: "Dev KPI Workspace",
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        clientAddress: invoice.clientAddress,
        currency: invoice.currency,
        lineItems: (invoice.lineItems || []).map((lineItem) => ({
          description: lineItem.description,
          quantity: lineItem.quantity,
          rate: lineItem.unitPrice,
        })),
        taxRate: invoice.taxRate,
        discount: invoice.discount,
        notes: invoice.notes || "",
      });
      setNotice(`Invoice ${invoice.invoiceNumber} PDF downloaded.`);
    } catch (downloadError) {
      setError(downloadError.message || "Unable to download invoice PDF.");
    } finally {
      setIsPdfDownloading(false);
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Invoicing</h1>
          <p className="muted">Create invoices, track payment status, and export PDFs.</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadInvoices({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          {isAdmin ? (
            <button className="button button-primary" type="button" onClick={openCreateModal}>
              <FiPlus aria-hidden="true" />
              <span>New invoice</span>
            </button>
          ) : null}
        </div>
      </header>

      {organizationError ? <div className="notice">{organizationError}</div> : null}
      {error ? <div className="notice is-error">{error}</div> : null}
      {notice ? <div className="notice is-success">{notice}</div> : null}
      {!isAdmin ? (
        <div className="notice">Read-only mode: only admins can create or update invoices.</div>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Filters</h3>
            <p className="muted">Refine invoices by status and organization.</p>
          </div>
        </div>
        <div className="invoice-grid">
          <label className="form-field">
            <span>Status</span>
            <select
              className="input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {FILTER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {isAdmin ? (
            <label className="form-field">
              <span>Organization</span>
              <select
                className="input"
                value={selectedOrganizationId}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
              >
                <option value="all">All organizations</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={String(organization.id)}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <div className="panel-grid">
        <article className="panel kpi-card">
          <span className="kpi-label">Open invoices</span>
          <div className="kpi-value">{summary.openCount}</div>
          <span className="kpi-delta">
            {formatAmount(summary.openTotal.CAD, "CAD")} · {formatAmount(summary.openTotal.GHS, "GHS")}
          </span>
        </article>
        <article className="panel kpi-card">
          <span className="kpi-label">Overdue</span>
          <div className="kpi-value">{summary.overdueCount}</div>
          <span className="kpi-delta is-warning">Needs follow-up</span>
        </article>
        <article className="panel kpi-card">
          <span className="kpi-label">Paid invoices</span>
          <div className="kpi-value">{summary.paidCount}</div>
          <span className="kpi-delta is-positive">
            {formatAmount(summary.paidTotal.CAD, "CAD")} · {formatAmount(summary.paidTotal.GHS, "GHS")}
          </span>
        </article>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Invoice ledger</h3>
            <p className="muted">Manage statuses and export client-ready PDFs.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-card" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Loading invoices...</span>
          </div>
        ) : (
          <div className="data-table">
            <div className="table-row table-head is-7">
              <span>Invoice #</span>
              <span>Client</span>
              <span>Issue</span>
              <span>Due</span>
              <span>Total</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {invoices.length ? (
              invoices.map((invoice) => (
                <div className="table-row is-7" key={invoice.id}>
                  <div>
                    <span className="table-strong">{invoice.invoiceNumber}</span>
                    {invoice.organization?.name ? (
                      <span className="muted">Org: {invoice.organization.name}</span>
                    ) : null}
                  </div>
                  <div>
                    <span className="table-strong">{invoice.clientName}</span>
                    {invoice.clientEmail ? <span className="muted">{invoice.clientEmail}</span> : null}
                  </div>
                  <span>{formatDate(invoice.issueDate)}</span>
                  <span>{formatDate(invoice.dueDate)}</span>
                  <span className="table-strong">{formatAmount(invoice.total, invoice.currency)}</span>
                  <span className={`status-pill is-${STATUS_TONE[invoice.status] || "info"}`}>
                    {invoice.status}
                  </span>
                  <div className="row-actions">
                    {isAdmin ? (
                      <button className="text-button" type="button" onClick={() => openEditModal(invoice)}>
                        Edit
                      </button>
                    ) : null}
                    {isAdmin && invoice.status === "DRAFT" ? (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => handleStatusChange(invoice, "SENT")}
                      >
                        Mark sent
                      </button>
                    ) : null}
                    {isAdmin && invoice.status !== "PAID" && invoice.status !== "VOID" ? (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => handleStatusChange(invoice, "PAID")}
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {isAdmin && invoice.status !== "VOID" ? (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => handleStatusChange(invoice, "VOID")}
                      >
                        Void
                      </button>
                    ) : null}
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Download ${invoice.invoiceNumber} PDF`}
                      onClick={() => handleDownloadPdf(invoice)}
                      disabled={isPdfDownloading}
                    >
                      <DocumentDownload size={14} variant="Linear" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No invoices found.</p>
            )}
          </div>
        )}
      </section>

      {showForm ? (
        <div className="modal-backdrop" role="presentation">
          <button
            className="modal-dismiss"
            type="button"
            aria-label="Close invoice form"
            onClick={closeFormModal}
          />
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="invoice-form-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Invoicing</p>
                <h3 id="invoice-form-title">{editingInvoiceId ? "Edit invoice" : "Create invoice"}</h3>
                <p className="muted">Complete details and line items before saving.</p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeFormModal}>
                Close
              </button>
            </div>

            {formError ? <div className="notice is-error">{formError}</div> : null}

            <form className="stack" onSubmit={handleSaveInvoice}>
              <div className="invoice-meta">
                <div className="invoice-grid">
                  {isAdmin ? (
                    <label className="form-field">
                      <span>Organization</span>
                      <select
                        className="input"
                        value={formState.organizationId}
                        onChange={(event) => updateFormField("organizationId", event.target.value)}
                        required
                      >
                        <option value="">Select organization</option>
                        {organizations.map((organization) => (
                          <option key={organization.id} value={String(organization.id)}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="form-field">
                    <span>Invoice number (optional)</span>
                    <input
                      className="input"
                      type="text"
                      value={formState.invoiceNumber}
                      onChange={(event) => updateFormField("invoiceNumber", event.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </label>

                  <label className="form-field">
                    <span>Status</span>
                    <select
                      className="input"
                      value={formState.status}
                      onChange={(event) => updateFormField("status", event.target.value)}
                    >
                      {INVOICE_STATUS_OPTIONS.map((option) => (
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
                      onChange={(event) => updateFormField("currency", event.target.value)}
                    >
                      {CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Issue date</span>
                    <input
                      className="input"
                      type="date"
                      value={formState.issueDate}
                      onChange={(event) => updateFormField("issueDate", event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Due date</span>
                    <input
                      className="input"
                      type="date"
                      value={formState.dueDate}
                      onChange={(event) => updateFormField("dueDate", event.target.value)}
                    />
                  </label>

                  <label className="form-field">
                    <span>Client name</span>
                    <input
                      className="input"
                      type="text"
                      value={formState.clientName}
                      onChange={(event) => updateFormField("clientName", event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Client email</span>
                    <input
                      className="input"
                      type="email"
                      value={formState.clientEmail}
                      onChange={(event) => updateFormField("clientEmail", event.target.value)}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>Client address</span>
                  <textarea
                    className="input"
                    value={formState.clientAddress}
                    onChange={(event) => updateFormField("clientAddress", event.target.value)}
                  />
                </label>
              </div>

              <div className="invoice-line-items">
                <div className="panel-header">
                  <div>
                    <h3>Line items</h3>
                    <p className="muted">Add billable items for this invoice.</p>
                  </div>
                  <button className="button button-ghost" type="button" onClick={addLineItem}>
                    <FiPlus aria-hidden="true" />
                    <span>Add line</span>
                  </button>
                </div>

                {formState.lineItems.map((lineItem) => (
                  <div className="invoice-line-row" key={lineItem.id}>
                    <label className="form-field">
                      <span>Description</span>
                      <input
                        className="input"
                        type="text"
                        value={lineItem.description}
                        onChange={(event) => updateLineItem(lineItem.id, "description", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>Qty</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={lineItem.quantity}
                        onChange={(event) => updateLineItem(lineItem.id, "quantity", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>Rate</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={lineItem.rate}
                        onChange={(event) => updateLineItem(lineItem.id, "rate", event.target.value)}
                      />
                    </label>
                    <button
                      className="button button-ghost"
                      type="button"
                      aria-label="Remove line item"
                      onClick={() => removeLineItem(lineItem.id)}
                      disabled={formState.lineItems.length <= 1}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="invoice-grid">
                <label className="form-field">
                  <span>Tax rate (%)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formState.taxRate}
                    onChange={(event) => updateFormField("taxRate", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Discount</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.discount}
                    onChange={(event) => updateFormField("discount", event.target.value)}
                  />
                </label>
              </div>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  className="input"
                  value={formState.notes}
                  onChange={(event) => updateFormField("notes", event.target.value)}
                />
              </label>

              <div className="invoice-summary">
                <div className="invoice-summary__row">
                  <span>Subtotal</span>
                  <span>{formatAmount(invoiceTotals.subtotal, formState.currency)}</span>
                </div>
                <div className="invoice-summary__row">
                  <span>Tax ({invoiceTotals.taxRate.toFixed(2)}%)</span>
                  <span>{formatAmount(invoiceTotals.taxAmount, formState.currency)}</span>
                </div>
                <div className="invoice-summary__row">
                  <span>Discount</span>
                  <span>-{formatAmount(invoiceTotals.discount, formState.currency)}</span>
                </div>
                <div className="invoice-summary__row is-total">
                  <span>Total</span>
                  <span>{formatAmount(invoiceTotals.total, formState.currency)}</span>
                </div>
              </div>

              <div className="header-actions">
                <button className="button button-ghost" type="button" onClick={closeFormModal}>
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingInvoiceId ? "Save invoice" : "Create invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Invoicing;
