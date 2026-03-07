const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";

export const resolveLocalEmailRecipient = (defaultAdminEmail) => {
  const normalized = String(defaultAdminEmail || "").trim();
  if (EMAIL_PATTERN.test(normalized)) {
    return normalized;
  }
  return LOCAL_EMAIL_FALLBACK;
};

export const resolveEmailDeliveryRecipients = ({
  recipients,
  parseRecipients,
  isProduction,
  defaultAdminEmail,
}) => {
  const intendedRecipients = parseRecipients(recipients);
  if (isProduction || !intendedRecipients.length) {
    return {
      intendedRecipients,
      deliveryRecipients: intendedRecipients,
      wasRerouted: false,
    };
  }

  const deliveryRecipient = resolveLocalEmailRecipient(defaultAdminEmail);
  const wasRerouted =
    intendedRecipients.length !== 1 ||
    intendedRecipients.some(
      (recipient) => recipient.toLowerCase() !== deliveryRecipient.toLowerCase()
    );

  return {
    intendedRecipients,
    deliveryRecipients: [deliveryRecipient],
    wasRerouted,
  };
};

export const resolveSingleEmailDeliveryTarget = ({
  recipient,
  isProduction,
  defaultAdminEmail,
}) => {
  const intendedRecipient = String(recipient || "").trim();
  if (isProduction) {
    return {
      intendedRecipient,
      deliveryRecipient: intendedRecipient,
      wasRerouted: false,
    };
  }

  const deliveryRecipient = resolveLocalEmailRecipient(defaultAdminEmail);
  return {
    intendedRecipient,
    deliveryRecipient,
    wasRerouted: deliveryRecipient.toLowerCase() !== intendedRecipient.toLowerCase(),
  };
};
