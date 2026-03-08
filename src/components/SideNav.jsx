import { NavLink } from "react-router-dom";
import { FiActivity } from "react-icons/fi";

const SideNav = ({
  className,
  style,
  isOpen,
  visibleNavItems,
  navNotifications,
  formatNotificationCount,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
}) => {
  return (
    <>
      <aside
        className={className}
        id="erp-sidebar"
        style={style}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        <div className="sidebar-header">
          <div className="brand">
            <FiActivity aria-hidden="true" />
            <span>Dev KPI</span>
          </div>
          <button
            className="nav-close"
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
          >
            Close
          </button>
        </div>
        <nav className="erp-nav">
          {visibleNavItems.map((item) => {
            const Icon = item.Icon;
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
                  <Icon size={16} variant="Linear" className="nav-icon" />
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
        className={`nav-scrim ${isOpen ? "is-open" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
      />
    </>
  );
};

export default SideNav;
