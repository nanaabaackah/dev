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
import {
  Category,
  WalletMoney,
  CalendarTick,
  TaskSquare,
  Buildings2,
  Box,
  Monitor,
  DocumentText,
  ClipboardTick,
  Profile2User,
  Setting2,
} from "iconsax-react";
import { FiActivity } from "react-icons/fi";
import { RiLogoutCircleRLine } from "react-icons/ri";
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
import Productivity from "./components/Productivity";
import useScrollAnimations from "./hooks/useScrollAnimations";
import { buildApiUrl } from "./api-url";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: Category },
  { to: "/productivity", label: "Productivity", Icon: TaskSquare },
  { to: "/accounting", label: "Accounting", Icon: WalletMoney },
  { to: "/bookings", label: "Bookings", Icon: CalendarTick },
  { to: "/organizations", label: "Organizations", Icon: Buildings2 },
  { to: "/inventory", label: "Inventory", Icon: Box },
  { to: "/system-health", label: "System Health", Icon: Monitor },
  { to: "/reports", label: "Reports", Icon: DocumentText },
  { to: "/audit-logs", label: "Audit Logs", Icon: ClipboardTick },
  { to: "/users", label: "Users", Icon: Profile2User },
  { to: "/settings", label: "Settings", Icon: Setting2 },
];

const MOBILE_TAB_ITEMS = [
  { to: "/dashboard", label: "Home", Icon: Category },
  { to: "/productivity", label: "Focus", Icon: TaskSquare },
  { to: "/accounting", label: "Finance", Icon: WalletMoney },
  { to: "/bookings", label: "Bookings", Icon: CalendarTick },
  { to: "/settings", label: "Settings", Icon: Setting2 },
];

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  return token && user ? children : <Navigate to="/login" />;
};

const getInitialTheme = () => {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
};

const getTopbarLabel = (pathname) => {
  if (pathname.startsWith("/book")) return "Booking";
  switch (pathname) {
    case "/dashboard":
      return "Dashboard";
    case "/accounting":
      return "Accounting";
    case "/productivity":
      return "Productivity";
    case "/bookings":
      return "Bookings";
    case "/organizations":
      return "Organizations";
    case "/users":
      return "Users";
    case "/inventory":
      return "Inventory";
    case "/system-health":
      return "System Health";
    case "/reports":
      return "Reports";
    case "/audit-logs":
      return "Audit Logs";
    case "/settings":
      return "Settings";
    default:
      return "Workspace";
  }
};

const AppShell = ({ children, theme, onToggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("nav-open", isNavOpen);
    return () => document.body.classList.remove("nav-open");
  }, [isNavOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
      });
    } catch {
      // local cleanup still happens even if network logout fails
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className={`erp-shell ${isOffline ? "is-offline" : ""}`}>
      <aside className={`erp-sidebar ${isNavOpen ? "is-open" : ""}`} id="erp-sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <FiActivity aria-hidden="true" />
            <span>Dev KPI</span>
          </div>
          <button
            className="nav-close"
            type="button"
            onClick={() => setIsNavOpen(false)}
            aria-label="Close navigation"
          >
            Close
          </button>
        </div>
        <nav className="erp-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {React.createElement(item.Icon, {
                size: 16,
                variant: "Linear",
                className: "nav-icon",
              })}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <button
        className={`nav-scrim ${isNavOpen ? "is-open" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setIsNavOpen(false)}
      />
      <div className="erp-main">
        <header className="erp-topbar">
          <div className="topbar-title">
            <button
              className="nav-toggle"
              type="button"
              aria-label="Open navigation"
              aria-controls="erp-sidebar"
              aria-expanded={isNavOpen}
              onClick={() => setIsNavOpen(true)}
            >
              Menu
            </button>
            <span>{getTopbarLabel(location.pathname)}</span>
          </div>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button className="button button-ghost" type="button" onClick={handleSignOut}>
              <RiLogoutCircleRLine aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </header>
        {isOffline ? (
          <div className="offline-banner" role="status" aria-live="polite">
            Offline mode. Showing cached content where available.
          </div>
        ) : null}
        <main className="erp-content">{children}</main>
      </div>
      <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
        {MOBILE_TAB_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {React.createElement(item.Icon, {
              size: 18,
              variant: "Linear",
              className: "mobile-tabbar__icon",
            })}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
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
    case "/productivity":
      return "Productivity | Dev";
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

const ScrollAnimationManager = () => {
  const location = useLocation();

  useScrollAnimations(location.pathname);

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
      <ScrollAnimationManager />
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
          path="/productivity"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Productivity />
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
