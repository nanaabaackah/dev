import React from "react";
import "./KPICard.css";

const VARIANT_CLASS_NAMES = {
  brief: "dashboard-brief-card",
  panel: "panel kpi-card",
};

const hasContent = (value) => value !== undefined && value !== null && value !== "";

const KPICard = ({
  variant = "panel",
  className = "",
  label,
  value,
  valueClassName = "",
  meta,
  delta,
  tone = "",
}) => {
  const cardClassName = [VARIANT_CLASS_NAMES[variant] || "", className].filter(Boolean).join(" ");
  const valueClassNames = ["kpi-value", valueClassName].filter(Boolean).join(" ");
  const deltaClassName = ["kpi-delta", tone ? `is-${tone}` : ""].filter(Boolean).join(" ");

  return (
    <article className={cardClassName}>
      <span className="kpi-label">{label}</span>
      <div className={valueClassNames}>{value}</div>
      {hasContent(meta) ? <span className="muted">{meta}</span> : null}
      {hasContent(delta) ? <span className={deltaClassName}>{delta}</span> : null}
    </article>
  );
};

export default KPICard;
