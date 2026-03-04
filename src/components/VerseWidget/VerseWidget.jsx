import React from "react";
import "./VerseWidget.css";

const VerseWidget = ({ label = "Verse of the day", textLabel, referenceLabel }) => (
  <article className="dashboard-verse">
    <span className="dashboard-verse__label">{label}</span>
    <p className="dashboard-verse__text">{textLabel}</p>
    <p className="dashboard-verse__reference">{referenceLabel}</p>
  </article>
);

export default VerseWidget;
