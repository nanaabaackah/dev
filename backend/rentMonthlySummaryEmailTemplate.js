const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (amount, currency) =>
  `${currency} ${Number(amount || 0).toFixed(2)}`;

export const buildRentMonthlySummaryEmailContent = ({
  summary,
  monthLabel,
  organizationName,
  templateOptions = {},
  contentOptions = {},
}) => {
  const subjectPrefix =
    String(templateOptions?.subjectPrefix || "Rent monthly summary").trim() ||
    "Rent monthly summary";
  const heading =
    String(templateOptions?.heading || "Rent monthly summary").trim() || "Rent monthly summary";
  const introText =
    String(templateOptions?.introText || "").trim();
  const footerText =
    String(templateOptions?.footerText || "Please review this summary and reply if anything looks incorrect.").trim() ||
    "Please review this summary and reply if anything looks incorrect.";
  const subject = `${subjectPrefix} • ${summary.tenantName} • ${monthLabel}`;
  const orgLabel = String(organizationName || "").trim();
  const landlordLabel = summary.landlordName || summary.landlordEmail || "Not assigned";
  const missedPeriods = Number(summary.periodsMissed || 0);

  const text = [
    `${heading} for ${summary.tenantName}`,
    "",
    orgLabel ? `Organization: ${orgLabel}` : null,
    `Month: ${monthLabel}`,
    contentOptions.tenantEmail !== false ? `Tenant email: ${summary.tenantEmail || "N/A"}` : null,
    contentOptions.landlord !== false ? `Landlord: ${landlordLabel}` : null,
    contentOptions.landlord !== false && summary.landlordEmail
      ? `Landlord email: ${summary.landlordEmail}`
      : null,
    introText ? "" : null,
    introText || null,
    "",
    contentOptions.monthlyRent !== false
      ? `Monthly rent: ${formatMoney(summary.monthlyRent, summary.currency)}`
      : null,
    contentOptions.paidThisMonth !== false
      ? `Paid this month: ${formatMoney(summary.paidThisMonth, summary.currency)}`
      : null,
    contentOptions.expectedThisMonth !== false
      ? `Expected this month: ${formatMoney(summary.expectedThisMonth, summary.currency)}`
      : null,
    contentOptions.outstandingThisMonth !== false
      ? `Outstanding this month: ${formatMoney(summary.outstandingThisMonth, summary.currency)}`
      : null,
    contentOptions.outstandingTotal !== false
      ? `Total outstanding balance: ${formatMoney(summary.outstandingTotal, summary.currency)}`
      : null,
    contentOptions.periodsMissed !== false ? `Missed periods: ${missedPeriods}` : null,
    "",
    contentOptions.leaseDates !== false
      ? `Lease start: ${summary.leaseStartDate ? summary.leaseStartDate.slice(0, 10) : "N/A"}`
      : null,
    contentOptions.leaseDates !== false
      ? `Lease end: ${summary.leaseEndDate ? summary.leaseEndDate.slice(0, 10) : "Open-ended"}`
      : null,
    "",
    footerText,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f6f3f0;font-family:Arial,sans-serif;color:#2d2d2d;line-height:1.55;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9d0c9;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#3f342f 0%,#5b4a42 100%);color:#f8f3ef;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ddcfc6;">${escapeHtml(
            orgLabel || "Rent module"
          )}</p>
          <h1 style="margin:0;font-size:28px;line-height:1.1;">${escapeHtml(heading)}</h1>
          <p style="margin:10px 0 0;font-size:15px;color:#f0e5de;">${escapeHtml(
            summary.tenantName
          )} • ${escapeHtml(monthLabel)}</p>
        </div>

        <div style="padding:28px;">
          ${
            introText
              ? `<p style="margin:0 0 16px;color:#5f524d;">${escapeHtml(introText)}</p>`
              : ""
          }
          <table style="width:100%;border-collapse:collapse;border:1px solid #d9d0c9;margin:0 0 20px;">
            <tbody>
              ${
                contentOptions.tenantEmail !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Tenant email</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(summary.tenantEmail || "N/A")}</td></tr>`
                  : ""
              }
              ${
                contentOptions.landlord !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Landlord</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(landlordLabel)}</td></tr>`
                  : ""
              }
              ${
                contentOptions.landlord !== false && summary.landlordEmail
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Landlord email</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(summary.landlordEmail)}</td></tr>`
                  : ""
              }
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
                contentOptions.expectedThisMonth !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Expected this month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(summary.expectedThisMonth, summary.currency)
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
                contentOptions.outstandingTotal !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Total outstanding balance</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      formatMoney(summary.outstandingTotal, summary.currency)
                    )}</td></tr>`
                  : ""
              }
              ${
                contentOptions.periodsMissed !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Missed periods</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${missedPeriods}</td></tr>`
                  : ""
              }
              ${
                contentOptions.leaseDates !== false
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Lease start</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      summary.leaseStartDate ? summary.leaseStartDate.slice(0, 10) : "N/A"
                    )}</td></tr>
                    <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Lease end</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                      summary.leaseEndDate ? summary.leaseEndDate.slice(0, 10) : "Open-ended"
                    )}</td></tr>`
                  : ""
              }
            </tbody>
          </table>

          <p style="margin:0;color:#5f524d;">${escapeHtml(footerText)}</p>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
};
