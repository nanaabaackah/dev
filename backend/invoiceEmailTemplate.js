const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatInvoiceCurrency = (amount, currency) =>
  `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const resolveInvoiceDateLabel = (value) => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const MONTHLY_CHARGE_MARKER = "↳ ";
const DEFAULT_QUANTITY_UNIT = "unit";
const DEFAULT_TEMPLATE_BRANDING = {
  senderName: "By Nana",
  headerTagline: "Professional services invoice",
  deliveryLead: "Please find your invoice attached below.",
  introMessage: "Thank you for your business. Please find your invoice details below.",
  supportMessage: "If you have any questions about this invoice, please reply to this email.",
};
const UNIT_SINGULAR_OVERRIDES = {
  hours: "hour",
  days: "day",
  weeks: "week",
  months: "month",
  sessions: "session",
  projects: "project",
  units: "unit",
};

const normalizeQuantityUnit = (value) => {
  const normalized = String(value || DEFAULT_QUANTITY_UNIT).trim();
  return normalized || DEFAULT_QUANTITY_UNIT;
};

const formatQuantityUnit = (quantity, unit) => {
  const normalizedUnit = normalizeQuantityUnit(unit);
  const normalizedQuantity = Number(quantity);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity !== 1) {
    return normalizedUnit;
  }

  const unitOverride = UNIT_SINGULAR_OVERRIDES[normalizedUnit.toLowerCase()];
  if (unitOverride) return unitOverride;
  if (normalizedUnit.endsWith("s")) {
    return normalizedUnit.slice(0, -1);
  }
  return normalizedUnit;
};

const parseInvoiceLineDescription = (rawDescription = "") => {
  const raw = String(rawDescription || "");
  const isMonthlyCharge = raw.startsWith(MONTHLY_CHARGE_MARKER);
  const withoutMarker = isMonthlyCharge
    ? raw.slice(MONTHLY_CHARGE_MARKER.length).trimStart()
    : raw;
  const unitMatch = withoutMarker.match(/\s*\[unit:\s*([^\]]+)\]\s*$/);

  if (!unitMatch) {
    return {
      description: withoutMarker.trim(),
      isMonthlyCharge,
      unit: DEFAULT_QUANTITY_UNIT,
    };
  }

  return {
    description: withoutMarker.slice(0, unitMatch.index).trim(),
    isMonthlyCharge,
    unit: String(unitMatch[1] || "").trim() || DEFAULT_QUANTITY_UNIT,
  };
};

export const buildInvoiceEmailContent = (invoice, templateOptions = {}) => {
  const senderName =
    String(templateOptions?.senderName || DEFAULT_TEMPLATE_BRANDING.senderName).trim() ||
    DEFAULT_TEMPLATE_BRANDING.senderName;
  const headerTagline =
    String(templateOptions?.headerTagline || DEFAULT_TEMPLATE_BRANDING.headerTagline).trim() ||
    DEFAULT_TEMPLATE_BRANDING.headerTagline;
  const deliveryLead =
    String(templateOptions?.deliveryLead || DEFAULT_TEMPLATE_BRANDING.deliveryLead).trim() ||
    DEFAULT_TEMPLATE_BRANDING.deliveryLead;
  const introMessage =
    String(templateOptions?.introMessage || DEFAULT_TEMPLATE_BRANDING.introMessage).trim() ||
    DEFAULT_TEMPLATE_BRANDING.introMessage;
  const supportMessage =
    String(templateOptions?.supportMessage || DEFAULT_TEMPLATE_BRANDING.supportMessage).trim() ||
    DEFAULT_TEMPLATE_BRANDING.supportMessage;
  const closingName =
    String(templateOptions?.closingName || senderName).trim() || senderName;

  const rawLineItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  const lineItems = rawLineItems.map((lineItem) => {
    const amount = Number(lineItem?.amount ?? 0);
    const quantity = Number(lineItem?.quantity ?? 0);
    const rate = Number(lineItem?.unitPrice ?? 0);
    const { description, isMonthlyCharge, unit } = parseInvoiceLineDescription(lineItem?.description);
    return { amount, quantity, rate, isMonthlyCharge, unit, description };
  });
  const monthlyChargeTotal = lineItems.reduce(
    (acc, lineItem) => (lineItem.isMonthlyCharge ? acc + lineItem.amount : acc),
    0
  );

  const currency = invoice?.currency === "GHS" ? "GHS" : "CAD";
  const linesHtml = lineItems
    .map((lineItem) => {
      const indent = lineItem.isMonthlyCharge ? 1 : 0;
      const descriptionText = lineItem.description || "Line item";
      const quantityText = `${lineItem.quantity.toLocaleString("en-US")} ${formatQuantityUnit(
        lineItem.quantity,
        lineItem.unit || DEFAULT_QUANTITY_UNIT
      )}`.trim();
      return `
        <tr>
          <td style="padding:8px 10px;border:1px solid #d0d0c8;text-align:left;padding-left:${12 + indent * 20}px">
            ${escapeHtml(descriptionText)}
          </td>
          <td style="padding:8px 10px;border:1px solid #d0d0c8;text-align:right">
            ${escapeHtml(quantityText)}
          </td>
          <td style="padding:8px 10px;border:1px solid #d0d0c8;text-align:right">
            ${escapeHtml(formatInvoiceCurrency(lineItem.rate, currency))}
          </td>
          <td style="padding:8px 10px;border:1px solid #d0d0c8;text-align:right">
            ${escapeHtml(formatInvoiceCurrency(lineItem.amount, currency))}
          </td>
        </tr>
      `.trim();
    })
    .join("");

  const subtotal = Number(invoice?.subtotal ?? 0);
  const regularSubtotal = Math.max(subtotal - monthlyChargeTotal, 0);
  const taxRate = Number(invoice?.taxRate ?? 0);
  const taxAmount = Number(invoice?.taxAmount ?? 0);
  const discount = Number(invoice?.discount ?? 0);
  const total = Number(invoice?.total ?? subtotal + taxAmount - discount);
  const invoiceNumber = invoice?.invoiceNumber || "DRAFT";
  const clientName = invoice?.clientName || "Client";
  const clientEmail = invoice?.clientEmail || "N/A";
  const clientAddress = String(invoice?.clientAddress || "").trim();
  const notes = String(invoice?.notes || "").trim();
  const issueDateLabel = resolveInvoiceDateLabel(invoice?.issueDate);
  const dueDateLabel = resolveInvoiceDateLabel(invoice?.dueDate);
  const paymentPrompt =
    dueDateLabel !== "N/A"
      ? `Please arrange payment by ${dueDateLabel}.`
      : "Please arrange payment at your earliest convenience.";
  const notesText = notes ? `Notes: ${notes}` : null;

  const text = [
    `Invoice ${invoiceNumber} from ${senderName}`,
    "",
    `Hello ${clientName},`,
    "",
    deliveryLead,
    paymentPrompt,
    "",
    "Invoice details",
    `Invoice number: ${invoiceNumber}`,
    `Issue date: ${issueDateLabel}`,
    `Due date: ${dueDateLabel}`,
    `Billing contact: ${clientName}`,
    `Email: ${clientEmail}`,
    ...(clientAddress ? [`Address: ${clientAddress}`] : []),
    "",
    "Line items:",
    ...lineItems.map(
      (lineItem) =>
        `${lineItem.description} | Qty: ${lineItem.quantity.toLocaleString("en-US")} ${formatQuantityUnit(
          lineItem.quantity,
          lineItem.unit || DEFAULT_QUANTITY_UNIT
        )} | Rate: ${formatInvoiceCurrency(
          lineItem.rate,
          currency
        )} | Amount: ${formatInvoiceCurrency(lineItem.amount, currency)}`
    ),
    "",
    `Monthly charges: ${formatInvoiceCurrency(monthlyChargeTotal, currency)}`,
    `Subtotal (excluding monthly charges): ${formatInvoiceCurrency(regularSubtotal, currency)}`,
    `Tax (${taxRate.toFixed(2)}%): ${formatInvoiceCurrency(taxAmount, currency)}`,
    `Discount: -${formatInvoiceCurrency(discount, currency)}`,
    `Total due: ${formatInvoiceCurrency(total, currency)}`,
    ...(notesText ? ["", notesText] : []),
    "",
    supportMessage,
    "",
    "Thank you,",
    closingName,
  ].join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#1f2937;line-height:1.55;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #d8e0ea;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#cbd5e1;">${escapeHtml(
            senderName
          )}</p>
          <h1 style="margin:0;font-size:28px;line-height:1.1;">Invoice ${escapeHtml(invoiceNumber)}</h1>
          <p style="margin:10px 0 0;font-size:14px;color:#dbe4ee;">${escapeHtml(headerTagline)}</p>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 14px;">Hello ${escapeHtml(clientName)},</p>
          <p style="margin:0 0 12px;">${escapeHtml(introMessage)}</p>
          <p style="margin:0 0 20px;">${escapeHtml(paymentPrompt)}</p>

          <table style="width:100%;border-collapse:separate;border-spacing:0 0;margin:0 0 20px;">
            <tbody>
              <tr>
                <td style="width:50%;vertical-align:top;padding:0 10px 0 0;">
                  <div style="border:1px solid #d8e0ea;border-radius:14px;padding:16px;background:#f8fafc;">
                    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Bill to</p>
                    <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(
                      clientName
                    )}</p>
                    <p style="margin:0 0 6px;color:#475569;">${escapeHtml(clientEmail)}</p>
                    ${
                      clientAddress
                        ? `<p style="margin:0;color:#475569;">${escapeHtml(clientAddress)}</p>`
                        : ""
                    }
                  </div>
                </td>
                <td style="width:50%;vertical-align:top;padding:0 0 0 10px;">
                  <div style="border:1px solid #d8e0ea;border-radius:14px;padding:16px;background:#f8fafc;">
                    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Invoice details</p>
                    <p style="margin:0 0 8px;"><strong>Invoice #:</strong> ${escapeHtml(invoiceNumber)}</p>
                    <p style="margin:0 0 8px;"><strong>Issue date:</strong> ${escapeHtml(issueDateLabel)}</p>
                    <p style="margin:0 0 8px;"><strong>Due date:</strong> ${escapeHtml(dueDateLabel)}</p>
                    <p style="margin:0;"><strong>Currency:</strong> ${escapeHtml(currency)}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style="border-collapse:collapse;border:1px solid #d8e0ea;width:100%;margin:0 0 20px;background:#ffffff;">
            <thead>
              <tr>
                <th style="padding:10px 12px;border:1px solid #d8e0ea;background:#eef4fa;text-align:left;color:#334155;">Description</th>
                <th style="padding:10px 12px;border:1px solid #d8e0ea;background:#eef4fa;text-align:right;color:#334155;">Qty</th>
                <th style="padding:10px 12px;border:1px solid #d8e0ea;background:#eef4fa;text-align:right;color:#334155;">Rate</th>
                <th style="padding:10px 12px;border:1px solid #d8e0ea;background:#eef4fa;text-align:right;color:#334155;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml || `<tr><td colspan="4" style="padding:10px 12px;border:1px solid #d8e0ea;color:#475569;">No line items</td></tr>`}
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin:0 0 18px;">
            <tbody>
              <tr>
                <td style="padding:5px 0;color:#475569;">Monthly charges</td>
                <td style="padding:5px 0;text-align:right;color:#0f172a;font-weight:600;">${escapeHtml(
                  formatInvoiceCurrency(monthlyChargeTotal, currency)
                )}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#475569;">Subtotal (excluding monthly charges)</td>
                <td style="padding:5px 0;text-align:right;color:#0f172a;font-weight:600;">${escapeHtml(
                  formatInvoiceCurrency(regularSubtotal, currency)
                )}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#475569;">Tax (${escapeHtml(taxRate.toFixed(2))}%)</td>
                <td style="padding:5px 0;text-align:right;color:#0f172a;font-weight:600;">${escapeHtml(
                  formatInvoiceCurrency(taxAmount, currency)
                )}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#475569;">Discount</td>
                <td style="padding:5px 0;text-align:right;color:#b91c1c;font-weight:600;">-${escapeHtml(
                  formatInvoiceCurrency(discount, currency)
                )}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;border-top:1px solid #d8e0ea;color:#0f172a;font-size:16px;font-weight:700;">Total due</td>
                <td style="padding:12px 0 0;border-top:1px solid #d8e0ea;text-align:right;color:#0f172a;font-size:18px;font-weight:700;">${escapeHtml(
                  formatInvoiceCurrency(total, currency)
                )}</td>
              </tr>
            </tbody>
          </table>

          ${
            notes
              ? `<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:14px;background:#fffaf0;">
                  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Notes</p>
                  <p style="margin:0;color:#334155;">${escapeHtml(notes)}</p>
                </div>`
              : ""
          }

          <p style="margin:0 0 10px;">${escapeHtml(supportMessage)}</p>
          <p style="margin:0;">Thank you,<br /><strong>${escapeHtml(closingName)}</strong></p>
        </div>
      </div>
    </div>
  `.trim();

  return {
    subject: `Invoice ${invoiceNumber} from ${senderName}`,
    text,
    html,
  };
};
