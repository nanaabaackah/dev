import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const hasActiveSession = () => {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("token") && localStorage.getItem("user"));
};

const ErrorPage = ({ code, title, message }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isNotFound = code === "404";
  const requestPath = location.pathname !== "/error" ? location.pathname : "";
  const primaryHref = hasActiveSession() ? "/dashboard" : "/login";
  const primaryLabel = hasActiveSession() ? "Go to dashboard" : "Go to login";

  return (
    <section className="error-page">
      <div className="error-page__card">
        <p className="error-page__code">{code}</p>
        <h1>{title}</h1>
        <p className="error-page__message">{message}</p>
        {isNotFound && requestPath ? (
          <p className="error-page__path">
            Requested path: <span>{requestPath}</span>
          </p>
        ) : null}
        <div className="error-page__actions">
          <Link className="button button-primary" to={primaryHref}>
            {primaryLabel}
          </Link>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </div>
      </div>
    </section>
  );
};

ErrorPage.defaultProps = {
  code: "500",
  title: "Something went wrong.",
  message: "The page could not be loaded right now. Try again or head back to a safe route.",
};

export default ErrorPage;
