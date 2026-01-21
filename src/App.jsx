import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ThemeToggle from "./components/ThemeToggle";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

const getInitialTheme = () => {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
};

const AppShell = ({ children, theme, onToggleTheme }) => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="erp-shell">
      <aside className="erp-sidebar">
        <div className="brand">Dev KPI</div>
        <nav className="erp-nav">
          <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
        </nav>
      </aside>
      <div className="erp-main">
        <header className="erp-topbar">
          <span>Workspace overview</span>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button className="button button-ghost" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="erp-content">{children}</main>
      </div>
    </div>
  );
};

function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login theme={theme} onToggleTheme={handleToggleTheme} />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <AppShell theme={theme} onToggleTheme={handleToggleTheme}>
                <Dashboard />
              </AppShell>
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
