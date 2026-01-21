import React from "react";

const ThemeToggle = ({ theme, onToggle }) => {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  const nextLabel = resolvedTheme === "dark" ? "Light" : "Dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${nextLabel.toLowerCase()} mode`}
    >
      <span className="theme-toggle__label">Theme</span>
      <span className="theme-toggle__value">
        {resolvedTheme === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
};

export default ThemeToggle;
