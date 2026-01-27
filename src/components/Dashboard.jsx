import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useDashboardData from "../hooks/useDashboardData";
import { formatDateTime, formatPercent, formatRatio } from "../utils/formatters";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../utils/status";
import { buildApiUrl } from "../api-url";
import "./Dashboard.css";

const RANGE_OPTIONS = [
  { value: "24h", label: "24H", description: "Last 24 hours", hours: 24 },
  { value: "7d", label: "7D", description: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "30D", description: "Last 30 days", hours: 24 * 30 },
];

const SLOT_DURATION_MIN = 60;
const TIME_SLOTS = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "11:00 AM", hour: 11, minute: 0 },
  { label: "1:00 PM", hour: 13, minute: 0 },
  { label: "3:00 PM", hour: 15, minute: 0 },
  { label: "5:00 PM", hour: 17, minute: 0 },
];

const STATUS_LABELS = {
  available: "Open",
  booked: "Booked",
  blocked: "Blocked",
};

const BOOKING_STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "TENTATIVE", label: "Tentative" },
  { value: "CANCELED", label: "Canceled" },
];

const DEFAULT_SLOT_FORM = {
  title: "",
  attendeeName: "",
  attendeeEmail: "",
  location: "",
  status: "TENTATIVE",
  description: "",
};

const buildWeekDays = () => {
  const start = new Date();
  const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    date.setHours(0, 0, 0, 0);

    return {
      key: toDateKey(date),
      label: dayFormatter.format(date),
      dateLabel: dateFormatter.format(date),
      date,
    };
  });
};

const buildSlotRange = (dayDate, slot) => {
  const start = new Date(dayDate);
  start.setHours(slot.hour, slot.minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + SLOT_DURATION_MIN);
  return { start, end };
};

const hasOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

const formatHolidayLabel = (holiday) => `${holiday.region}: ${holiday.label}`;

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getNthWeekday = (year, monthIndex, weekday, occurrence) => {
  const date = new Date(year, monthIndex, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(1 + offset + 7 * (occurrence - 1));
  return date;
};

const getLastWeekdayBefore = (year, monthIndex, dayOfMonth, weekday) => {
  const date = new Date(year, monthIndex, dayOfMonth);
  const offset = (date.getDay() - weekday + 7) % 7;
  date.setDate(dayOfMonth - offset);
  return date;
};

const buildHolidayList = (year) => {
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const holidays = [
    { date: new Date(year, 0, 1), label: "New Year's Day", region: "CA" },
    { date: goodFriday, label: "Good Friday", region: "CA" },
    {
      date: getLastWeekdayBefore(year, 4, 25, 1),
      label: "Victoria Day",
      region: "CA",
    },
    { date: new Date(year, 6, 1), label: "Canada Day", region: "CA" },
    { date: getNthWeekday(year, 8, 1, 1), label: "Labour Day", region: "CA" },
    { date: getNthWeekday(year, 9, 1, 2), label: "Thanksgiving", region: "CA" },
    { date: new Date(year, 11, 25), label: "Christmas Day", region: "CA" },
    { date: new Date(year, 11, 26), label: "Boxing Day", region: "CA" },
    { date: new Date(year, 0, 1), label: "New Year's Day", region: "GH" },
    { date: new Date(year, 2, 6), label: "Independence Day", region: "GH" },
    { date: goodFriday, label: "Good Friday", region: "GH" },
    { date: easterMonday, label: "Easter Monday", region: "GH" },
    { date: new Date(year, 4, 1), label: "May Day", region: "GH" },
    { date: new Date(year, 8, 21), label: "Founders' Day", region: "GH" },
    {
      date: getNthWeekday(year, 11, 5, 1),
      label: "Farmers' Day",
      region: "GH",
    },
    { date: new Date(year, 11, 25), label: "Christmas Day", region: "GH" },
    { date: new Date(year, 11, 26), label: "Boxing Day", region: "GH" },
  ];

  return holidays;
};

const buildHolidayMap = (days) => {
  const years = Array.from(new Set(days.map((day) => day.date.getFullYear())));
  const holidayMap = new Map();

  years.forEach((year) => {
    buildHolidayList(year).forEach((holiday) => {
      const key = toDateKey(holiday.date);
      const list = holidayMap.get(key) || [];
      list.push(formatHolidayLabel(holiday));
      holidayMap.set(key, list);
    });
  });

  return holidayMap;
};

const buildAvailabilityMatrix = (days, bookings, holidayMap) => {
  const now = new Date();
  const activeBookings = bookings.filter((booking) => booking.status !== "CANCELED");
  const bookingRanges = activeBookings.map((booking) => ({
    start: new Date(booking.startAt),
    end: new Date(booking.endAt),
  }));

  return days.map((day) => {
    const isHoliday = holidayMap.has(day.key);
    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

    return TIME_SLOTS.map((slot) => {
      const { start, end } = buildSlotRange(day.date, slot);
      if (isHoliday || end <= now) {
        return "blocked";
      }
      if (isWeekend || end <= now) {
        return "blocked";
      }
      const booked = bookingRanges.some((range) => hasOverlap(start, end, range.start, range.end));
      return booked ? "booked" : "available";
    });
    
  });
};

const Dashboard = () => {
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [timeRange, setTimeRange] = useState("7d");
  const [availabilityBookings, setAvailabilityBookings] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [slotModal, setSlotModal] = useState(null);
  const [slotForm, setSlotForm] = useState(DEFAULT_SLOT_FORM);
  const [slotStatus, setSlotStatus] = useState({ tone: "", message: "" });
  const [isSlotSaving, setIsSlotSaving] = useState(false);
  const [expandedSites, setExpandedSites] = useState({});

  const days = useMemo(() => buildWeekDays(), []);
  const holidayMap = useMemo(() => buildHolidayMap(days), [days]);

  const availabilityMatrix = useMemo(
    () => buildAvailabilityMatrix(days, availabilityBookings, holidayMap),
    [days, availabilityBookings, holidayMap]
  );

  const availabilityTotals = useMemo(() => {
    const totals = { available: 0, booked: 0, blocked: 0 };
    availabilityMatrix.forEach((daySlots) => {
      daySlots.forEach((status) => {
        totals[status] += 1;
      });
    });
    return totals;
  }, [availabilityMatrix]);

  const nextAvailable = useMemo(() => {
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < TIME_SLOTS.length; slotIndex += 1) {
        const daySlots = availabilityMatrix[dayIndex] || [];
        if (daySlots[slotIndex] === "available") {
          return {
            day: days[dayIndex],
            time: TIME_SLOTS[slotIndex].label,
          };
        }
      }
    }
    return null;
  }, [availabilityMatrix, days]);

  const totalSlots = TIME_SLOTS.length * days.length;
  const availableSlots = availabilityTotals.available;

  const findSlotBooking = useCallback(
    (day, slot) => {
      const { start, end } = buildSlotRange(day.date, slot);
      return availabilityBookings.find((booking) => {
        const bookingStart = new Date(booking.startAt);
        const bookingEnd = new Date(booking.endAt);
        return hasOverlap(start, end, bookingStart, bookingEnd);
      });
    },
    [availabilityBookings]
  );

  const openSlotModal = (day, slot, status) => {
    const existing = findSlotBooking(day, slot) || null;
    const { start, end } = buildSlotRange(day.date, slot);
    const startAt = existing ? new Date(existing.startAt) : start;
    const endAt = existing ? new Date(existing.endAt) : end;
    setSlotModal({ day, slot, status, booking: existing, startAt, endAt });
    setSlotForm({
      title: existing?.title ?? "",
      attendeeName: existing?.attendeeName ?? "",
      attendeeEmail: existing?.attendeeEmail ?? "",
      location: existing?.location ?? "",
      status: existing?.status ?? "CONFIRMED",
      description: existing?.description ?? "",
    });
    setSlotStatus({ tone: "", message: "" });
  };

  const closeSlotModal = () => {
    setSlotModal(null);
    setSlotForm(DEFAULT_SLOT_FORM);
    setSlotStatus({ tone: "", message: "" });
    setIsSlotSaving(false);
  };

  const handleSlotSave = async () => {
    if (!slotModal) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setSlotStatus({ tone: "error", message: "Missing session. Please sign in again." });
      return;
    }

    const title = slotForm.title.trim();
    if (!title) {
      setSlotStatus({ tone: "error", message: "Title is required." });
      return;
    }

    const payload = {
      title,
      attendeeName: slotForm.attendeeName.trim() || null,
      attendeeEmail: slotForm.attendeeEmail.trim() || null,
      location: slotForm.location.trim() || null,
      status: slotForm.status,
      description: slotForm.description.trim() || null,
      startAt: slotModal.startAt.toISOString(),
      endAt: slotModal.endAt.toISOString(),
    };

    setIsSlotSaving(true);
    setSlotStatus({ tone: "", message: "" });

    try {
      const isEditing = Boolean(slotModal.booking?.id);
      const endpoint = isEditing ? `/api/bookings/${slotModal.booking.id}` : "/api/bookings";
      const response = await fetch(buildApiUrl(endpoint), {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to save booking.");
      }
      setSlotStatus({ tone: "success", message: "Booking saved." });
      await loadAvailability();
      closeSlotModal();
    } catch (saveError) {
      setSlotStatus({ tone: "error", message: saveError.message });
    } finally {
      setIsSlotSaving(false);
    }
  };

  const loadAvailability = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAvailabilityLoading(false);
      setAvailabilityError("Missing session. Please sign in again.");
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23, 59, 59, 999);

      const query = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetch(buildApiUrl(`/api/bookings?${query.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load availability");
      }
      setAvailabilityBookings(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setAvailabilityError(err.message);
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const handleRefresh = () => {
    if (!isRefreshing) {
      reload({ silent: true });
    }
    loadAvailability();
  };

  const toggleSiteExpansion = (siteId) => {
    setExpandedSites((prev) => ({ ...prev, [siteId]: !prev[siteId] }));
  };

  const activeRange = RANGE_OPTIONS.find((option) => option.value === timeRange) || RANGE_OPTIONS[1];
  const rangeDescription = activeRange.description;
  const rangeWindowMs = activeRange.hours * 60 * 60 * 1000;

  const renderStatusPill = (status) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{formatStatusLabel(status)}</span>;
  };

  const renderStatusCount = (status, count) => {
    const tone = getStatusTone(status);
    return <span className={`status-pill is-${tone}`}>{count}</span>;
  };

  const getAggregateStatus = (pages = []) => {
    if (!pages.length) return "unknown";
    if (pages.some((page) => page.status === "offline")) return "offline";
    if (pages.some((page) => page.status === "degraded")) return "degraded";
    if (pages.every((page) => page.status === "online")) return "online";
    return "unknown";
  };

  const roleBreakdown = kpiData?.roleBreakdown ?? [];
  const userStatusBreakdown = kpiData?.userStatusBreakdown ?? [];
  const organizationStatusBreakdown = kpiData?.organizationStatusBreakdown ?? [];
  const insights = kpiData?.insights ?? {};

  const siteStatuses = kpiData?.siteStatus?.sites ?? [];
  const systemStatus = kpiData?.status ?? {};
  const lastSyncedLabel = kpiData?.lastSyncedAt ? formatDateTime(kpiData.lastSyncedAt) : "N/A";
  const lastCheckedLabel = kpiData?.siteStatus?.checkedAt
    ? formatDateTime(kpiData.siteStatus.checkedAt)
    : "N/A";

  const systemEntries = [
    { id: "api", label: "API", status: systemStatus.api, note: "Auth + metrics" },
    {
      id: "portfolio",
      label: "Portfolio DB",
      status: systemStatus.portfolioDb,
      note: "Primary org data",
    },
    {
      id: "reebs",
      label: "Reebs DB",
      status: systemStatus.reebsDb,
      note: "Products and inventory",
    },
    {
      id: "faako",
      label: "Faako DB",
      status: systemStatus.faakoDb,
      note: "ERP users",
    },
  ];

  const siteOverview = siteStatuses.map((site) => {
    const pages = site.pages ?? [];
    return {
      id: site.id,
      title: site.title,
      pages,
      aggregateStatus: getAggregateStatus(pages),
    };
  });
  const orderedSites = [...siteOverview].sort((left, right) => {
    if (left.id === "reebs-portal") return 1;
    if (right.id === "reebs-portal") return -1;
    return 0;
  });

  const sitePages = siteOverview.flatMap((site) => site.pages);
  const totalServices = systemEntries.filter((entry) => entry.status).length;
  const healthyServices = systemEntries.filter(
    (entry) => entry.status && isHealthyStatus(entry.status)
  ).length;
  const totalSites = siteOverview.length;
  const onlineSites = siteOverview.filter((site) => site.aggregateStatus === "online").length;
  const totalPages = sitePages.length;
  const onlinePages = sitePages.filter((page) => page.status === "online").length;
  const serviceHealthPercent = formatPercent(healthyServices, totalServices);
  const siteHealthPercent = formatPercent(onlineSites, totalSites);
  const pageHealthPercent = formatPercent(onlinePages, totalPages);

  const attentionItems = [
    ...systemEntries
      .filter((entry) => entry.status && !isHealthyStatus(entry.status))
      .map((entry) => ({
        id: `system-${entry.id}`,
        label: entry.label,
        status: entry.status,
        note: entry.note,
      })),
    ...siteOverview
      .filter((site) => site.aggregateStatus === "offline" || site.aggregateStatus === "degraded")
      .map((site) => ({
        id: `site-${site.id}`,
        label: site.title,
        status: site.aggregateStatus,
        note: `${site.pages.length} pages tracked`,
      })),
  ];

  const baseTimelineEvents = [
    kpiData?.lastSyncedAt
      ? {
          id: "sync",
          timestamp: kpiData.lastSyncedAt,
          title: "KPI ingestion completed",
          detail: `Orgs ${kpiData.totalOrganizations ?? 0} | Users ${
            kpiData.totalUsers ?? 0
          } | Inventory ${kpiData.totalInventoryItems ?? 0}`,
          badge: "Sync",
          priority: "normal",
        }
      : null,
    kpiData?.siteStatus?.checkedAt
      ? {
          id: "site-check",
          timestamp: kpiData.siteStatus.checkedAt,
          title: "Website health check",
          detail: `${onlineSites}/${totalSites} sites online | ${onlinePages}/${totalPages} pages online`,
          badge: attentionItems.length ? "Alert" : "Check",
          priority: attentionItems.length ? "urgent" : "normal",
        }
      : null,
  ].filter(Boolean);

  const timelineEvents = baseTimelineEvents
    .filter((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      if (Number.isNaN(eventTime)) return false;
      return Date.now() - eventTime <= rangeWindowMs;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const isExternalBooking = slotModal?.booking?.source
    ? slotModal.booking.source !== "MANUAL"
    : false;
  const isSlotBlocked = Boolean(slotModal && slotModal.status === "blocked" && !slotModal.booking);
  const slotTitle = slotModal?.booking ? "Edit booking" : "Add booking";
  const slotDateLabel = slotModal
    ? `${slotModal.day.dateLabel} • ${slotModal.slot.label}`
    : "";

  return (
    <section className="page dashboard">
      <div className="panel dashboard-hero availability-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>ERP KPI Command Center</h1>
          <p className="muted">
            Window {rangeDescription} | Last synced {lastSyncedLabel} | Sites tracked{" "}
            {siteStatuses.length} | Last check {lastCheckedLabel} | Availability {availableSlots}/
            {totalSlots}
          </p>
        </div>
        <div className="hero-actions">
          <div className="segmented" role="tablist" aria-label="Time range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`segment ${option.value === timeRange ? "is-active" : ""}`}
                type="button"
                aria-pressed={option.value === timeRange}
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            className="button button-primary"
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? "Refreshing..." : "Refresh metrics"}
          </button>
          <Link className="button button-ghost" to="/bookings">
            Bookings
          </Link>
          <a className="button button-ghost" href="#site-status">
            Site status
          </a>
        </div>
      </div>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading dashboard data...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="panel availability-panel" id="availability">
        <div className="panel-header">
          <div>
            <h3>Weekly availability</h3>
            <p className="muted">Showing the next 7 days across your core meeting hours.</p>
          </div>
          <div className="availability-legend">
            <span className="legend-item">
              <span className="legend-dot is-available" />
              Available
            </span>
            <span className="legend-item">
              <span className="legend-dot is-booked" />
              Booked
            </span>
            <span className="legend-item">
              <span className="legend-dot is-blocked" />
              Blocked
            </span>
          </div>
        </div>

        {availabilityError ? (
          <div className="notice is-error" role="alert">
            {availabilityError}
          </div>
        ) : null}

        {availabilityLoading ? (
          <div className="loading-card" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Loading availability...</span>
          </div>
        ) : null}

        {nextAvailable ? (
          <div className="availability-callout">
            <span className="table-strong">Next available:</span>
            <span>
              {nextAvailable.day.dateLabel} • {nextAvailable.time}
            </span>
          </div>
        ) : (
          <div className="availability-callout muted">No available slots in this window.</div>
        )}

        <div className="availability-scroll">
          <div className="availability-grid" role="grid">
            <div className="availability-cell availability-corner" aria-hidden="true" />
            {days.map((day) => {
              const holidayLabels = holidayMap.get(day.key) || [];
              return (
                <div className="availability-cell availability-day" role="columnheader" key={day.key}>
                  <span className="availability-day__label">{day.label}</span>
                  <span className="availability-day__date">{day.dateLabel}</span>
                  {holidayLabels.length ? (
                    <div className="availability-day__holidays">
                      {holidayLabels.map((label) => (
                        <span className="availability-holiday" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {TIME_SLOTS.map((slot, slotIndex) => (
              <React.Fragment key={slot.label}>
                <div className="availability-cell availability-time" role="rowheader">
                  {slot.label}
                </div>
                {days.map((day, dayIndex) => {
                  const daySlots = availabilityMatrix[dayIndex] || [];
                  const status = daySlots[slotIndex] || "blocked";
                  const slotBooking = findSlotBooking(day, slot);
                  const isBlocked = status === "blocked" && !slotBooking;
                  const label = `${day.label} ${day.dateLabel} at ${slot.label} - ${STATUS_LABELS[status]}`;
                  return (
                    <button
                      className={`availability-cell availability-slot availability-slot-button is-${status}`}
                      type="button"
                      role="gridcell"
                      key={`${day.key}-${slot.label}`}
                      onClick={() => openSlotModal(day, slot, status)}
                      aria-label={label}
                      disabled={isBlocked}
                    >
                      <span>{STATUS_LABELS[status]}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {slotModal ? (
        <div className="slot-modal" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
          <div className="slot-modal__card">
            <div className="slot-modal__header">
              <div>
                <p className="eyebrow">Booking</p>
                <h3 id="slot-modal-title">{slotTitle}</h3>
                <p className="muted">{slotDateLabel}</p>
              </div>
              <button className="button button-ghost" type="button" onClick={closeSlotModal}>
                Close
              </button>
            </div>

            <div className="slot-meta">
              <div>
                <span className="kpi-label">Starts</span>
                <div>{formatDateTime(slotModal.startAt)}</div>
              </div>
              <div>
                <span className="kpi-label">Ends</span>
                <div>{formatDateTime(slotModal.endAt)}</div>
              </div>
            </div>

            {slotStatus.message ? (
              <div className={`notice ${slotStatus.tone ? `is-${slotStatus.tone}` : ""}`.trim()}>
                {slotStatus.message}
              </div>
            ) : null}

            {isExternalBooking ? (
              <div className="notice">
                This booking is synced from Google Calendar and can only be edited there.
              </div>
            ) : null}

            {isSlotBlocked ? (
              <div className="notice">
                This slot is blocked due to a holiday or being in the past.
              </div>
            ) : null}

            <form
              className="slot-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSlotSave();
              }}
            >
              <label className="form-field">
                <span>Title</span>
                <input
                  className="input"
                  type="text"
                  value={slotForm.title}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Customer booking"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Attendee name</span>
                <input
                  className="input"
                  type="text"
                  value={slotForm.attendeeName}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, attendeeName: event.target.value }))
                  }
                  placeholder="Full name"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Attendee email</span>
                <input
                  className="input"
                  type="email"
                  value={slotForm.attendeeEmail}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, attendeeEmail: event.target.value }))
                  }
                  placeholder="name@email.com"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Location</span>
                <input
                  className="input"
                  type="text"
                  value={slotForm.location}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Zoom, phone, or office"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <label className="form-field">
                <span>Status</span>
                <select
                  className="input"
                  value={slotForm.status}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                >
                  {BOOKING_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Notes</span>
                <textarea
                  className="input"
                  value={slotForm.description}
                  onChange={(event) =>
                    setSlotForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Add any notes for this booking"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                />
              </label>
              <div className="slot-form__actions">
                <button className="button button-ghost" type="button" onClick={closeSlotModal}>
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isExternalBooking || isSlotBlocked || isSlotSaving}
                >
                  {isSlotSaving ? "Saving..." : "Save booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {kpiData ? (
        <>
          <p className="muted">KPI window: {rangeDescription}.</p>
          <div className="kpi-grid">
            {[
              {
                id: "orgs",
                label: "Organizations",
                value: kpiData.totalOrganizations,
                delta: `Portfolio ${kpiData.portfolio?.organizations ?? 0} | Reebs ${
                  kpiData.reebs?.organizations ?? 0
                } | Faako ${kpiData.faako?.organizations ?? 0}`,
              },
              {
                id: "users",
                label: "Users",
                value: kpiData.totalUsers,
                delta: `Portfolio ${kpiData.portfolio?.users ?? 0} | Reebs ${
                  kpiData.reebs?.users ?? 0
                } | Faako ${kpiData.faako?.users ?? 0}`,
              },
              {
                id: "inventory",
                label: "Inventory items",
                value: kpiData.totalInventoryItems,
                delta: "Reebs inventory tracked",
                tone: "warning",
              },
            ].map((card) => (
              <article className="panel kpi-card" key={card.id}>
                <span className="kpi-label">{card.label}</span>
                <div className="kpi-value">{card.value ?? "N/A"}</div>
                <span className={`kpi-delta ${card.tone ? `is-${card.tone}` : ""}`.trim()}>
                  {card.delta}
                </span>
              </article>
            ))}
          </div>

          <div className="panel-grid">
            {[
              {
                id: "avg-users",
                label: "Avg users per org",
                value: insights.averageUsersPerOrg ?? "N/A",
                hint: "Portfolio data",
              },
              {
                id: "inventory-per-user",
                label: "Inventory per Reebs user",
                value: insights.inventoryPerReebsUser ?? "N/A",
                hint: "Reebs ops signal",
              },
            ].map((insight) => (
              <article className="panel metric-card" key={insight.id}>
                <span className="kpi-label">{insight.label}</span>
                <div className="kpi-value">{insight.value}</div>
                <span className="muted">{insight.hint}</span>
              </article>
            ))}
          </div>

          <div className="dashboard-grid">
            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Data sources</h3>
                  <p className="muted">Portfolio, Reebs, and Faako totals.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-4">
                  <span>Source</span>
                  <span>Orgs</span>
                  <span>Users</span>
                  <span>Inventory</span>
                </div>
                {[
                  {
                    id: "portfolio",
                    label: "Portfolio",
                    orgs: kpiData.portfolio?.organizations ?? 0,
                    users: kpiData.portfolio?.users ?? 0,
                    inventory: "N/A",
                  },
                  {
                    id: "reebs",
                    label: "Reebs",
                    orgs: kpiData.reebs?.organizations ?? 0,
                    users: kpiData.reebs?.users ?? 0,
                    inventory: kpiData.reebs?.inventoryItems ?? 0,
                  },
                  {
                    id: "faako",
                    label: "Faako",
                    orgs: kpiData.faako?.organizations ?? 0,
                    users: kpiData.faako?.users ?? 0,
                    inventory: "N/A",
                  },
                ].map((row) => (
                  <div className="table-row is-4" key={row.id}>
                    <span className="table-strong">{row.label}</span>
                    <span>{row.orgs}</span>
                    <span>{row.users}</span>
                    <span>{row.inventory}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>System status</h3>
                  <p className="muted">API and database checks.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-3">
                  <span>Service</span>
                  <span>Status</span>
                  <span>Notes</span>
                </div>
                {systemEntries.map((row) => (
                  <div className="table-row is-3" key={row.id}>
                    <span className="table-strong">{row.label}</span>
                    {renderStatusPill(row.status)}
                    <span className="muted">{row.note}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Operational snapshot</h3>
                  <p className="muted">Services, sites, and page uptime.</p>
                </div>
              </div>
              <div className="stack">
                <div className="health-row">
                  <div className="health-row__header">
                    <span className="table-strong">Services healthy</span>
                    <span>{formatRatio(healthyServices, totalServices)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${serviceHealthPercent}%` }} />
                  </div>
                </div>
                <div className="health-row">
                  <div className="health-row__header">
                    <span className="table-strong">Sites online</span>
                    <span>{formatRatio(onlineSites, totalSites)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${siteHealthPercent}%` }} />
                  </div>
                </div>
                <div className="health-row">
                  <div className="health-row__header">
                    <span className="table-strong">Pages online</span>
                    <span>{formatRatio(onlinePages, totalPages)}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${pageHealthPercent}%` }} />
                  </div>
                </div>
              </div>
            </article>

            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Attention required</h3>
                  <p className="muted">Items needing a quick check.</p>
                </div>
              </div>
              <div className="list">
                {attentionItems.length ? (
                  attentionItems.map((item) => (
                    <div className="list-row is-split" key={item.id}>
                      <div>
                        <span className="table-strong">{item.label}</span>
                        <span className="muted">{item.note}</span>
                      </div>
                      {renderStatusPill(item.status)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No alerts right now.</p>
                )}
              </div>
            </article>

            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Activity timeline</h3>
                  <p className="muted">Sync and status checks in the {rangeDescription} window.</p>
                </div>
              </div>
              <div className="timeline">
                {timelineEvents.length ? (
                  timelineEvents.map((event) => (
                    <div className="timeline-row" key={event.id}>
                      <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
                      <div>
                        <span className="table-strong">{event.title}</span>
                        <p className="muted">{event.detail}</p>
                      </div>
                      <span className={`priority is-${event.priority}`}>{event.badge}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No activity logged in this window.</p>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Role distribution</h3>
                  <p className="muted">Portfolio org users.</p>
                </div>
              </div>
              <div className="list">
                {roleBreakdown.length ? (
                  roleBreakdown.map((role) => (
                    <div className="list-row is-split" key={role.name}>
                      <span className="table-strong">{role.name}</span>
                      <span>{role.users ?? 0}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No roles yet.</p>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>User statuses</h3>
                  <p className="muted">Active, pending, suspended.</p>
                </div>
              </div>
              <div className="list">
                {userStatusBreakdown.length ? (
                  userStatusBreakdown.map((item) => (
                    <div className="list-row is-split" key={item.status}>
                      <span className="table-strong">{formatStatusLabel(item.status)}</span>
                      {renderStatusCount(item.status, item.count)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No user statuses yet.</p>
                )}
              </div>
            </article>

            <article className="panel panel-span-2">
              <div className="panel-header">
                <div>
                  <h3>Organization statuses</h3>
                  <p className="muted">All orgs tracked.</p>
                </div>
              </div>
              <div className="list">
                {organizationStatusBreakdown.length ? (
                  organizationStatusBreakdown.map((item) => (
                    <div className="list-row is-split" key={item.status}>
                      <span className="table-strong">{formatStatusLabel(item.status)}</span>
                      {renderStatusCount(item.status, item.count)}
                    </div>
                  ))
                ) : (
                  <p className="muted">No org statuses yet.</p>
                )}
              </div>
            </article>
          </div>

          <section className="panel site-status" id="site-status">
            <div className="panel-header">
              <div>
                <h3>Website health</h3>
                <p className="muted">Window {rangeDescription} | Last refreshed {lastCheckedLabel}.</p>
              </div>
            </div>
            <div className="site-grid">
              {orderedSites.length ? (
                orderedSites.map((site) => {
                  const isExpanded = Boolean(expandedSites[site.id]);
                  const listId = `site-pages-${site.id}`;
                  return (
                    <article
                      key={site.id}
                      className={`site-card ${site.id === "reebs-portal" ? "is-portal" : ""}`.trim()}
                    >
                      <div className="site-card__header">
                        <div className="site-card__meta">
                          <span className="table-strong">{site.title}</span>
                          <span className="muted">{site.pages.length} pages tracked</span>
                        </div>
                        <div className="site-card__actions">
                          {renderStatusPill(site.aggregateStatus)}
                          <button
                            className="text-button site-card__toggle"
                            type="button"
                            onClick={() => toggleSiteExpansion(site.id)}
                            aria-expanded={isExpanded}
                            aria-controls={listId}
                          >
                            {isExpanded ? "Hide pages" : "View pages"}
                          </button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="site-card__list" id={listId}>
                          {site.pages.length ? (
                            site.pages.map((page) => (
                              <div className="site-card__row" key={page.url}>
                                <span>{page.label}</span>
                                {renderStatusPill(page.status)}
                              </div>
                            ))
                          ) : (
                            <p className="muted">No pages tracked.</p>
                          )}
                        </div>
                      ) : (
                        <div className="site-card__collapsed muted">Pages hidden</div>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="muted">No site checks yet.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
};

export default Dashboard;
