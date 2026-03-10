const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (amount, currency) =>
  `${currency} ${Number(amount || 0).toFixed(2)}`;

const formatUtcDateLabel = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const buildAccountingScheduledReminderEmailContent = ({
  entries,
  dueDate,
  organizationName,
  daysUntilDue = 2,
  templateOptions = {},
  contentOptions = {},
}) => {
  const dueDateLabel = formatUtcDateLabel(dueDate);
  const orgLabel = String(organizationName || "").trim();
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const subjectPrefix =
    String(templateOptions?.subjectPrefix || "Upcoming scheduled payment reminder").trim() ||
    "Upcoming scheduled payment reminder";
  const heading =
    String(templateOptions?.heading || "Upcoming scheduled payment reminder").trim() ||
    "Upcoming scheduled payment reminder";
  const introText =
    String(
      templateOptions?.introText ||
        "The following scheduled accounting entries are due soon. Please review them before the due date."
    ).trim() ||
    "The following scheduled accounting entries are due soon. Please review them before the due date.";
  const footerText =
    String(templateOptions?.footerText || "Please review these scheduled payments before the due date.").trim() ||
    "Please review these scheduled payments before the due date.";
  const subject = `${subjectPrefix} • ${orgLabel || "Accounting"} • ${dueDateLabel}`;

  const textLines = [
    `${heading} for ${orgLabel || "your organization"}`,
    "",
    contentOptions.dueDate !== false ? `Due date: ${dueDateLabel}` : null,
    contentOptions.reminderWindow !== false
      ? `Reminder window: ${daysUntilDue} days before due date`
      : null,
    "",
    introText,
    "",
    ...normalizedEntries.flatMap((entry, index) => [
      `${index + 1}. ${entry.serviceName || "Scheduled payment"}`,
      `   Amount: ${formatMoney(entry.amount, entry.currency)}`,
      contentOptions.recurrence !== false && entry.recurringInterval
        ? `   Recurrence: ${entry.recurringInterval}`
        : null,
      contentOptions.notes !== false && entry.detail ? `   Notes: ${entry.detail}` : null,
      "",
    ]),
    footerText,
  ].filter(Boolean);

  const columnDefinitions = [
    { key: "service", label: "Service", enabled: true },
    { key: "amount", label: "Amount", enabled: true },
    {
      key: "recurrence",
      label: "Recurrence",
      enabled: contentOptions.recurrence !== false,
    },
    {
      key: "notes",
      label: "Notes",
      enabled: contentOptions.notes !== false,
    },
  ].filter((column) => column.enabled);

  const rowsHtml = normalizedEntries
    .map(
      (entry) => `
        <tr>
          ${columnDefinitions
            .map((column) => {
              if (column.key === "service") {
                return `<td style="padding:10px 12px;border:1px solid #d9d0c9;">${escapeHtml(
                  entry.serviceName || "Scheduled payment"
                )}</td>`;
              }
              if (column.key === "amount") {
                return `<td style="padding:10px 12px;border:1px solid #d9d0c9;">${escapeHtml(
                  formatMoney(entry.amount, entry.currency)
                )}</td>`;
              }
              if (column.key === "recurrence") {
                return `<td style="padding:10px 12px;border:1px solid #d9d0c9;">${escapeHtml(
                  entry.recurringInterval || "One-time"
                )}</td>`;
              }
              return `<td style="padding:10px 12px;border:1px solid #d9d0c9;">${escapeHtml(
                entry.detail || "—"
              )}</td>`;
            })
            .join("")}
        </tr>
      `.trim()
    )
    .join("");

  const html = `
    <div style="margin:0;padding:24px;background:#f6f3f0;font-family:Arial,sans-serif;color:#2d2d2d;line-height:1.55;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9d0c9;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#3f342f 0%,#5b4a42 100%);color:#f8f3ef;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ddcfc6;">${escapeHtml(
            orgLabel || "Accounting"
          )}</p>
          <h1 style="margin:0;font-size:28px;line-height:1.1;">${escapeHtml(heading)}</h1>
          <p style="margin:10px 0 0;font-size:15px;color:#f0e5de;">${[
            contentOptions.dueDate !== false ? `Due ${escapeHtml(dueDateLabel)}` : null,
            contentOptions.reminderWindow !== false
              ? `${escapeHtml(String(daysUntilDue))} days out`
              : null,
          ]
            .filter(Boolean)
            .join(" • ")}</p>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;color:#5f524d;">${escapeHtml(introText)}</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #d9d0c9;margin:0 0 20px;">
            <thead>
              <tr style="background:#f6f3f0;">
                ${columnDefinitions
                  .map(
                    (column) =>
                      `<th style="padding:10px 12px;border:1px solid #d9d0c9;text-align:left;">${escapeHtml(
                        column.label
                      )}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p style="margin:0;color:#5f524d;">${escapeHtml(footerText)}</p>
        </div>
      </div>
    </div>
  `.trim();

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
};
