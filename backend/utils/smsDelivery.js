const SMS_E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export const normalizeSmsRecipient = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const withInternationalPrefix = trimmed.startsWith("00")
    ? `+${trimmed.slice(2)}`
    : trimmed;

  const compact = withInternationalPrefix.replace(/[\s().-]+/g, "");
  if (!SMS_E164_PATTERN.test(compact)) {
    return "";
  }

  return compact;
};

export const parseSmsRecipients = (value) =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[,\n;]+/)
        .map((entry) => normalizeSmsRecipient(entry))
        .filter(Boolean)
    )
  );

export const resolveSmsDeliveryRecipients = ({
  recipients,
  parseRecipients = parseSmsRecipients,
  isProduction,
  allowNonProduction = false,
}) => {
  const intendedRecipients = parseRecipients(recipients);
  const shouldSendLive = Boolean(intendedRecipients.length) && (isProduction || allowNonProduction);

  return {
    intendedRecipients,
    deliveryRecipients: shouldSendLive ? intendedRecipients : [],
    wasSimulated: Boolean(intendedRecipients.length) && !shouldSendLive,
  };
};
