import React from "react";
import "./WeatherWidget.css";

const WeatherWidget = ({ primaryLabel, secondaryLabel, feelsLikeLabel }) => (
  <article className="dashboard-brief-card weather-widget">
    <span className="kpi-label">Weather</span>
    <div className="kpi-value">{primaryLabel}</div>
    <span className="muted">{secondaryLabel}</span>
    <span className="kpi-delta">{feelsLikeLabel}</span>
  </article>
);

export default WeatherWidget;
