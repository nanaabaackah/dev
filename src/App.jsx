import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Bookings from "./components/Bookings";
import PublicBooking from "./components/PublicBooking";
import Organizations from "./components/Organizations";
import Users from "./components/Users";
import Inventory from "./components/Inventory";
import SystemHealth from "./components/SystemHealth";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import AuditLogs from "./components/AuditLogs";
import ThemeToggle from "./components/ThemeToggle";
import Accounting from "./components/Accounting";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
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
          <NavLink to="/bookings" className={({ isActive }) => (isActive ? "active" : "")}>
            Bookings
          </NavLink>
          <NavLink to="/organizations" className={({ isActive }) => (isActive ? "active" : "")}>
            Organizations
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
            Users
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => (isActive ? "active" : "")}>
            Inventory
          </NavLink>
          <NavLink to="/system-health" className={({ isActive }) => (isActive ? "active" : "")}>
            System Health
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/accounting" className={({ isActive }) => (isActive ? "active" : "")}>
            Accounting
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
          <NavLink to="/audit-logs" className={({ isActive }) => (isActive ? "active" : "")}>
            Audit Logs
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

const getTitleForPath = (pathname) => {
  if (pathname.startsWith("/book")) return "Booking | Dev";
  switch (pathname) {
    case "/":
    case "/dashboard":
      return "Dashboard | Dev";
    case "/login":
      return "Login | Dev";
    case "/bookings":
      return "Bookings | Dev";
    case "/organizations":
      return "Organizations | Dev";
    case "/users":
      return "Users | Dev";
    case "/inventory":
      return "Inventory | Dev";
    case "/system-health":
      return "System Health | Dev";
    case "/reports":
      return "Reports | Dev";
    case "/accounting":
      return "Accounting | Dev";
    case "/settings":
      return "Settings | Dev";
    case "/audit-logs":
      return "Audit Logs | Dev";
    default:
      return "Dev";
  }
};

const TitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getTitleForPath(location.pathname);
  }, [location.pathname]);

  return null;
};

const ShellPage = ({ children, theme, onToggleTheme }) => (
  <PrivateRoute>
    <AppShell theme={theme} onToggleTheme={onToggleTheme}>
      {children}
    </AppShell>
  </PrivateRoute>
);

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
      <TitleManager />
      <Routes>
        <Route path="/login" element={<Login theme={theme} onToggleTheme={handleToggleTheme} />} />
        <Route path="/book/:orgSlug?" element={<PublicBooking />} />
        <Route
          path="/dashboard"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Dashboard />
            </ShellPage>
          }
        />
        <Route
          path="/bookings"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Bookings />
            </ShellPage>
          }
        />
        <Route
          path="/organizations"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Organizations />
            </ShellPage>
          }
        />
        <Route
          path="/users"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Users />
            </ShellPage>
          }
        />
        <Route
          path="/inventory"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Inventory />
            </ShellPage>
          }
        />
        <Route
          path="/system-health"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <SystemHealth />
            </ShellPage>
          }
        />
        <Route
          path="/reports"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Reports />
            </ShellPage>
          }
        />
        <Route
          path="/accounting"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Accounting />
            </ShellPage>
          }
        />
        <Route
          path="/settings"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Settings />
            </ShellPage>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <AuditLogs />
            </ShellPage>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
