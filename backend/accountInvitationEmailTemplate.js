const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildAccountInvitationEmailContent = ({
  recipientName,
  setupUrl,
  expiresInHours,
}) => {
  const safeRecipient = String(recipientName || "").trim() || "there";
  const safeUrl = String(setupUrl || "").trim();
  const expiryLabel = `${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}`;
  const subject = "You have been invited to join Regimanuel Rent Tracker";
  const text = [
    `Hi ${safeRecipient},`,
    "",
    "You have been invited to join Regimanuel Rent Tracker.",
    `Use the link below to set up your account password (expires in ${expiryLabel}):`,
    "",
    safeUrl,
    "",
    "If you did not expect this invitation, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#2d2d2d;">
      <p>Hi ${escapeHtml(safeRecipient)},</p>
      <p>You have been invited to join <strong>Regimanuel Rent Tracker</strong>.</p>
      <p>Use the button below to set up your account password (expires in ${escapeHtml(
        expiryLabel
      )}).</p>
      <p>
        <a href="${escapeHtml(
          safeUrl
        )}" style="display:inline-block;padding:10px 14px;background:#2d6cdf;color:#fff;text-decoration:none;border-radius:6px;">Set up account</a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${escapeHtml(safeUrl)}">${escapeHtml(safeUrl)}</a></p>
      <p>If you did not expect this invitation, you can ignore this email.</p>
    </div>
  `.trim();

  return { subject, text, html };
};
