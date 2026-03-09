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
}) => {
  const subject = `Rent monthly summary • ${summary.tenantName} • ${monthLabel}`;
  const orgLabel = String(organizationName || "").trim();
  const landlordLabel = summary.landlordName || summary.landlordEmail || "Not assigned";
  const missedPeriods = Number(summary.periodsMissed || 0);

  const text = [
    `Rent monthly summary for ${summary.tenantName}`,
    "",
    orgLabel ? `Organization: ${orgLabel}` : null,
    `Month: ${monthLabel}`,
    `Tenant email: ${summary.tenantEmail || "N/A"}`,
    `Landlord: ${landlordLabel}`,
    summary.landlordEmail ? `Landlord email: ${summary.landlordEmail}` : null,
    "",
    `Monthly rent: ${formatMoney(summary.monthlyRent, summary.currency)}`,
    `Paid this month: ${formatMoney(summary.paidThisMonth, summary.currency)}`,
    `Expected this month: ${formatMoney(summary.expectedThisMonth, summary.currency)}`,
    `Outstanding this month: ${formatMoney(summary.outstandingThisMonth, summary.currency)}`,
    `Total outstanding balance: ${formatMoney(summary.outstandingTotal, summary.currency)}`,
    `Missed periods: ${missedPeriods}`,
    "",
    `Lease start: ${summary.leaseStartDate ? summary.leaseStartDate.slice(0, 10) : "N/A"}`,
    `Lease end: ${summary.leaseEndDate ? summary.leaseEndDate.slice(0, 10) : "Open-ended"}`,
    "",
    "Please review this summary and reply if anything looks incorrect.",
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
          <h1 style="margin:0;font-size:28px;line-height:1.1;">Rent monthly summary</h1>
          <p style="margin:10px 0 0;font-size:15px;color:#f0e5de;">${escapeHtml(
            summary.tenantName
          )} • ${escapeHtml(monthLabel)}</p>
        </div>

        <div style="padding:28px;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #d9d0c9;margin:0 0 20px;">
            <tbody>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Tenant email</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(summary.tenantEmail || "N/A")}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Landlord</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(landlordLabel)}</td></tr>
              ${
                summary.landlordEmail
                  ? `<tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Landlord email</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(summary.landlordEmail)}</td></tr>`
                  : ""
              }
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Monthly rent</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                formatMoney(summary.monthlyRent, summary.currency)
              )}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Paid this month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                formatMoney(summary.paidThisMonth, summary.currency)
              )}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Expected this month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                formatMoney(summary.expectedThisMonth, summary.currency)
              )}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Outstanding this month</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                formatMoney(summary.outstandingThisMonth, summary.currency)
              )}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Total outstanding balance</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                formatMoney(summary.outstandingTotal, summary.currency)
              )}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Missed periods</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${missedPeriods}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Lease start</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                summary.leaseStartDate ? summary.leaseStartDate.slice(0, 10) : "N/A"
              )}</td></tr>
              <tr><td style="padding:8px 10px;border:1px solid #d9d0c9;"><strong>Lease end</strong></td><td style="padding:8px 10px;border:1px solid #d9d0c9;">${escapeHtml(
                summary.leaseEndDate ? summary.leaseEndDate.slice(0, 10) : "Open-ended"
              )}</td></tr>
            </tbody>
          </table>

          <p style="margin:0;color:#5f524d;">Please review this summary and reply if anything looks incorrect.</p>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
};
