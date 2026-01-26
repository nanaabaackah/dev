import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl } from "../api-url";
import { formatDateTime } from "../utils/formatters";
import "./PublicBooking.css";

const DEFAULT_ORG_SLUG = import.meta.env.VITE_DEFAULT_ORG_SLUG || "bynana-portfolio";
const DURATIONS = [30, 60, 90];
const SLOT_DURATION_MIN = 60;
const TIME_SLOTS = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "11:00 AM", hour: 11, minute: 0 },
  { label: "1:00 PM", hour: 13, minute: 0 },
  { label: "3:00 PM", hour: 15, minute: 0 },
  { label: "5:00 PM", hour: 17, minute: 0 },
];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (date) => {
  if (!date) return "";
  return toDateKey(date);
};

const toTimeInputValue = (date) => {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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

const buildAvailabilityMatrix = (days, bookings) => {
  const now = new Date();
  const activeBookings = bookings.filter((booking) => booking.status !== "CANCELED");
  const bookingRanges = activeBookings.map((booking) => ({
    start: new Date(booking.startAt),
    end: new Date(booking.endAt),
  }));

  return days.map((day) => {
    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
    return TIME_SLOTS.map((slot) => {
      const { start, end } = buildSlotRange(day.date, slot);
      if (isWeekend || end <= now) {
        return "blocked";
      }
      const booked = bookingRanges.some((range) => hasOverlap(start, end, range.start, range.end));
      return booked ? "booked" : "available";
    });
  });
};

const buildStartDate = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const combined = `${dateValue}T${timeValue}`;
  const parsed = new Date(combined);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const PublicBooking = () => {
  const { orgSlug: orgParam } = useParams();
  const orgSlug = (orgParam || DEFAULT_ORG_SLUG).trim();
  const [settings, setSettings] = useState({
    organizationName: "",
    bookingLink: "",
    defaultLocation: "",
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    service: "",
    date: "",
    time: "",
    duration: "60",
    notes: "",
    company: "",
  });
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [availabilityBookings, setAvailabilityBookings] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");

  const days = useMemo(() => buildWeekDays(), []);
  const availabilityMatrix = useMemo(
    () => buildAvailabilityMatrix(days, availabilityBookings),
    [days, availabilityBookings]
  );
  const availabilityRange = useMemo(() => {
    if (!days.length) return null;
    const start = new Date(days[0].date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(days[days.length - 1].date);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [days]);

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      setIsLoading(true);
      setStatus({ tone: "", message: "" });
      try {
        const response = await fetch(buildApiUrl(`/api/public/booking-settings/${orgSlug}`));
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load booking details.");
        }
        if (isMounted) {
          setSettings({
            organizationName: payload.organizationName ?? "",
            bookingLink: payload.bookingLink ?? "",
            defaultLocation: payload.defaultLocation ?? "",
          });
        }
      } catch (error) {
        if (isMounted) {
          setStatus({ tone: "error", message: error.message });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [orgSlug]);

  useEffect(() => {
    let isMounted = true;
    const loadAvailability = async () => {
      if (!availabilityRange) return;
      setAvailabilityLoading(true);
      setAvailabilityError("");
      try {
        const query = new URLSearchParams({
          from: availabilityRange.from,
          to: availabilityRange.to,
        });
        const response = await fetch(
          buildApiUrl(`/api/public/bookings/${orgSlug}?${query.toString()}`)
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load availability.");
        }
        if (isMounted) {
          setAvailabilityBookings(Array.isArray(payload) ? payload : []);
        }
      } catch (error) {
        if (isMounted) {
          setAvailabilityError(error.message);
        }
      } finally {
        if (isMounted) {
          setAvailabilityLoading(false);
        }
      }
    };
    loadAvailability();
    return () => {
      isMounted = false;
    };
  }, [orgSlug, availabilityRange]);

  const locationLabel = settings.defaultLocation || "Meeting link sent after booking";
  const isReadyToSubmit = useMemo(() => {
    return (
      form.name.trim() &&
      form.email.trim() &&
      form.date.trim() &&
      form.time.trim() &&
      !isSubmitting
    );
  }, [form, isSubmitting]);

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReadyToSubmit) {
      setStatus({ tone: "error", message: "Please complete the required fields." });
      return;
    }

    const startDate = buildStartDate(form.date, form.time);
    if (!startDate) {
      setStatus({ tone: "error", message: "Please choose a valid date and time." });
      return;
    }
    const dayIndex = startDate.getDay();
    if (dayIndex === 0 || dayIndex === 6) {
      setStatus({ tone: "error", message: "Weekend slots are not available." });
      return;
    }

    const durationMinutes = Number(form.duration || 60);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    setIsSubmitting(true);
    setStatus({ tone: "", message: "" });
    try {
      const response = await fetch(buildApiUrl(`/api/public/bookings/${orgSlug}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeName: form.name,
          attendeeEmail: form.email,
          title: form.service,
          description: form.notes,
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          durationMinutes,
          company: form.company,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to book appointment.");
      }
      setConfirmation(payload);
      setStatus({
        tone: "success",
        message: "Booking confirmed. Check your email for updates.",
      });
      if (availabilityRange) {
        try {
          const query = new URLSearchParams({
            from: availabilityRange.from,
            to: availabilityRange.to,
          });
          const availabilityResponse = await fetch(
            buildApiUrl(`/api/public/bookings/${orgSlug}?${query.toString()}`)
          );
          const availabilityPayload = await availabilityResponse.json();
          if (availabilityResponse.ok) {
            setAvailabilityBookings(Array.isArray(availabilityPayload) ? availabilityPayload : []);
          }
        } catch {
          // ignore availability refresh failures
        }
      }
      setForm({
        name: "",
        email: "",
        service: "",
        date: "",
        time: "",
        duration: "60",
        notes: "",
        company: "",
      });
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSlotSelect = (day, slot) => {
    const { start } = buildSlotRange(day.date, slot);
    setForm((prev) => ({
      ...prev,
      date: toDateInputValue(start),
      time: toTimeInputValue(start),
      duration: String(SLOT_DURATION_MIN),
    }));
  };

  const isSelectedSlot = (day, slot) => {
    if (!form.date || !form.time) return false;
    const { start } = buildSlotRange(day.date, slot);
    return form.date === toDateInputValue(start) && form.time === toTimeInputValue(start);
  };

  return (
    <section className="page public-booking">
      <header className="public-booking__hero">
        <p className="eyebrow">Appointment booking</p>
        <h1>{settings.organizationName || "Book an appointment"}</h1>
        <p className="muted">
          Choose a time that works for you. We’ll confirm details and send a calendar invite.
        </p>
      </header>

      {status.message ? (
        <div className={`notice ${status.tone ? `is-${status.tone}` : ""}`.trim()}>
          {status.message}
        </div>
      ) : null}

      {confirmation ? (
        <div className="panel public-booking__confirmation">
          <h3>You're booked</h3>
          <p className="muted">
            {confirmation.title || "Appointment"} · {formatDateTime(confirmation.startAt)}
          </p>
          <p className="muted">Location: {confirmation.meetingLink || locationLabel}</p>
          {confirmation.meetingLink ? (
            <a className="button button-primary" href={confirmation.meetingLink} target="_blank" rel="noreferrer">
              Join meeting
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="panel">
        {isLoading ? (
          <div className="loading-card" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Loading availability...</span>
          </div>
        ) : (
          <form className="public-booking__form" onSubmit={handleSubmit}>
            <section className="public-booking__availability">
              <div className="panel-header">
                <div>
                  <h3>Choose a time</h3>
                  <p className="muted">Pick an available slot to prefill the form.</p>
                </div>
                <div className="public-booking__legend">
                  <span className="public-booking__legend-item is-available">Available</span>
                  <span className="public-booking__legend-item is-booked">Booked</span>
                  <span className="public-booking__legend-item is-blocked">Unavailable</span>
                </div>
              </div>
              {availabilityError ? (
                <div className="notice is-error">{availabilityError}</div>
              ) : availabilityLoading ? (
                <div className="loading-card" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <span>Loading availability...</span>
                </div>
              ) : (
                <div className="public-availability-scroll">
                  <div className="public-availability-grid" role="grid">
                    <div className="public-availability-cell public-availability-corner" />
                    {days.map((day) => (
                      <div
                        className="public-availability-cell public-availability-day"
                        role="columnheader"
                        key={day.key}
                      >
                        <span className="public-availability-day__label">{day.label}</span>
                        <span className="public-availability-day__date">{day.dateLabel}</span>
                      </div>
                    ))}
                    {TIME_SLOTS.map((slot, slotIndex) => (
                      <React.Fragment key={slot.label}>
                        <div className="public-availability-cell public-availability-time" role="rowheader">
                          {slot.label}
                        </div>
                        {days.map((day, dayIndex) => {
                          const status = availabilityMatrix[dayIndex]?.[slotIndex] || "available";
                          const isSelected = isSelectedSlot(day, slot);
                          if (status === "available") {
                            return (
                              <button
                                type="button"
                                key={`${day.key}-${slot.label}`}
                                className={`public-availability-cell public-availability-slot is-${status}${
                                  isSelected ? " is-selected" : ""
                                }`}
                                onClick={() => handleSlotSelect(day, slot)}
                              >
                                Open
                              </button>
                            );
                          }
                          return (
                            <div
                              key={`${day.key}-${slot.label}`}
                              className={`public-availability-cell public-availability-slot is-${status}`}
                            >
                              {status === "booked" ? "Booked" : "Past"}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <div className="public-booking__grid">
              <label className="form-field">
                <span>Name</span>
                <input
                  className="input"
                  type="text"
                  value={form.name}
                  onChange={handleChange("name")}
                  placeholder="Your name"
                  required
                />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  placeholder="you@email.com"
                  required
                />
              </label>
            </div>

            <label className="form-field">
              <span>Service (optional)</span>
              <input
                className="input"
                type="text"
                value={form.service}
                onChange={handleChange("service")}
                placeholder="Consultation"
              />
            </label>

            <div className="public-booking__grid">
              <label className="form-field">
                <span>Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={handleChange("date")}
                  required
                />
              </label>
              <label className="form-field">
                <span>Time</span>
                <input
                  className="input"
                  type="time"
                  value={form.time}
                  onChange={handleChange("time")}
                  required
                />
              </label>
            </div>

            <label className="form-field">
              <span>Duration</span>
              <select
                className="input"
                value={form.duration}
                onChange={handleChange("duration")}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={String(minutes)}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Notes (optional)</span>
              <textarea
                className="input"
                value={form.notes}
                onChange={handleChange("notes")}
                placeholder="Share any details or questions."
              />
            </label>

            <label className="public-booking__honeypot">
              <span>Company</span>
              <input type="text" value={form.company} onChange={handleChange("company")} />
            </label>

            <div className="public-booking__actions">
              <button className="button button-primary" type="submit" disabled={!isReadyToSubmit}>
                {isSubmitting ? "Booking..." : "Confirm booking"}
              </button>
              <span className="muted">Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            <p className="muted">
              Location: {locationLabel}. We’ll email you if anything changes.
            </p>
          </form>
        )}
      </div>
    </section>
  );
};

export default PublicBooking;
