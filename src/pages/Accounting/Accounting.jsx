import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DocumentDownload, NoteText, ReceiptItem } from "iconsax-react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { buildApiUrl } from "../../api-url";
import { buildInvoiceNotes } from "../../utils/invoiceNotes";
import { calculateInvoiceTotals, downloadInvoicePdf } from "../../utils/invoicePdf";

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

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const createLineItemId = () =>
  `line-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;

const buildFutureDate = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const buildInvoiceFormFromEntry = (entry = null) => ({
  clientName: entry?.organization?.name || "",
  clientEmail: "",
  clientAddress: "",
  issueDate: buildTodayDate(),
  dueDate: entry?.dueAt ? String(entry.dueAt).slice(0, 10) : buildFutureDate(14),
  currency: entry?.currency || "CAD",
  taxRate: "0",
  discount: "0",
  notes: buildInvoiceNotes(entry?.detail || ""),
  lineItems: [
    {
      id: createLineItemId(),
      description: entry?.serviceName || "",
      quantity: "1",
      rate: entry?.amount ? String(entry.amount) : "",
    },
  ],
});

const Accounting = () => {
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const userOrgId = storedUser?.organizationId ? String(storedUser.organizationId) : "";
  const [timeRange, setTimeRange] = useState("mtd");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    isAdmin ? "all" : userOrgId || ""
  );
  const [organizations, setOrganizations] = useState([]);
  const [organizationError, setOrganizationError] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [faakoStatus, setFaakoStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [actionNotice, setActionNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [invoiceComposer, setInvoiceComposer] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState(() => buildInvoiceFormFromEntry());
  const [invoiceError, setInvoiceError] = useState("");
  const [isInvoicePreparing, setIsInvoicePreparing] = useState(false);
  const [isInvoiceDownloading, setIsInvoiceDownloading] = useState(false);
  const [formState, setFormState] = useState({
    type: "EXPENSE",
    status: "PENDING",
    currency: "CAD",
    amount: "",
    serviceName: "",
    detail: "",
    date: buildTodayDate(),
    recurringInterval: "",
    organizationId: userOrgId || "",
  });

  const resetFormState = useCallback(
    (overrides = {}) => {
      setFormState({
        type: "EXPENSE",
        status: "PENDING",
        currency: "CAD",
        amount: "",
        serviceName: "",
        detail: "",
        date: buildTodayDate(),
        recurringInterval: "",
        organizationId: userOrgId || "",
        ...overrides,
      });
    },
    [userOrgId]
  );

  const openForm = useCallback(() => {
    const defaultOrgId =
      selectedOrganizationId && selectedOrganizationId !== "all"
        ? selectedOrganizationId
        : userOrgId || "";
    resetFormState({ organizationId: defaultOrgId });
    setShowForm(true);
  }, [resetFormState, selectedOrganizationId, userOrgId]);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingEntryId(null);
    resetFormState();
  }, [resetFormState]);

  const closeInvoiceComposer = useCallback(() => {
    setInvoiceComposer(null);
    setInvoiceForm(buildInvoiceFormFromEntry());
    setInvoiceError("");
    setIsInvoiceDownloading(false);
  }, []);

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
        if (response.status === 403) {
          setOrganizations([]);
          return;
        }
        throw new Error(payload?.error || "Unable to load organizations");
      }
      setOrganizations(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setOrganizationError(err.message || "Unable to load organizations");
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (!showForm && !invoiceComposer) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (invoiceComposer) {
        closeInvoiceComposer();
        return;
      }
      if (showForm) {
        closeForm();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showForm, invoiceComposer, closeForm, closeInvoiceComposer]);

  useEffect(() => {
    if (!organizations.length) return;
    const hasSelected =
      selectedOrganizationId !== "all" &&
      organizations.some((org) => String(org.id) === selectedOrganizationId);
    const defaultOrgId =
      userOrgId && organizations.some((org) => String(org.id) === userOrgId)
        ? userOrgId
        : String(organizations[0].id);

    if (selectedOrganizationId && selectedOrganizationId !== "all" && !hasSelected) {
      setSelectedOrganizationId(defaultOrgId);
    }

    if (
      !formState.organizationId ||
      !organizations.some((org) => String(org.id) === formState.organizationId)
    ) {
      setFormState((prev) => ({ ...prev, organizationId: defaultOrgId }));
    }
  }, [organizations, selectedOrganizationId, userOrgId, formState.organizationId]);

  useEffect(() => {
    if (!selectedOrganizationId || selectedOrganizationId === "all") return;
    if (showForm) return;
    if (formState.organizationId !== selectedOrganizationId) {
      setFormState((prev) => ({ ...prev, organizationId: selectedOrganizationId }));
    }
  }, [selectedOrganizationId, formState.organizationId, showForm]);

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
      setActionNotice("");

      try {
        const query = new URLSearchParams({ range: timeRange });
        if (selectedOrganizationId) {
          if (selectedOrganizationId === "all" && isAdmin) {
            query.set("organizationId", "all");
          } else if (selectedOrganizationId !== "all") {
            query.set("organizationId", selectedOrganizationId);
          }
        }
        const response = await fetch(buildApiUrl(`/api/accounting/entries?${query.toString()}`), {
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
          throw new Error(payload?.error || "Unable to load accounting data");
        }
        setEntries(payload.entries || []);
        setFaakoStatus(payload.faakoStatus || "");
        setOpenActionId(null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigate, selectedOrganizationId, timeRange, isAdmin]
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

  const invoiceTotals = useMemo(
    () =>
      calculateInvoiceTotals({
        lineItems: invoiceForm.lineItems,
        taxRate: invoiceForm.taxRate,
        discount: invoiceForm.discount,
      }),
    [invoiceForm.lineItems, invoiceForm.taxRate, invoiceForm.discount]
  );

  const updateInvoiceField = (field, value) => {
    setInvoiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateInvoiceLineItem = (lineId, field, value) => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addInvoiceLineItem = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { id: createLineItemId(), description: "", quantity: "1", rate: "" },
      ],
    }));
  };

  const removeInvoiceLineItem = (lineId) => {
    setInvoiceForm((prev) => {
      if (prev.lineItems.length <= 1) return prev;
      return {
        ...prev,
        lineItems: prev.lineItems.filter((line) => line.id !== lineId),
      };
    });
  };

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

    if (isAdmin && organizations.length && !formState.organizationId) {
      setFormError("Select an organization.");
      return;
    }

    setIsSaving(true);
    try {
      const organizationId =
        formState.organizationId || (selectedOrganizationId !== "all" ? selectedOrganizationId : "");
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
        organizationId: organizationId || undefined,
      };

      const endpoint = editingEntryId
        ? `/api/accounting/entries/${editingEntryId}`
        : "/api/accounting/entries";
      const method = editingEntryId ? "PATCH" : "POST";

      const response = await fetch(buildApiUrl(endpoint), {
        method,
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
      setEditingEntryId(null);
      resetFormState();
      loadEntries({ silent: true });
      setActionNotice(editingEntryId ? "Entry updated." : "Entry created.");
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

  const performEntryAction = async (entryId, path) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return null;
    }
    const response = await fetch(buildApiUrl(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to complete action");
    }
    return payload;
  };

  const handleEditEntry = (entry) => {
    setOpenActionId(null);
    setShowForm(true);
    setEditingEntryId(entry.id);
    const dateValue = resolveEntryDate(entry);
    resetFormState({
      type: entry.type || "EXPENSE",
      status: entry.status || "PENDING",
      currency: entry.currency || "CAD",
      amount: entry.amount ? String(entry.amount) : "",
      serviceName: entry.serviceName || "",
      detail: entry.detail || "",
      date: dateValue ? String(dateValue).slice(0, 10) : buildTodayDate(),
      recurringInterval: entry.recurringInterval || "",
      organizationId: entry.organization?.id ? String(entry.organization.id) : userOrgId || "",
    });
  };

  const handleMarkPaid = async (entry) => {
    try {
      setActionNotice("");
      await performEntryAction(entry.id, `/api/accounting/entries/${entry.id}/mark-paid`);
      setActionNotice("Marked as paid.");
      loadEntries({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setOpenActionId(null);
    }
  };

  const handleArchive = async (entry) => {
    try {
      setActionNotice("");
      await performEntryAction(entry.id, `/api/accounting/entries/${entry.id}/archive`);
      setActionNotice("Entry archived.");
      loadEntries({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setOpenActionId(null);
    }
  };

  const handleGenerateInvoice = async (entry) => {
    try {
      setError("");
      setInvoiceError("");
      setActionNotice("");
      setIsInvoicePreparing(true);
      const payload = await performEntryAction(entry.id, `/api/accounting/entries/${entry.id}/invoice`);
      const invoiceNumber = payload?.invoiceNumber || payload?.entry?.invoiceNumber;
      if (!invoiceNumber) {
        throw new Error("Unable to prepare invoice number.");
      }
      const resolvedEntry = payload?.entry ? { ...entry, ...payload.entry } : entry;
      setInvoiceComposer({
        invoiceNumber,
        entry: resolvedEntry,
      });
      setInvoiceForm(buildInvoiceFormFromEntry(resolvedEntry));
      setActionNotice(`Invoice ${invoiceNumber} ready for PDF export.`);
      loadEntries({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setOpenActionId(null);
      setIsInvoicePreparing(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceComposer) return;

    setInvoiceError("");
    const clientName = invoiceForm.clientName.trim();
    if (!clientName) {
      setInvoiceError("Client name is required before exporting the PDF.");
      return;
    }
    if (!invoiceTotals.items.length) {
      setInvoiceError("Add at least one invoice line item.");
      return;
    }

    setIsInvoiceDownloading(true);
    try {
      await downloadInvoicePdf({
        invoiceNumber: invoiceComposer.invoiceNumber,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate,
        billFrom: "By Nana",
        clientName,
        clientEmail: invoiceForm.clientEmail.trim(),
        clientAddress: invoiceForm.clientAddress.trim(),
        currency: invoiceForm.currency,
        lineItems: invoiceForm.lineItems,
        taxRate: invoiceForm.taxRate,
        discount: invoiceForm.discount,
        notes: invoiceForm.notes,
      });
      setActionNotice(`Invoice ${invoiceComposer.invoiceNumber} PDF downloaded.`);
    } catch (downloadError) {
      setInvoiceError(downloadError.message || "Unable to create PDF.");
    } finally {
      setIsInvoiceDownloading(false);
    }
  };

  const expenseEntriesByStatus = useMemo(() => {
    const base = {
      PAID: [],
      PENDING: [],
      SCHEDULED: [],
      OVERDUE: [],
    };
    sortedEntries.forEach((entry) => {
      if (entry.type !== "EXPENSE") return;
      const bucket = base[entry.status] || [];
      bucket.push(entry);
      base[entry.status] = bucket;
    });
    return base;
  }, [sortedEntries]);

  const renderLedgerRow = (entry) => {
    const dateLabel = entry.status === "PAID" ? "Paid date" : "Due date";
    const cadenceLabel = entry.recurringInterval
      ? `Recurring ${entry.recurringInterval.toLowerCase()}`
      : null;
    const invoiceLabel = entry.invoiceNumber ? `Invoice ${entry.invoiceNumber}` : null;
    const organizationLabel = entry.organization?.name ? `Org: ${entry.organization.name}` : null;
    const canManage = entry.source === "MANUAL";
    const openEntryEditor = () => {
      if (!canManage) return;
      handleEditEntry(entry);
    };
    const serviceContent = (
      <>
        <span className="table-strong">{entry.serviceName}</span>
        <span className="muted">
          {[entry.detail, cadenceLabel, invoiceLabel].filter(Boolean).join(" • ") || "—"}
        </span>
        {organizationLabel ? <span className="muted">{organizationLabel}</span> : null}
      </>
    );

    return (
      <div
        className={`table-row is-7${openActionId === entry.id ? " is-menu-open" : ""}`}
        key={entry.id}
      >
        <span className="table-strong">{entry.id}</span>
        {canManage ? (
          <button className="accounting-entry-link" type="button" onClick={openEntryEditor}>
            {serviceContent}
          </button>
        ) : (
          <div className="accounting-entry-link is-static">{serviceContent}</div>
        )}
        <span>{entry.type}</span>
        <div>
          <div className="table-strong">{formatDate(resolveEntryDate(entry))}</div>
          <span className="muted">{dateLabel}</span>
        </div>
        <span className="table-strong">{formatAmountValue(entry.amount)}</span>
        <span>{entry.currency}</span>
        <div className="row-actions">
          <span className={`status-pill is-${STATUS_TONE[entry.status] || "info"}`}>
            {entry.status}
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Row actions"
            onClick={() =>
              setOpenActionId((current) => (current === entry.id ? null : entry.id))
            }
          >
            ⋯
          </button>
          {openActionId === entry.id ? (
            <div className="row-actions__menu" role="menu">
              <button type="button" onClick={() => handleEditEntry(entry)} disabled={!canManage}>
                Edit entry
              </button>
              <button
                type="button"
                onClick={() => handleGenerateInvoice(entry)}
                disabled={!canManage || isInvoicePreparing}
              >
                {isInvoicePreparing ? "Preparing invoice..." : "Create invoice PDF"}
              </button>
              <button
                type="button"
                onClick={() => handleMarkPaid(entry)}
                disabled={!canManage || entry.status === "PAID"}
              >
                Mark as paid
              </button>
              <button type="button" onClick={() => handleArchive(entry)} disabled={!canManage}>
                Archive
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Accounting</h1>
          <p className="muted">
            Paid services revenue and expenses, pending payables, and invoice-ready PDFs.
            Window: {RANGE_LABELS[timeRange] || "Month to date"}.
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
          {organizations.length ? (
            <label className="form-field" style={{ minWidth: "220px" }}>
              <select
                className="input"
                value={selectedOrganizationId}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
              >
                {isAdmin ? <option value="all">All organizations</option> : null}
                {organizations.map((org) => (
                  <option key={org.id} value={String(org.id)}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadEntries({ silent: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Sync ledger"}
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              if (showForm) {
                closeForm();
                return;
              }
              openForm();
            }}
          >
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

      {actionNotice ? (
        <div className="notice is-success" role="status">
          {actionNotice}
        </div>
      ) : null}

      {organizationError ? (
        <div className="notice is-error" role="alert">
          {organizationError}
        </div>
      ) : null}

      {faakoStatus && faakoStatus !== "ok" ? (
        <div className="notice" role="status">
          Faako subscription sync status: {faakoStatus.replace(/_/g, " ")}.
        </div>
      ) : null}

      {showForm ? (
        <div className="modal-backdrop" role="presentation">
          <button
            className="modal-dismiss"
            type="button"
            aria-label="Close modal"
            onClick={closeForm}
          />
          <article
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-modal-title"
          >
            <div className="panel-header">
              <div>
                <h3 id="entry-modal-title">{editingEntryId ? "Edit entry" : "Manual entry"}</h3>
                <p className="muted">
                  {editingEntryId
                    ? "Update the selected transaction details."
                    : "Add expenses or one-off revenue not from Faako subscriptions."}
                </p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeForm}>
                Close
              </button>
            </div>

            {formError ? (
              <div className="notice is-error" role="alert">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="stack">
              <div className="page-grid">
                <div className="stack">
                  {organizations.length ? (
                    <label className="form-field">
                      <span>Organization</span>
                      <select
                        className="input"
                        value={formState.organizationId}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, organizationId: event.target.value }))
                        }
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={String(org.id)}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, date: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </div>
              <label className="form-field">
                <span>Details (optional)</span>
                <textarea
                  className="input"
                  value={formState.detail}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, detail: event.target.value }))
                  }
                  placeholder="Add extra context for this transaction"
                />
              </label>
              <div className="header-actions">
                <button className="button button-ghost" type="button" onClick={closeForm}>
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingEntryId ? "Save changes" : "Save entry"}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {invoiceComposer ? (
        <div className="modal-backdrop" role="presentation">
          <button
            className="modal-dismiss"
            type="button"
            aria-label="Close invoice builder"
            onClick={closeInvoiceComposer}
          />
          <article
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-modal-title"
          >
            <div className="panel-header">
              <div>
                <h3 id="invoice-modal-title">Invoice builder</h3>
                <p className="muted">
                  Invoice #{invoiceComposer.invoiceNumber} for {invoiceComposer.entry.serviceName}.
                </p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeInvoiceComposer}>
                Close
              </button>
            </div>

            {invoiceError ? (
              <div className="notice is-error" role="alert">
                {invoiceError}
              </div>
            ) : null}

            <div className="invoice-meta">
              <div className="invoice-grid">
                <label className="form-field">
                  <span>Client name</span>
                  <input
                    className="input"
                    type="text"
                    value={invoiceForm.clientName}
                    onChange={(event) => updateInvoiceField("clientName", event.target.value)}
                    placeholder="Client or company name"
                  />
                </label>
                <label className="form-field">
                  <span>Client email</span>
                  <input
                    className="input"
                    type="email"
                    value={invoiceForm.clientEmail}
                    onChange={(event) => updateInvoiceField("clientEmail", event.target.value)}
                    placeholder="billing@company.com"
                  />
                </label>
                <label className="form-field">
                  <span>Issue date</span>
                  <input
                    className="input"
                    type="date"
                    value={invoiceForm.issueDate}
                    onChange={(event) => updateInvoiceField("issueDate", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Due date</span>
                  <input
                    className="input"
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(event) => updateInvoiceField("dueDate", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Currency</span>
                  <select
                    className="input"
                    value={invoiceForm.currency}
                    onChange={(event) => updateInvoiceField("currency", event.target.value)}
                  >
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Client address</span>
                  <input
                    className="input"
                    type="text"
                    value={invoiceForm.clientAddress}
                    onChange={(event) => updateInvoiceField("clientAddress", event.target.value)}
                    placeholder="Street, city, postal code"
                  />
                </label>
              </div>
            </div>

            <div className="invoice-line-items">
              <div className="panel-header">
                <div>
                  <h4>Line items</h4>
                  <p className="muted">Define billable items for this invoice.</p>
                </div>
                <button className="button button-ghost" type="button" onClick={addInvoiceLineItem}>
                  <FiPlus aria-hidden="true" />
                  <span>Add line</span>
                </button>
              </div>

              {invoiceForm.lineItems.map((lineItem) => (
                <div className="invoice-line-row" key={lineItem.id}>
                  <label className="form-field">
                    <span>Description</span>
                    <input
                      className="input"
                      type="text"
                      value={lineItem.description}
                      onChange={(event) =>
                        updateInvoiceLineItem(lineItem.id, "description", event.target.value)
                      }
                      placeholder="Consulting sprint"
                    />
                  </label>
                  <label className="form-field">
                    <span>Qty</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={lineItem.quantity}
                      onChange={(event) =>
                        updateInvoiceLineItem(lineItem.id, "quantity", event.target.value)
                      }
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
                      onChange={(event) =>
                        updateInvoiceLineItem(lineItem.id, "rate", event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Remove line item"
                    onClick={() => removeInvoiceLineItem(lineItem.id)}
                    disabled={invoiceForm.lineItems.length <= 1}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="invoice-grid">
              <label className="form-field">
                <span>Tax (%)</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.taxRate}
                  onChange={(event) => updateInvoiceField("taxRate", event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Discount amount</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.discount}
                  onChange={(event) => updateInvoiceField("discount", event.target.value)}
                />
              </label>
            </div>

            <label className="form-field">
              <span>
                <NoteText className="field-icon" size={14} variant="Linear" />
                Notes
              </span>
              <textarea
                className="input"
                value={invoiceForm.notes}
                onChange={(event) => updateInvoiceField("notes", event.target.value)}
                placeholder="Optional payment instructions"
              />
            </label>

            <div className="invoice-summary">
              <div className="invoice-summary__row">
                <span>Subtotal</span>
                <span>{formatAmount(invoiceTotals.subtotal, invoiceForm.currency)}</span>
              </div>
              <div className="invoice-summary__row">
                <span>Tax ({invoiceTotals.taxRate.toFixed(2)}%)</span>
                <span>{formatAmount(invoiceTotals.taxAmount, invoiceForm.currency)}</span>
              </div>
              <div className="invoice-summary__row">
                <span>Discount</span>
                <span>-{formatAmount(invoiceTotals.discount, invoiceForm.currency)}</span>
              </div>
              <div className="invoice-summary__row is-total">
                <span>Total</span>
                <span>{formatAmount(invoiceTotals.total, invoiceForm.currency)}</span>
              </div>
            </div>

            <div className="header-actions">
              <button className="button button-ghost" type="button" onClick={closeInvoiceComposer}>
                Cancel
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={handleDownloadInvoice}
                disabled={isInvoiceDownloading}
              >
                <DocumentDownload size={16} variant="Linear" />
                <span>{isInvoiceDownloading ? "Generating PDF..." : "Download invoice PDF"}</span>
              </button>
            </div>
          </article>
        </div>
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
          {sortedEntries.map(renderLedgerRow)}
        </div>
      </article>
      <div className="stack">
        {[
          { status: "PENDING", label: "Pending payables" },
          { status: "SCHEDULED", label: "Scheduled payments" },
          { status: "OVERDUE", label: "Overdue expenses" },
        ].map((section) => {
          const rows = expenseEntriesByStatus[section.status] || [];
          return (
            <article className="panel" key={section.status}>
              <div className="panel-header">
                <div>
                  <h3>{section.label}</h3>
                  <p className="muted">
                    {rows.length} entries • Amounts tracked in CAD and GHS.
                  </p>
                </div>
                <span className={`status-pill is-${STATUS_TONE[section.status] || "info"}`}>
                  {section.status}
                </span>
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
                {rows.length ? rows.map(renderLedgerRow) : null}
              </div>

              {!rows.length ? (
                <p className="muted">No {section.label.toLowerCase()} in this range.</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default Accounting;
