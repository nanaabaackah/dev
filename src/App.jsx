import React, { useEffect, useRef, useState } from "react";
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
  ReceiptItem,
  CalendarTick,
  TaskSquare,
  Buildings2,
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
import Profile from "./components/Profile";
import SystemHealth from "./components/SystemHealth";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import AuditLogs from "./components/AuditLogs";
import ThemeToggle from "./components/ThemeToggle";
import Accounting from "./components/Accounting";
import Invoicing from "./components/Invoicing";
import Productivity from "./components/Productivity";
import useScrollAnimations from "./hooks/useScrollAnimations";
import { buildApiUrl } from "./api-url";
import { readJsonResponse } from "./utils/http";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: Category },
  { to: "/productivity", label: "Productivity", Icon: TaskSquare },
  { to: "/accounting", label: "Accounting", Icon: WalletMoney },
  { to: "/invoicing", label: "Invoicing", Icon: ReceiptItem },
  { to: "/bookings", label: "Appointments", Icon: CalendarTick },
  { to: "/organizations", label: "Organizations", Icon: Buildings2 },
  { to: "/system-health", label: "System Health", Icon: Monitor },
  { to: "/reports", label: "Reports", Icon: DocumentText },
  { to: "/audit-logs", label: "Audit Logs", Icon: ClipboardTick },
  { to: "/profile", label: "Profile", Icon: Profile2User },
  { to: "/settings", label: "Settings", Icon: Setting2 },
];

const MOBILE_TAB_ITEMS = [
  { to: "/dashboard", label: "Home", Icon: Category },
  { to: "/productivity", label: "Focus", Icon: TaskSquare },
  { to: "/accounting", label: "Finance", Icon: WalletMoney },
  { to: "/bookings", label: "Appointments", Icon: CalendarTick },
  { to: "/settings", label: "Settings", Icon: Setting2 },
];

const isHealthyStatus = (status) => status === "ok" || status === "online";

const getSiteAggregateStatus = (pages = []) => {
  if (!Array.isArray(pages) || !pages.length) return "unknown";
  if (pages.some((page) => page?.status === "offline")) return "offline";
  if (pages.some((page) => page?.status === "degraded")) return "degraded";
  if (pages.every((page) => page?.status === "online")) return "online";
  return "unknown";
};

const getAlertNotificationCount = (dashboardPayload) => {
  const systemStatus = dashboardPayload?.status ?? {};
  const systemEntries = [systemStatus.api, systemStatus.portfolioDb, systemStatus.reebsDb, systemStatus.faakoDb];
  const systemAlerts = systemEntries.filter((status) => status && !isHealthyStatus(status)).length;

  const siteStatuses = Array.isArray(dashboardPayload?.siteStatus?.sites)
    ? dashboardPayload.siteStatus.sites
    : [];
  const siteAlerts = siteStatuses.filter((site) => {
    const aggregateStatus = getSiteAggregateStatus(site?.pages ?? []);
    return aggregateStatus === "offline" || aggregateStatus === "degraded";
  }).length;

  return systemAlerts + siteAlerts;
};

const getAppointmentsNotificationCount = (bookingsPayload) => {
  if (!Array.isArray(bookingsPayload)) return 0;
  return bookingsPayload.filter((booking) => String(booking?.status || "").toUpperCase() !== "CANCELED").length;
};

const getOverdueInvoicesCount = (invoicesPayload) => {
  if (Array.isArray(invoicesPayload?.invoices)) {
    return invoicesPayload.invoices.length;
  }
  return 0;
};

const getOverdueAccountingCount = (accountingPayload) => {
  const entries = Array.isArray(accountingPayload?.entries) ? accountingPayload.entries : [];
  return entries.filter((entry) => String(entry?.status || "").toUpperCase() === "OVERDUE").length;
};

const formatNotificationCount = (count) => (count > 99 ? "99+" : String(count));
const NAV_SWIPE_CLOSE_THRESHOLD = 72;
const NAV_SWIPE_VERTICAL_TOLERANCE = 72;
const NAV_SWIPE_MIN_HORIZONTAL_DELTA = 12;

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
  if (pathname.startsWith("/book")) return "Appointment";
  switch (pathname) {
    case "/dashboard":
      return "Dashboard";
    case "/accounting":
      return "Accounting";
    case "/productivity":
      return "Productivity";
    case "/bookings":
      return "Appointments";
    case "/invoicing":
      return "Invoicing";
    case "/organizations":
      return "Organizations";
    case "/profile":
      return "Profile";
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
  const [navSwipeOffset, setNavSwipeOffset] = useState(0);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const [navNotifications, setNavNotifications] = useState({});
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const navSwipeRef = useRef({
    active: false,
    horizontal: false,
    startX: 0,
    startY: 0,
  });

  const isMobileViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches;

  const resetNavSwipe = () => {
    navSwipeRef.current = {
      active: false,
      horizontal: false,
      startX: 0,
      startY: 0,
    };
    setIsNavDragging(false);
    setNavSwipeOffset(0);
  };

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("nav-open", isNavOpen);
    return () => document.body.classList.remove("nav-open");
  }, [isNavOpen]);

  useEffect(() => {
    if (isNavOpen) return;
    resetNavSwipe();
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

  useEffect(() => {
    if (isOffline) return undefined;

    let isCanceled = false;

    const loadNavNotifications = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!isCanceled) setNavNotifications({});
        return;
      }

      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      const query = new URLSearchParams({
        from: now.toISOString(),
        to: end.toISOString(),
      });
      const accountingQuery = new URLSearchParams({
        range: "all",
      });

      try {
        const [dashboardResponse, bookingsResponse, invoicesResponse, accountingResponse] =
          await Promise.all([
            fetch(buildApiUrl("/api/dashboard"), {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(buildApiUrl(`/api/bookings?${query.toString()}`), {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(buildApiUrl("/api/invoices?status=OVERDUE"), {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(buildApiUrl(`/api/accounting/entries?${accountingQuery.toString()}`), {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        const [dashboardPayload, bookingsPayload, invoicesPayload, accountingPayload] =
          await Promise.all([
            readJsonResponse(dashboardResponse),
            readJsonResponse(bookingsResponse),
            readJsonResponse(invoicesResponse),
            readJsonResponse(accountingResponse),
          ]);

        if (
          !dashboardResponse.ok ||
          !bookingsResponse.ok ||
          !invoicesResponse.ok ||
          !accountingResponse.ok
        ) {
          return;
        }

        if (!isCanceled) {
          setNavNotifications({
            "/bookings": getAppointmentsNotificationCount(bookingsPayload),
            "/system-health": getAlertNotificationCount(dashboardPayload),
            "/invoicing": getOverdueInvoicesCount(invoicesPayload),
            "/accounting": getOverdueAccountingCount(accountingPayload),
          });
        }
      } catch {
        if (!isCanceled) {
          setNavNotifications({});
        }
      }
    };

    loadNavNotifications();
    const intervalId = window.setInterval(loadNavNotifications, 60_000);

    return () => {
      isCanceled = true;
      window.clearInterval(intervalId);
    };
  }, [isOffline, location.pathname]);

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

  const handleSidebarTouchStart = (event) => {
    if (!isNavOpen || !isMobileViewport()) return;
    const touch = event.touches?.[0];
    if (!touch) return;

    navSwipeRef.current = {
      active: true,
      horizontal: false,
      startX: touch.clientX,
      startY: touch.clientY,
    };
    setIsNavDragging(false);
    setNavSwipeOffset(0);
  };

  const handleSidebarTouchMove = (event) => {
    if (!isNavOpen || !isMobileViewport()) return;
    const touch = event.touches?.[0];
    if (!touch || !navSwipeRef.current.active) return;

    const deltaX = touch.clientX - navSwipeRef.current.startX;
    const deltaY = touch.clientY - navSwipeRef.current.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!navSwipeRef.current.horizontal) {
      if (absY > NAV_SWIPE_VERTICAL_TOLERANCE && absY > absX) {
        resetNavSwipe();
        return;
      }

      if (absX < NAV_SWIPE_MIN_HORIZONTAL_DELTA || absX < absY) {
        return;
      }

      navSwipeRef.current.horizontal = true;
    }

    if (deltaX >= 0) {
      setNavSwipeOffset(0);
      return;
    }

    setIsNavDragging(true);
    setNavSwipeOffset(Math.max(deltaX, -320));
    event.preventDefault();
  };

  const handleSidebarTouchEnd = () => {
    if (!isNavOpen || !isMobileViewport()) return;
    const shouldClose = navSwipeOffset <= -NAV_SWIPE_CLOSE_THRESHOLD;
    resetNavSwipe();
    if (shouldClose) {
      setIsNavOpen(false);
    }
  };

  const sidebarClassName = [
    "erp-sidebar",
    isNavOpen ? "is-open" : "",
    isNavDragging ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const sidebarStyle =
    isNavOpen && navSwipeOffset !== 0 ? { transform: `translateX(${navSwipeOffset}px)` } : undefined;

  return (
    <div className={`erp-shell ${isOffline ? "is-offline" : ""}`}>
      <aside
        className={sidebarClassName}
        id="erp-sidebar"
        style={sidebarStyle}
        onTouchStart={handleSidebarTouchStart}
        onTouchMove={handleSidebarTouchMove}
        onTouchEnd={handleSidebarTouchEnd}
        onTouchCancel={handleSidebarTouchEnd}
      >
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
          {NAV_ITEMS.map((item) => {
            const count = Number(navNotifications[item.to] || 0);
            const hasNotification = count > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <span className="nav-link-main">
                  {React.createElement(item.Icon, {
                    size: 16,
                    variant: "Linear",
                    className: "nav-icon",
                  })}
                  <span>{item.label}</span>
                </span>
                {hasNotification ? (
                  <span className="nav-badge" aria-label={`${count} new ${item.label.toLowerCase()}`}>
                    {formatNotificationCount(count)}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
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
        {MOBILE_TAB_ITEMS.map((item) => {
          const count = Number(navNotifications[item.to] || 0);
          const hasNotification = count > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="mobile-tabbar__icon-wrap">
                {React.createElement(item.Icon, {
                  size: 18,
                  variant: "Linear",
                  className: "mobile-tabbar__icon",
                })}
                {hasNotification ? (
                  <span className="mobile-tabbar__badge" aria-hidden="true">
                    {formatNotificationCount(count)}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

const getTitleForPath = (pathname) => {
  if (pathname.startsWith("/book")) return "Appointment | Dev";
  switch (pathname) {
    case "/":
    case "/dashboard":
      return "Dashboard | Dev";
    case "/login":
      return "Login | Dev";
    case "/bookings":
      return "Appointments | Dev";
    case "/organizations":
      return "Organizations | Dev";
    case "/profile":
      return "Profile | Dev";
    case "/system-health":
      return "System Health | Dev";
    case "/reports":
      return "Reports | Dev";
    case "/accounting":
      return "Accounting | Dev";
    case "/invoicing":
      return "Invoicing | Dev";
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
          path="/profile"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Profile />
            </ShellPage>
          }
        />
        <Route path="/users" element={<Navigate to="/profile" replace />} />
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
          path="/invoicing"
          element={
            <ShellPage theme={theme} onToggleTheme={handleToggleTheme}>
              <Invoicing />
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
