import React, { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "../../utils/formatters";
import { buildApiUrl } from "../../api-url";
import { getHolidayLabelsForDate, listUpcomingHolidays } from "../../utils/holidays";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import "./Bookings.css";

const STATUS_MAP = {
  CONFIRMED: { label: "Confirmed", tone: "success" },
  TENTATIVE: { label: "Tentative", tone: "warning" },
  CANCELED: { label: "Canceled", tone: "danger" },
};

const SOURCE_LABELS = {
  GOOGLE_CALENDAR: "Google Calendar",
  MANUAL: "Manual",
};

const DEFAULT_SETTINGS = {
  bookingLink: "",
  calendarEmail: "",
  defaultLocation: "",
};

const formatDuration = (startAt, endAt) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const minutes = Math.round((end - start) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "N/A";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [copyLabel, setCopyLabel] = useState("Copy link");

  const loadData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus({ tone: "error", message: "Missing session. Please sign in again." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStatus({ tone: "", message: "" });

    try {
      const [bookingsResponse, settingsResponse] = await Promise.all([
        fetch(buildApiUrl("/api/bookings"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl("/api/bookings/settings"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const bookingsPayload = await bookingsResponse.json();
      const settingsPayload = await settingsResponse.json();

      if (!bookingsResponse.ok) {
        throw new Error(bookingsPayload?.error || "Unable to load appointments");
      }
      if (!settingsResponse.ok) {
        throw new Error(settingsPayload?.error || "Unable to load appointment settings");
      }

      setBookings(Array.isArray(bookingsPayload) ? bookingsPayload : []);
      setSettings({
        bookingLink: settingsPayload.bookingLink ?? "",
        calendarEmail: settingsPayload.calendarEmail ?? "",
        defaultLocation: settingsPayload.defaultLocation ?? "",
      });
      setGoogleConnected(Boolean(settingsPayload.googleConnected));
      setLastSyncedAt(settingsPayload.lastSyncedAt ?? null);
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setStatus({ tone: "success", message: "Google Calendar connected." });
      params.delete("google");
      window.history.replaceState({}, "", `${window.location.pathname}`);
    }
  }, []);

  const bookingLinkValue = settings.bookingLink.trim();
  const safeBookingLink = getSafeExternalUrl(bookingLinkValue);
  const bookingEmailValue = settings.calendarEmail.trim();
  const bookingLocationValue = settings.defaultLocation.trim() || "Location shared after appointment";
  const hasBookingLink = Boolean(safeBookingLink);
  const syncStatus = googleConnected ? "Connected" : "Not connected";
  const syncTone = googleConnected ? "success" : "warning";
  const mailSubject = "Book an appointment";
  const mailBody = `Pick a time that works for you: ${
    safeBookingLink || "Add your appointment link"
  }\nLocation: ${bookingLocationValue}`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent(
    mailSubject
  )}&body=${encodeURIComponent(mailBody)}`;

  const bookingTotals = useMemo(() => {
    const totals = { confirmed: 0, tentative: 0, canceled: 0 };
    bookings.forEach((booking) => {
      if (booking.status === "CONFIRMED") totals.confirmed += 1;
      if (booking.status === "TENTATIVE") totals.tentative += 1;
      if (booking.status === "CANCELED") totals.canceled += 1;
    });

    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);

    const upcomingWeek = bookings.filter((booking) => {
      const date = new Date(booking.startAt);
      return date >= now && date <= weekAhead;
    }).length;

    return {
      confirmed: totals.confirmed,
      tentative: totals.tentative,
      canceled: totals.canceled,
      upcomingWeek,
    };
  }, [bookings]);

  const todayBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter((booking) => isSameDay(new Date(booking.startAt), now));
  }, [bookings]);
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((booking) => {
        const endAt = booking?.endAt ? new Date(booking.endAt) : new Date(booking.startAt);
        if (Number.isNaN(endAt.getTime())) return false;
        return endAt >= now;
      })
      .sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
  }, [bookings]);
  const todayHolidayLabels = useMemo(() => getHolidayLabelsForDate(new Date()), []);
  const upcomingHolidayBlocks = useMemo(
    () => listUpcomingHolidays({ startDate: new Date(), days: 45 }),
    []
  );

  const handleCopyLink = async () => {
    if (!safeBookingLink) {
      setCopyLabel("Add link");
      window.setTimeout(() => setCopyLabel("Copy link"), 1600);
      return;
    }
    try {
      await navigator.clipboard.writeText(safeBookingLink);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy link"), 1600);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy link"), 1600);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsSaving(true);
    setStatus({ tone: "", message: "" });
    try {
      const response = await fetch(buildApiUrl("/api/bookings/settings"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingLink: settings.bookingLink,
          defaultLocation: settings.defaultLocation,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save appointment settings");
      }
      setSettings({
        bookingLink: payload.bookingLink ?? "",
        defaultLocation: payload.defaultLocation ?? "",
      });
      setStatus({ tone: "success", message: "Appointment settings saved." });
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setStatus({ tone: "", message: "" });
    try {
      const returnTo = window.location.pathname;
      const response = await fetch(
        buildApiUrl(`/api/integrations/google/init?returnTo=${encodeURIComponent(returnTo)}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to start Google Calendar setup");
      }
      const safeOAuthUrl = getSafeExternalUrl(payload?.url);
      if (!safeOAuthUrl) {
        throw new Error("Received an invalid Google authorization URL.");
      }
      window.location.assign(safeOAuthUrl);
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    }
  };

  const handleSync = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsSyncing(true);
    setStatus({ tone: "", message: "" });
    try {
      const response = await fetch(buildApiUrl("/api/bookings/sync/google"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to sync Google Calendar");
      }
      setStatus({
        tone: "success",
        message: `Synced ${payload.synced ?? 0} events from Google Calendar.`,
      });
      await loadData();
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const confirmed = window.confirm(
      "Disconnect Google Calendar and remove all synced appointments? This cannot be undone."
    );
    if (!confirmed) return;
    setIsDisconnecting(true);
    setStatus({ tone: "", message: "" });
    try {
      const response = await fetch(buildApiUrl("/api/integrations/google/disconnect"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to disconnect Google Calendar");
      }
      const deletedCount = Number(payload?.deletedBookings ?? 0);
      setGoogleConnected(false);
      setLastSyncedAt(null);
      setSettings((prev) => ({
        ...prev,
        calendarEmail: payload.calendarEmail ?? "",
      }));
      setBookings((prev) => prev.filter((booking) => booking.source !== "GOOGLE_CALENDAR"));
      setStatus({
        tone: "success",
        message: deletedCount
          ? `Google Calendar disconnected. Removed ${deletedCount} synced appointment${
              deletedCount === 1 ? "" : "s"
            }.`
          : "Google Calendar disconnected.",
      });
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <section className="page bookings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Appointments</p>
          <h1>Appointment details</h1>
          <p className="muted">Manage requests, calendar sync, and upcoming sessions.</p>
        </div>
        <div className="header-actions">
          <button className="button button-ghost" type="button" onClick={handleConnectGoogle}>
            {googleConnected ? "Reconnect Google" : "Connect Google Calendar"}
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleSync}
            disabled={!googleConnected || isSyncing}
          >
            {isSyncing ? "Syncing..." : "Sync now"}
          </button>
          {googleConnected ? (
            <button
              className="button button-ghost button-danger"
              type="button"
              onClick={handleDisconnectGoogle}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Google"}
            </button>
          ) : null}
        </div>
      </header>

      {status.message ? (
        <div className={`notice ${status.tone ? `is-${status.tone}` : ""}`.trim()}>
          {status.message}
        </div>
      ) : null}

      <div className="panel-grid">
        {[
          {
            id: "upcoming",
            label: "Upcoming (7 days)",
            value: bookingTotals.upcomingWeek,
            note: "Calls and onsite visits",
          },
          {
            id: "confirmed",
            label: "Confirmed",
            value: bookingTotals.confirmed,
            note: "Ready to host",
          },
          {
            id: "tentative",
            label: "Tentative",
            value: bookingTotals.tentative,
            note: "Awaiting confirmation",
          },
        ].map((item) => (
          <article className="panel kpi-card" key={item.id}>
            <span className="kpi-label">{item.label}</span>
            <div className="kpi-value">{item.value}</div>
            <span className="kpi-delta">{item.note}</span>
          </article>
        ))}
      </div>

      <div className="page-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Upcoming appointments</h3>
              <p className="muted">Full details for the next sessions.</p>
            </div>
          </div>
          {isLoading ? (
            <div className="loading-card" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>Loading appointments...</span>
            </div>
          ) : (
            <div className="data-table bookings-table">
              <div className="table-row table-head is-7">
                <span>Client</span>
                <span>Service</span>
                <span>When</span>
                <span>Duration</span>
                <span>Location</span>
                <span>Status</span>
                <span>Source</span>
              </div>
              {upcomingBookings.length ? (
                upcomingBookings.map((booking) => {
                  const statusConfig = STATUS_MAP[booking.status] || STATUS_MAP.TENTATIVE;
                  const holidayLabels = getHolidayLabelsForDate(new Date(booking.startAt));
                  const safeMeetingLink = getSafeExternalUrl(booking.meetingLink);
                  return (
                    <div className="table-row is-7" key={booking.id}>
                      <span className="table-strong">
                        {booking.attendeeName || booking.attendeeEmail || "Customer"}
                      </span>
                      <span>{booking.title}</span>
                      <span>
                        <span>{formatDateTime(booking.startAt)}</span>
                        {holidayLabels.length ? (
                          <span className="bookings-holiday-label">{holidayLabels.join(" • ")}</span>
                        ) : null}
                      </span>
                      <span>{formatDuration(booking.startAt, booking.endAt)}</span>
                      <span>
                        {safeMeetingLink ? (
                          <a href={safeMeetingLink} target="_blank" rel="noreferrer">
                            Meeting link
                          </a>
                        ) : (
                          booking.location || settings.defaultLocation || "TBD"
                        )}
                      </span>
                      <span className={`status-pill is-${statusConfig.tone}`}>{statusConfig.label}</span>
                      <span>{SOURCE_LABELS[booking.source] || booking.source}</span>
                    </div>
                  );
                })
              ) : (
                <p className="muted">No appointments yet.</p>
              )}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Today</h3>
              <p className="muted">
                Agenda for the next 24 hours.
                {todayHolidayLabels.length ? ` Holiday: ${todayHolidayLabels.join(" • ")}.` : ""}
              </p>
            </div>
          </div>
          <div className="list">
            {todayBookings.length ? (
              todayBookings.map((booking) => (
                <div className="list-row is-split" key={booking.id}>
                  <div>
                    <span className="table-strong">
                      {booking.attendeeName || booking.attendeeEmail || "Customer"}
                    </span>
                    <span className="muted">{booking.title}</span>
                  </div>
                  <span>{formatDateTime(booking.startAt)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No appointments scheduled for today.</p>
            )}
          </div>
          <div className="bookings-holiday-blocks">
            <div className="panel-header">
              <div>
                <h4>Holiday blocks (CA/GH)</h4>
                <p className="muted">New appointments are blocked on these dates.</p>
              </div>
            </div>
            <div className="list">
              {upcomingHolidayBlocks.length ? (
                upcomingHolidayBlocks.slice(0, 8).map((holiday) => (
                  <div className="list-row is-split" key={holiday.key}>
                    <span className="table-strong">{holiday.dateLabel}</span>
                    <span className="muted">{holiday.labels.join(" • ")}</span>
                  </div>
                ))
              ) : (
                <p className="muted">No holiday blocks in the next 45 days.</p>
              )}
            </div>
          </div>
        </article>
      </div>

      <section className="panel booking-panel" id="booking">
        <div className="panel-header">
          <div>
            <h3>Appointment link & calendar sync</h3>
            <p className="muted">
              Share a link so customers can pick a time that syncs to your email calendar.
            </p>
          </div>
          <div className="booking-sync">
            <span className="muted">Calendar sync</span>
            <span className={`status-pill is-${syncTone}`}>{syncStatus}</span>
          </div>
        </div>
        <div className="booking-grid">
          <div className="stack">
            <label className="form-field">
              <span>Appointment link</span>
              <div className="input-group">
                <input
                  className="input"
                  type="url"
                  value={settings.bookingLink}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, bookingLink: event.target.value }))
                  }
                  placeholder="https://"
                />
                <button className="input-button" type="button" onClick={handleCopyLink}>
                  {copyLabel}
                </button>
              </div>
            </label>
            <div className="booking-actions">
              <a
                className="button button-primary"
                href={hasBookingLink ? safeBookingLink : "#"}
                target={hasBookingLink ? "_blank" : undefined}
                rel={hasBookingLink ? "noreferrer" : undefined}
                aria-disabled={!hasBookingLink}
                onClick={(event) => {
                  if (!hasBookingLink) {
                    event.preventDefault();
                  }
                }}
              >
                Open appointment page
              </a>
              <a
                className="button button-ghost"
                href={mailtoLink}
                aria-disabled={!hasBookingLink}
                onClick={(event) => {
                  if (!hasBookingLink) {
                    event.preventDefault();
                  }
                }}
              >
                Email link
              </a>
              <button className="button button-ghost" type="button" onClick={handleSave}>
                {isSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
            <p className="muted">
              Last sync {lastSyncedAt ? formatDateTime(lastSyncedAt) : "not yet"}.
            </p>
          </div>
          <div className="stack">
            <label className="form-field">
              <span>Calendar email</span>
              <input
                className="input"
                type="email"
                value={settings.calendarEmail}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, calendarEmail: event.target.value }))
                }
                placeholder="hello@company.com"
              />
            </label>
            <label className="form-field">
              <span>Default location</span>
              <input
                className="input"
                type="text"
                value={settings.defaultLocation}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, defaultLocation: event.target.value }))
                }
                placeholder="Zoom, phone, or office"
              />
            </label>
            <div className="notice">
              Google Calendar events will sync automatically when webhooks are enabled.
            </div>
            {bookingEmailValue ? (
              <p className="muted">Synced calendar: {bookingEmailValue}</p>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
};

export default Bookings;
