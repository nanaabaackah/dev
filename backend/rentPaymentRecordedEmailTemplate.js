const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (amount, currency) =>
  `${currency} ${Number(amount || 0).toFixed(2)}`;

export const buildRentPaymentRecordedEmailContent = ({
  summary,
  payment,
  paymentMonthLabel,
  templateOptions = {},
  contentOptions = {},
}) => {
  const subjectPrefix =
    String(templateOptions?.subjectPrefix || "Rent payment recorded").trim() ||
    "Rent payment recorded";
  const heading =
    String(templateOptions?.heading || "Rent payment recorded").trim() || "Rent payment recorded";
  const introText = String(templateOptions?.introText || "").trim();
  const footerText =
    String(
      templateOptions?.footerText ||
        "This notification confirms the payment currently recorded in the rent tracker."
    ).trim() || "This notification confirms the payment currently recorded in the rent tracker.";
  const paymentDateLabel = payment?.paidAt ? String(payment.paidAt).slice(0, 10) : "N/A";
  const yearEndLabel = summary.yearEndProjectionLabel || "Year end";
  const subject = `${subjectPrefix} • ${summary.tenantName} • ${paymentMonthLabel}`;

  const text = [
    `${heading} for ${summary.tenantName}`,
    "",
    contentOptions.paymentMonth !== false ? `Payment month: ${paymentMonthLabel}` : null,
    contentOptions.paymentDate !== false ? `Payment date: ${paymentDateLabel}` : null,
    contentOptions.amountReceived !== false
      ? `Amount received: ${formatMoney(payment.amount, payment.currency)}`
      : null,
    introText ? "" : null,
    introText || null,
    "",
    contentOptions.paymentDetails !== false && payment.method ? `Method: ${payment.method}` : null,
    contentOptions.paymentDetails !== false && payment.reference
      ? `Reference: ${payment.reference}`
      : null,
    contentOptions.paymentDetails !== false && payment.notes ? `Notes: ${payment.notes}` : null,
    "",
    contentOptions.monthlyRent !== false
      ? `Monthly rent: ${formatMoney(summary.monthlyRent, summary.currency)}`
      : null,
    contentOptions.paidThisMonth !== false
      ? `Paid this month: ${formatMoney(summary.paidThisMonth, summary.currency)}`
      : null,
    contentOptions.outstandingThisMonth !== false
      ? `Outstanding this month: ${formatMoney(summary.outstandingThisMonth, summary.currency)}`
      : null,
    contentOptions.yearEndOutstanding !== false
      ? `${yearEndLabel}: ${formatMoney(summary.outstandingYear, summary.currency)}`
      : null,
    contentOptions.periodsMissed !== false ? `Missed periods: ${summary.periodsMissed}` : null,
    "",
    footerText,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f6f3f0;font-family:Arial,sans-serif;color:#2d2d2d;line-height:1.55;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9d0c9;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#3f342f 0%,#5b4a42 100%);color:#f8f3ef;">
          <h1 style="margin:0;font-size:28px;line-height:1.1;">${escapeHtml(heading)}</h1>
          <p style="margin:10px 0 0;font-size:15px;color:#f0e5de;">${escapeHtml(
            summary.tenantName
          )} • ${escapeHtml(paymentMonthLabel)}</p>
        </div>

        <div style="padding:28px;">
          ${
            introText
              ? `<p style="margin:0 0 16px;color:#000000;">${escapeHtml(introText)}</p>`
              : ""
          }
          <table style="width:100%;border-collapse:collapse;border:1px solid #d9d0c9;margin:0 0 20px;">
            <tbody>
              ${
                contentOptions.paymentDate !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Payment date</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(paymentDateLabel)}</td></tr>`
                  : ""
              }
              ${
                contentOptions.paymentMonth !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Payment month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(paymentMonthLabel)}</td></tr>`
                  : ""
              }
              ${
                contentOptions.amountReceived !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Amount received</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(payment.amount, payment.currency)
                    )}</td></tr>`
                  : ""
              }
              ${
                contentOptions.paymentDetails !== false && payment.method
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Method</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(payment.method)}</td></tr>`
                  : ""
              }
              ${
                contentOptions.paymentDetails !== false && payment.reference
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Reference</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(payment.reference)}</td></tr>`
                  : ""
              }
              ${
                contentOptions.paymentDetails !== false && payment.notes
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Notes</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(payment.notes)}</td></tr>`
                  : ""
              }
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;border:1px solid #d9d0c9;">
            <tbody>
              ${
                contentOptions.monthlyRent !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Monthly rent</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(summary.monthlyRent, summary.currency)
                    )}</td></tr>`
                  : ""
              }
              ${
                contentOptions.paidThisMonth !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Paid this month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(summary.paidThisMonth, summary.currency)
                    )}</td></tr>`
                  : ""
              }
              ${
                contentOptions.outstandingThisMonth !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Outstanding this month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(summary.outstandingThisMonth, summary.currency)
                    )}</td></tr>`
                  : ""
              }
              ${
                contentOptions.yearEndOutstanding !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>${escapeHtml(
                      yearEndLabel
                    )}</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(summary.outstandingYear, summary.currency)
                    )}</td></tr>`
                  : ""
              }
              ${
                contentOptions.periodsMissed !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Missed periods</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      String(summary.periodsMissed || 0)
                    )}</td></tr>`
                  : ""
              }
            </tbody>
          </table>
          <p style="margin:16px 0 0;color:#5f524d;">${escapeHtml(footerText)}</p>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
};
