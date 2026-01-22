const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const formatRatio = (numerator, denominator) =>
  denominator ? `${numerator}/${denominator}` : "N/A";

const formatPercent = (numerator, denominator) =>
  denominator ? Math.round((numerator / denominator) * 100) : 0;

export { formatDateTime, formatRatio, formatPercent };
