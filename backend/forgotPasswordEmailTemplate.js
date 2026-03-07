const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildForgotPasswordEmailContent = ({ recipientName, resetUrl, expiresInHours }) => {
  const safeRecipient = String(recipientName || "").trim() || "there";
  const safeUrl = String(resetUrl || "").trim();
  const expiryLabel = `${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}`;
  const subject = "Reset your Regimanuel Rent Tracker password";
  const text = [
    `Hi ${safeRecipient},`,
    "",
    "We received a request to reset your Regimanuel Rent Tracker password.",
    `Use the link below to set a new password (expires in ${expiryLabel}):`,
    "",
    safeUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#2d2d2d;">
      <p>Hi ${escapeHtml(safeRecipient)},</p>
      <p>We received a request to reset your <strong>Regimanuel Rent Tracker</strong> password.</p>
      <p>Use the button below to set a new password (expires in ${escapeHtml(expiryLabel)}).</p>
      <p>
        <a href="${escapeHtml(
          safeUrl
        )}" style="display:inline-block;padding:10px 14px;background:#2d6cdf;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${escapeHtml(safeUrl)}">${escapeHtml(safeUrl)}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `.trim();

  return { subject, text, html };
};
