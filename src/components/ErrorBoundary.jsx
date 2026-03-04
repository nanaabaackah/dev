import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
    };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Route render failed", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleRetry() {
    this.setState({ hasError: false });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const hasActiveSession =
      typeof window !== "undefined" &&
      Boolean(localStorage.getItem("token") && localStorage.getItem("user"));
    const primaryHref = hasActiveSession ? "/dashboard" : "/login";
    const primaryLabel = hasActiveSession ? "Go to dashboard" : "Go to login";

    return (
      <section className="route-error-boundary" role="alert" aria-live="assertive">
        <div className="route-error-boundary__card">
          <p className="route-error-boundary__eyebrow">Render Error</p>
          <h1>Something on this page failed.</h1>
          <p className="route-error-boundary__message">
            A React render error stopped this screen. Retry the view or jump back to a safe route.
          </p>
          <div className="route-error-boundary__actions">
            <button className="button button-primary" type="button" onClick={this.handleRetry}>
              Try again
            </button>
            <a className="button button-ghost" href={primaryHref}>
              {primaryLabel}
            </a>
          </div>
        </div>
      </section>
    );
  }
}

ErrorBoundary.defaultProps = {
  children: null,
  resetKey: "",
};

export default ErrorBoundary;
