const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MONTHLY_CHARGE_MARKER = "↳ ";
const DEFAULT_BILL_FROM = "By Nana";
const PDF_COLORS = {
  brand: [15, 23, 42],
  accent: [14, 116, 144],
  panel: [248, 250, 252],
  border: [226, 232, 240],
  rowTint: [248, 250, 252],
  monthlyTint: [239, 246, 255],
  text: [15, 23, 42],
  muted: [100, 116, 139],
  white: [255, 255, 255],
  note: [255, 251, 235],
  noteBorder: [253, 230, 138],
  danger: [185, 28, 28],
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

const DEFAULT_QUANTITY_UNIT = "unit";
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

const parseLineItemDescription = (rawDescription = "") => {
  const raw = String(rawDescription || "");
  const isMonthlyCharge = raw.startsWith(MONTHLY_CHARGE_MARKER);
  const withoutMarker = isMonthlyCharge
    ? raw.slice(MONTHLY_CHARGE_MARKER.length).trimStart()
    : raw;
  const unitMatch = withoutMarker.match(/\s*\[unit:\s*([^\]]+)\]\s*$/);

  if (!unitMatch) {
    return {
      isMonthlyCharge,
      description: withoutMarker.trim(),
      unit: DEFAULT_QUANTITY_UNIT,
    };
  }

  return {
    isMonthlyCharge,
    description: withoutMarker.slice(0, unitMatch.index).trim(),
    unit: String(unitMatch[1] || "").trim() || DEFAULT_QUANTITY_UNIT,
  };
};

export const calculateInvoiceTotals = ({ lineItems = [], taxRate = 0, discount = 0 } = {}) => {
  const resolveIndentLevel = (lineItem) => {
    if (String(lineItem?.description || "").startsWith(MONTHLY_CHARGE_MARKER)) {
      return 1;
    }
    if (lineItem?.parentLineId) {
      return 1;
    }
    const level = Number(lineItem?.indentLevel);
    return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  };

  const normalizedItems = lineItems
    .map((item, index) => {
      const parsedLineItem = parseLineItemDescription(item?.description);
      const quantity = Math.max(asNumber(item.quantity), 0);
      const rate = Math.max(asNumber(item.rate), 0);
      return {
        id: item.id || `line-${index + 1}`,
        description: parsedLineItem.description,
        quantity,
        rate,
        amount: quantity * rate,
        indentLevel: resolveIndentLevel(item),
        unit: parsedLineItem.unit,
        isMonthlyCharge: parsedLineItem.isMonthlyCharge || Boolean(item?.parentLineId),
      };
    })
    .filter((item) => item.description || item.amount > 0);

  const subtotal = normalizedItems.reduce((total, item) => total + item.amount, 0);
  const monthlyChargeSubtotal = normalizedItems.reduce(
    (total, item) => total + (item.isMonthlyCharge ? item.amount : 0),
    0
  );
  const regularSubtotal = subtotal - monthlyChargeSubtotal;
  const normalizedTaxRate = Math.max(asNumber(taxRate), 0);
  const normalizedDiscount = Math.max(asNumber(discount), 0);
  const taxAmount = subtotal * (normalizedTaxRate / 100);
  const total = Math.max(subtotal + taxAmount - normalizedDiscount, 0);

  return {
    items: normalizedItems,
    subtotal,
    monthlyChargeSubtotal,
    regularSubtotal,
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
  billFrom = DEFAULT_BILL_FROM,
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
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const drawPanel = (x, top, width, height, fillColor, borderColor = PDF_COLORS.border, radius = 14) => {
    doc.setFillColor(...fillColor);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(x, top, width, height, radius, radius, "FD");
  };

  const drawContinuationHeader = (label = "Invoice") => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(`${invoiceNumber || "DRAFT"} - ${label}`, margin, y);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.line(margin, y + 10, pageWidth - margin, y + 10);
    y += 24;
  };

  const ensureSpace = (nextHeight = 20, label = "Invoice") => {
    if (y + nextHeight <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
    drawContinuationHeader(label);
  };

  const headerY = 32;
  const headerHeight = 110;
  drawPanel(margin, headerY, contentWidth, headerHeight, PDF_COLORS.brand, PDF_COLORS.brand, 18);
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(margin, headerY, contentWidth, 8, "F");

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", margin + 22, headerY + 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(billFrom, margin + 22, headerY + 66);
  doc.setFontSize(9);
  doc.setTextColor(214, 223, 235);
  doc.text("Professional services invoice", margin + 22, headerY + 84);

  const totalBoxWidth = 172;
  const totalBoxHeight = 58;
  const totalBoxX = pageWidth - margin - totalBoxWidth - 20;
  const totalBoxY = headerY + 26;
  drawPanel(
    totalBoxX,
    totalBoxY,
    totalBoxWidth,
    totalBoxHeight,
    PDF_COLORS.accent,
    PDF_COLORS.accent,
    14
  );
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL DUE", totalBoxX + 14, totalBoxY + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatMoney(totals.total, currency), totalBoxX + totalBoxWidth - 14, totalBoxY + 40, {
    align: "right",
  });

  y = headerY + headerHeight + 24;

  const infoGap = 16;
  const billToWidth = 278;
  const detailsWidth = contentWidth - billToWidth - infoGap;
  const billToTextWidth = billToWidth - 32;
  const billToNameLines = doc.splitTextToSize(clientName || "Client", billToTextWidth);
  const billToDetailLines = [clientEmail, clientAddress]
    .filter(Boolean)
    .flatMap((line) => doc.splitTextToSize(line, billToTextWidth));
  const infoRows = [
    { label: "Invoice #", value: String(invoiceNumber || "DRAFT") },
    { label: "Issue date", value: formatDateLabel(issueDate) },
    { label: "Due date", value: formatDateLabel(dueDate) },
    { label: "Currency", value: currency },
  ];
  const detailRowLayouts = infoRows.map((row) => {
    const valueLines = doc.splitTextToSize(row.value, detailsWidth - 32);
    return {
      ...row,
      valueLines,
      rowHeight: 18 + valueLines.length * 14 + 10,
    };
  });
  const billToHeight =
    42 + billToNameLines.length * 16 + billToDetailLines.length * 13 + Math.max(billToDetailLines.length, 1) * 2;
  const detailsHeight = 42 + detailRowLayouts.reduce((total, row) => total + row.rowHeight, 0);
  const infoCardHeight = Math.max(126, billToHeight, detailsHeight);

  drawPanel(margin, y, billToWidth, infoCardHeight, PDF_COLORS.panel);
  drawPanel(margin + billToWidth + infoGap, y, detailsWidth, infoCardHeight, PDF_COLORS.panel);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("BILL TO", margin + 16, y + 20);

  let billToY = y + 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PDF_COLORS.text);
  billToNameLines.forEach((line) => {
    doc.text(line, margin + 16, billToY);
    billToY += 16;
  });

  if (billToDetailLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.muted);
    billToDetailLines.forEach((line) => {
      doc.text(line, margin + 16, billToY);
      billToY += 15;
    });
  }

  const detailsX = margin + billToWidth + infoGap;
  let detailsY = y + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("INVOICE DETAILS", detailsX + 16, detailsY);
  detailsY += 20;

  detailRowLayouts.forEach((row, index) => {
    const rowTop = detailsY;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(row.label.toUpperCase(), detailsX + 16, rowTop);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.text);
    row.valueLines.forEach((line, lineIndex) => {
      doc.text(line, detailsX + 16, rowTop + 16 + lineIndex * 14);
    });

    if (index < detailRowLayouts.length - 1) {
      doc.setDrawColor(...PDF_COLORS.border);
      doc.line(
        detailsX + 16,
        rowTop + row.rowHeight - 4,
        detailsX + detailsWidth - 16,
        rowTop + row.rowHeight - 4
      );
    }
    detailsY += row.rowHeight;
  });

  y += infoCardHeight + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("LINE ITEMS", margin, y);
  y += 14;

  const tableX = margin;
  const tableWidth = contentWidth;
  const tablePadding = 14;
  const qtyWidth = 82;
  const rateWidth = 92;
  const amountWidth = 114;
  const amountX = tableX + tableWidth - tablePadding;
  const rateX = amountX - amountWidth;
  const qtyX = rateX - rateWidth;
  const descX = tableX + tablePadding;
  const descWidth = Math.max(160, qtyX - qtyWidth - descX - 6);
  const tableHeaderHeight = 30;

  const drawTableHeader = () => {
    ensureSpace(tableHeaderHeight + 12, "Line items");
    doc.setFillColor(...PDF_COLORS.brand);
    doc.roundedRect(tableX, y, tableWidth, tableHeaderHeight, 10, 10, "F");
    doc.setTextColor(...PDF_COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const headerTextY = y + 19;
    doc.text("Description", descX, headerTextY);
    doc.text("Qty", qtyX, headerTextY, { align: "right" });
    doc.text("Rate", rateX, headerTextY, { align: "right" });
    doc.text("Amount", amountX, headerTextY, { align: "right" });
    y += tableHeaderHeight + 8;
  };

  drawTableHeader();

  if (!totals.items.length) {
    ensureSpace(42, "Line items");
    drawPanel(tableX, y, tableWidth, 42, PDF_COLORS.white);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("No line items added.", tableX + 16, y + 25);
    y += 50;
  } else {
    totals.items.forEach((item, index) => {
      const quantityLabel = `${item.quantity.toLocaleString("en-US")} ${formatQuantityUnit(
        item.quantity,
        item.unit || ""
      )}`.trim();
      const indentLevel = Math.min(item.indentLevel || 0, 3);
      const descriptionLeft = descX + indentLevel * 14 + (item.isMonthlyCharge ? 10 : 0);
      const descriptionWidth = Math.max(120, descWidth - indentLevel * 14 - (item.isMonthlyCharge ? 10 : 0));
      const descriptionLines = doc.splitTextToSize(item.description || "Service", descriptionWidth);
      const rowHeight = Math.max(34, descriptionLines.length * 14 + 14);

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawContinuationHeader("Line items");
        drawTableHeader();
      }

      const rowFill = item.isMonthlyCharge
        ? PDF_COLORS.monthlyTint
        : index % 2 === 0
          ? PDF_COLORS.white
          : PDF_COLORS.rowTint;

      drawPanel(tableX, y, tableWidth, rowHeight, rowFill, PDF_COLORS.border, 8);

      if (item.isMonthlyCharge) {
        doc.setFillColor(...PDF_COLORS.accent);
        doc.roundedRect(tableX + 8, y + 8, 4, rowHeight - 16, 2, 2, "F");
      }

      doc.setFont("helvetica", item.isMonthlyCharge ? "normal" : "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...PDF_COLORS.text);
      descriptionLines.forEach((line, lineIndex) => {
        doc.text(line, descriptionLeft, y + 18 + lineIndex * 13);
      });

      const valueY = y + rowHeight / 2 + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(quantityLabel, qtyX, valueY, { align: "right" });
      doc.text(formatMoney(item.rate, currency), rateX, valueY, { align: "right" });
      doc.text(formatMoney(item.amount, currency), amountX, valueY, { align: "right" });

      y += rowHeight + 8;
    });
  }

  y += 8;

  const summaryWidth = 282;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryRows = [
    ["Monthly charges", formatMoney(totals.monthlyChargeSubtotal, currency)],
    ["Subtotal (excluding monthly charges)", formatMoney(totals.regularSubtotal, currency)],
    [`Tax (${totals.taxRate.toFixed(2)}%)`, formatMoney(totals.taxAmount, currency)],
    ["Discount", `-${formatMoney(totals.discount, currency)}`],
  ];
  const summaryLabelWidth = 152;
  const summaryRowLayouts = summaryRows.map(([label, value]) => {
    const labelLines = doc.splitTextToSize(label, summaryLabelWidth);
    return {
      labelLines,
      value,
      rowHeight: Math.max(24, labelLines.length * 12 + 6),
      isDiscount: label === "Discount",
    };
  });
  const summaryBodyHeight = summaryRowLayouts.reduce((total, row) => total + row.rowHeight, 0);
  const totalBlockHeight = 52;
  const summaryHeight = 34 + summaryBodyHeight + totalBlockHeight + 22;

  ensureSpace(summaryHeight, "Summary");
  drawPanel(summaryX, y, summaryWidth, summaryHeight, PDF_COLORS.white);

  let summaryY = y + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("PAYMENT SUMMARY", summaryX + 16, summaryY);
  summaryY += 16;

  summaryRowLayouts.forEach((row, index) => {
    const rowTop = summaryY;
    const labelY = rowTop + 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_COLORS.muted);
    row.labelLines.forEach((line, lineIndex) => {
      doc.text(line, summaryX + 16, labelY + lineIndex * 11);
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...(row.isDiscount ? PDF_COLORS.danger : PDF_COLORS.text));
    doc.text(row.value, summaryX + summaryWidth - 16, rowTop + row.rowHeight / 2 + 4, {
      align: "right",
    });

    if (index < summaryRowLayouts.length - 1) {
      doc.setDrawColor(...PDF_COLORS.border);
      doc.line(summaryX + 16, rowTop + row.rowHeight, summaryX + summaryWidth - 16, rowTop + row.rowHeight);
    }
    summaryY += row.rowHeight;
  });

  const totalBlockX = summaryX + 12;
  const totalBlockY = y + summaryHeight - totalBlockHeight - 12;
  const totalBlockWidth = summaryWidth - 24;
  drawPanel(
    totalBlockX,
    totalBlockY,
    totalBlockWidth,
    totalBlockHeight,
    PDF_COLORS.brand,
    PDF_COLORS.brand,
    12
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("TOTAL DUE", totalBlockX + 16, totalBlockY + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatMoney(totals.total, currency), totalBlockX + totalBlockWidth - 16, totalBlockY + 35, {
    align: "right",
  });

  y += summaryHeight + 20;

  if (notes.trim()) {
    const noteLines = doc.splitTextToSize(notes.trim(), contentWidth - 32);
    const noteHeight = Math.max(74, 42 + noteLines.length * 14);
    ensureSpace(noteHeight, "Notes");
    drawPanel(margin, y, contentWidth, noteHeight, PDF_COLORS.note, PDF_COLORS.noteBorder, 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("NOTES", margin + 16, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.text);
    noteLines.forEach((line, index) => {
      doc.text(line, margin + 16, y + 42 + index * 14);
    });

    y += noteHeight + 18;
  }

  if (y + 20 <= pageHeight - margin) {
    doc.setDrawColor(...PDF_COLORS.border);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("Thank you for your business.", margin, y + 14);
    doc.text(`Prepared by ${billFrom}`, pageWidth - margin, y + 14, { align: "right" });
  }

  const fileName = `${String(invoiceNumber || "invoice").replace(/[^\w-]+/g, "_")}.pdf`;
  doc.save(fileName);
  return totals;
};
