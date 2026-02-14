const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmountValue = (amount) =>
  asNumber(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatMoney = (amount, currency) => `${currency} ${formatAmountValue(amount)}`;

const formatDateLabel = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const calculateInvoiceTotals = ({ lineItems = [], taxRate = 0, discount = 0 } = {}) => {
  const normalizedItems = lineItems
    .map((item, index) => {
      const quantity = Math.max(asNumber(item.quantity), 0);
      const rate = Math.max(asNumber(item.rate), 0);
      return {
        id: item.id || `line-${index + 1}`,
        description: String(item.description || "").trim(),
        quantity,
        rate,
        amount: quantity * rate,
      };
    })
    .filter((item) => item.description || item.amount > 0);

  const subtotal = normalizedItems.reduce((total, item) => total + item.amount, 0);
  const normalizedTaxRate = Math.max(asNumber(taxRate), 0);
  const normalizedDiscount = Math.max(asNumber(discount), 0);
  const taxAmount = subtotal * (normalizedTaxRate / 100);
  const total = Math.max(subtotal + taxAmount - normalizedDiscount, 0);

  return {
    items: normalizedItems,
    subtotal,
    taxRate: normalizedTaxRate,
    discount: normalizedDiscount,
    taxAmount,
    total,
  };
};

export const downloadInvoicePdf = async ({
  invoiceNumber,
  issueDate,
  dueDate,
  billFrom = "Dev KPI Workspace",
  clientName,
  clientEmail,
  clientAddress,
  currency = "CAD",
  lineItems = [],
  taxRate = 0,
  discount = 0,
  notes = "",
}) => {
  const { jsPDF } = await import("jspdf");
  const totals = calculateInvoiceTotals({ lineItems, taxRate, discount });

  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 56;

  const ensureSpace = (nextHeight = 20) => {
    if (y + nextHeight <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("INVOICE", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(billFrom, margin, y + 16);
  doc.text(`Invoice #: ${invoiceNumber || "DRAFT"}`, pageWidth - margin, y, {
    align: "right",
  });
  doc.text(`Issue date: ${formatDateLabel(issueDate)}`, pageWidth - margin, y + 14, {
    align: "right",
  });
  doc.text(`Due date: ${formatDateLabel(dueDate)}`, pageWidth - margin, y + 28, {
    align: "right",
  });

  y += 52;
  doc.setDrawColor(213, 221, 233);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bill To", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  const billingLines = [clientName || "Client", clientEmail, clientAddress].filter(Boolean);
  billingLines.forEach((line) => {
    const wrappedLines = doc.splitTextToSize(line, 280);
    wrappedLines.forEach((wrappedLine) => {
      ensureSpace(14);
      doc.text(wrappedLine, margin, y);
      y += 14;
    });
  });

  y += 8;
  ensureSpace(26);

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 12, pageWidth - margin * 2, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", margin + 8, y);
  doc.text("Qty", pageWidth - margin - 175, y, { align: "right" });
  doc.text("Rate", pageWidth - margin - 102, y, { align: "right" });
  doc.text("Amount", pageWidth - margin - 8, y, { align: "right" });
  y += 18;

  doc.setFont("helvetica", "normal");
  totals.items.forEach((item) => {
    const wrappedDescription = doc.splitTextToSize(item.description || "Service", 240);
    const rowHeight = Math.max(18, wrappedDescription.length * 12 + 6);
    ensureSpace(rowHeight + 6);

    wrappedDescription.forEach((line, index) => {
      doc.text(line, margin + 8, y + index * 12);
    });
    doc.text(String(item.quantity), pageWidth - margin - 175, y, { align: "right" });
    doc.text(formatMoney(item.rate, currency), pageWidth - margin - 102, y, { align: "right" });
    doc.text(formatMoney(item.amount, currency), pageWidth - margin - 8, y, { align: "right" });

    y += rowHeight;
    doc.setDrawColor(228, 232, 240);
    doc.line(margin, y - 6, pageWidth - margin, y - 6);
  });

  y += 8;
  const labelX = pageWidth - margin - 188;
  const valueX = pageWidth - margin - 8;
  const summaryRows = [
    ["Subtotal", formatMoney(totals.subtotal, currency)],
    [`Tax (${totals.taxRate.toFixed(2)}%)`, formatMoney(totals.taxAmount, currency)],
    ["Discount", `-${formatMoney(totals.discount, currency)}`],
  ];

  summaryRows.forEach(([label, value]) => {
    ensureSpace(18);
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { align: "right" });
    y += 18;
  });

  ensureSpace(22);
  doc.setFont("helvetica", "bold");
  doc.text("Total", labelX, y);
  doc.text(formatMoney(totals.total, currency), valueX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 24;

  if (notes.trim()) {
    ensureSpace(26);
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(notes.trim(), pageWidth - margin * 2);
    noteLines.forEach((line) => {
      ensureSpace(13);
      doc.text(line, margin, y);
      y += 13;
    });
  }

  const fileName = `${String(invoiceNumber || "invoice").replace(/[^\w-]+/g, "_")}.pdf`;
  doc.save(fileName);
  return totals;
};
