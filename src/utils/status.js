const STATUS_LABELS = {
  ok: "Healthy",
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  error: "Error",
  unknown: "Unknown",
  not_configured: "Not configured",
};

const STATUS_TONES = {
  ok: "success",
  online: "success",
  degraded: "warning",
  offline: "danger",
  error: "danger",
  unknown: "info",
  not_configured: "info",
  active: "success",
  pending: "warning",
  suspended: "danger",
};

const formatStatusLabel = (status) => {
  if (!status) return "Unknown";
  const label = STATUS_LABELS[status] || status.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const getStatusTone = (status) => STATUS_TONES[status] || "info";

const isHealthyStatus = (status) => status === "ok" || status === "online";

export { formatStatusLabel, getStatusTone, isHealthyStatus };
