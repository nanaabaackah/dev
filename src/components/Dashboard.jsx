import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ReceiptItem, TaskSquare, Timer1 } from "iconsax-react";
import useDashboardData from "../hooks/useDashboardData";
import { formatDateTime, formatPercent, formatRatio } from "../utils/formatters";
import { getApiErrorMessage, readJsonResponse } from "../utils/http";
import { formatStatusLabel, getStatusTone, isHealthyStatus } from "../utils/status";
import { buildUserScopedCacheKey, readOfflineCache, writeOfflineCache } from "../utils/offlineCache";
import { buildApiUrl } from "../api-url";
import "./Dashboard.css";

const ACCOUNTING_RANGE = { value: "all", label: "All time" };
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

const formatAmountValue = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatAmount = (amount, currency) => `${currency} ${formatAmountValue(amount)}`;

const buildAccountingSummary = (entries = []) => {
  const base = {
    paidRevenue: { CAD: 0, GHS: 0 },
    paidExpenses: { CAD: 0, GHS: 0 },
    pendingPayables: { CAD: 0, GHS: 0 },
    counts: {
      paidRevenue: 0,
      paidExpenses: 0,
      pendingPayables: 0,
    },
  };

  entries.forEach((entry) => {
    const amount = Number(entry.amount || 0);
    if (!Number.isFinite(amount)) return;
    if (entry.type === "REVENUE" && entry.status === "PAID") {
      base.paidRevenue[entry.currency] += amount;
      base.counts.paidRevenue += 1;
    }
    if (entry.type === "EXPENSE" && entry.status === "PAID") {
      base.paidExpenses[entry.currency] += amount;
      base.counts.paidExpenses += 1;
    }
    if (entry.type === "EXPENSE" && entry.status !== "PAID") {
      base.pendingPayables[entry.currency] += amount;
      base.counts.pendingPayables += 1;
    }
  });

  return base;
};

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const DEFAULT_PRODUCTIVITY_STATE = {
  entryDate: buildTodayDate(),
  plannedTasks: "5",
  completedTasks: "0",
  deepWorkMinutes: "0",
  focusBlocks: "0",
  blockers: "",
  updatedAt: null,
};

const DEFAULT_PRODUCTIVITY_SUMMARY = {
  plannedTasks: 0,
  completedTasks: 0,
  deepWorkMinutes: 0,
  focusBlocks: 0,
  completionRate: 0,
  focusScore: 0,
  streakDays: 0,
  momentumLabel: "Start a focus block",
  entriesLogged: 0,
};

const buildProductivityState = (entry) => ({
  entryDate: entry?.entryDate || buildTodayDate(),
  plannedTasks: String(entry?.plannedTasks ?? DEFAULT_PRODUCTIVITY_STATE.plannedTasks),
  completedTasks: String(entry?.completedTasks ?? DEFAULT_PRODUCTIVITY_STATE.completedTasks),
  deepWorkMinutes: String(entry?.deepWorkMinutes ?? DEFAULT_PRODUCTIVITY_STATE.deepWorkMinutes),
  focusBlocks: String(entry?.focusBlocks ?? DEFAULT_PRODUCTIVITY_STATE.focusBlocks),
  blockers: String(entry?.blockers ?? DEFAULT_PRODUCTIVITY_STATE.blockers),
  updatedAt: entry?.updatedAt ?? null,
});

const DEFAULT_DAILY_VERSE = {
  status: "idle",
  text: "",
  reference: "",
  source: "youversion",
  warning: "",
  updatedAt: null,
};

const DEFAULT_DAILY_WEATHER = {
  status: "idle",
  temperature: null,
  feelsLike: null,
  temperatureUnit: "FAHRENHEIT",
  conditionLabel: "",
  locationLabel: "Current location",
  warning: "",
  updatedAt: null,
};

const getTemperatureUnitSymbol = (unit) => {
  if (String(unit || "").toUpperCase() === "CELSIUS") return "C";
  return "F";
};

const formatTemperatureValue = (value, unit) => {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}°${getTemperatureUnitSymbol(unit)}`;
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
  const storedUser = useMemo(() => readStoredUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const { data: kpiData, loading, isRefreshing, error, reload } = useDashboardData();
  const [timeRange, setTimeRange] = useState("7d");
  const [availabilityBookings, setAvailabilityBookings] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [accountingSummary, setAccountingSummary] = useState(null);
  const [accountingLoading, setAccountingLoading] = useState(true);
  const [accountingError, setAccountingError] = useState("");
  const [slotModal, setSlotModal] = useState(null);
  const [slotForm, setSlotForm] = useState(DEFAULT_SLOT_FORM);
  const [slotStatus, setSlotStatus] = useState({ tone: "", message: "" });
  const [isSlotSaving, setIsSlotSaving] = useState(false);
  const [expandedSites, setExpandedSites] = useState({});
  const [selectedAvailabilityDayKey, setSelectedAvailabilityDayKey] = useState("");
  const [productivityState, setProductivityState] = useState(() => buildProductivityState());
  const [productivitySummary, setProductivitySummary] = useState(DEFAULT_PRODUCTIVITY_SUMMARY);
  const [productivityError, setProductivityError] = useState("");
  const [productivityNotice, setProductivityNotice] = useState("");
  const [isProductivitySaving, setIsProductivitySaving] = useState(false);
  const [verseOfDay, setVerseOfDay] = useState(DEFAULT_DAILY_VERSE);
  const [dailyWeather, setDailyWeather] = useState(DEFAULT_DAILY_WEATHER);
  const [briefRefreshTick, setBriefRefreshTick] = useState(0);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    []
  );
  const availabilityCacheKey = useMemo(
    () => buildUserScopedCacheKey("dashboard:availability"),
    []
  );
  const accountingCacheKey = useMemo(
    () => buildUserScopedCacheKey("dashboard:accounting-summary"),
    []
  );
  const productivityCacheKey = useMemo(
    () => buildUserScopedCacheKey("dashboard:productivity"),
    []
  );
  const verseCacheKey = useMemo(() => buildUserScopedCacheKey("dashboard:verse"), []);
  const weatherCacheKey = useMemo(() => buildUserScopedCacheKey("dashboard:weather"), []);

  const days = useMemo(() => buildWeekDays(), []);
  const holidayMap = useMemo(() => buildHolidayMap(days), [days]);

  const availabilityMatrix = useMemo(
    () => buildAvailabilityMatrix(days, availabilityBookings, holidayMap),
    [days, availabilityBookings, holidayMap]
  );

  const selectedAvailabilityDayIndex = useMemo(() => {
    const index = days.findIndex((day) => day.key === selectedAvailabilityDayKey);
    return index >= 0 ? index : 0;
  }, [days, selectedAvailabilityDayKey]);
  const selectedAvailabilityDay = days[selectedAvailabilityDayIndex] || null;

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
  const todayDateKey = buildTodayDate();

  const todayBookingsCount = useMemo(
    () =>
      availabilityBookings.filter(
        (booking) => booking.status !== "CANCELED" && toDateKey(new Date(booking.startAt)) === todayDateKey
      ).length,
    [availabilityBookings, todayDateKey]
  );

  const todayOpenSlots = useMemo(() => {
    const dayIndex = days.findIndex((day) => day.key === todayDateKey);
    if (dayIndex < 0) return 0;
    return (availabilityMatrix[dayIndex] || []).filter((status) => status === "available").length;
  }, [availabilityMatrix, days, todayDateKey]);

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
      const result = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(result, "Unable to save appointment."));
      }
      setSlotStatus({ tone: "success", message: "Appointment saved." });
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
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to load availability"));
      }
      const bookings = Array.isArray(payload) ? payload : [];
      setAvailabilityBookings(bookings);
      writeOfflineCache(availabilityCacheKey, bookings);
    } catch (err) {
      const cached = readOfflineCache(availabilityCacheKey);
      if (Array.isArray(cached?.payload)) {
        setAvailabilityBookings(cached.payload);
        setAvailabilityError("Offline mode: showing cached availability.");
      } else {
        setAvailabilityError(err.message);
      }
    } finally {
      setAvailabilityLoading(false);
    }
  }, [availabilityCacheKey]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!days.length) return;
    const validSelected = days.some((day) => day.key === selectedAvailabilityDayKey);
    if (validSelected) return;

    const firstOpenDay = days.find((day, dayIndex) =>
      (availabilityMatrix[dayIndex] || []).some((slotStatus) => slotStatus === "available")
    );
    setSelectedAvailabilityDayKey((firstOpenDay || days[0]).key);
  }, [days, availabilityMatrix, selectedAvailabilityDayKey]);

  const loadAccountingSummary = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAccountingLoading(false);
        setAccountingError("Missing session. Please sign in again.");
        return;
      }

      if (!silent) {
        setAccountingLoading(true);
      }
      setAccountingError("");

      try {
        const query = new URLSearchParams({ range: ACCOUNTING_RANGE.value });
        if (isAdmin) {
          query.set("organizationId", "all");
        }
        const response = await fetch(buildApiUrl(`/api/accounting/entries?${query.toString()}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to load accounting summary"));
        }
        const entries = payload.entries || [];
        setAccountingSummary(buildAccountingSummary(entries));
        writeOfflineCache(accountingCacheKey, entries);
      } catch (err) {
        const cached = readOfflineCache(accountingCacheKey);
        if (Array.isArray(cached?.payload)) {
          setAccountingSummary(buildAccountingSummary(cached.payload));
          setAccountingError("Offline mode: showing cached accounting summary.");
        } else {
          setAccountingError(err.message);
          setAccountingSummary(null);
        }
      } finally {
        setAccountingLoading(false);
      }
    },
    [accountingCacheKey, isAdmin]
  );

  useEffect(() => {
    loadAccountingSummary();
  }, [loadAccountingSummary]);

  useEffect(() => {
    if (!productivityNotice) return undefined;
    const timeout = window.setTimeout(() => {
      setProductivityNotice("");
    }, 2400);
    return () => window.clearTimeout(timeout);
  }, [productivityNotice]);

  const loadProductivity = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setProductivityError("");

    try {
      const query = new URLSearchParams({ range: "14d" });
      const response = await fetch(buildApiUrl(`/api/productivity/entries?${query.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to load productivity data"));
      }

      setProductivitySummary(payload?.summary || DEFAULT_PRODUCTIVITY_SUMMARY);
      setProductivityState(buildProductivityState(payload?.activeEntry));
      writeOfflineCache(productivityCacheKey, {
        summary: payload?.summary || DEFAULT_PRODUCTIVITY_SUMMARY,
        activeEntry: payload?.activeEntry || null,
      });
    } catch (err) {
      const cached = readOfflineCache(productivityCacheKey);
      if (cached?.payload) {
        setProductivitySummary(cached.payload.summary || DEFAULT_PRODUCTIVITY_SUMMARY);
        setProductivityState(buildProductivityState(cached.payload.activeEntry));
        setProductivityError("Offline mode: showing cached productivity data.");
      } else {
        setProductivityError(err.message || "Unable to load productivity data");
      }
    }
  }, [productivityCacheKey]);

  useEffect(() => {
    loadProductivity();
  }, [loadProductivity]);

  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem("token");
    if (!token) {
      setVerseOfDay((prev) => ({
        ...prev,
        status: "error",
        warning: "Missing session. Please sign in again.",
      }));
      return undefined;
    }

    setVerseOfDay((prev) => ({ ...prev, status: "loading", warning: "" }));

    fetch(buildApiUrl("/api/dashboard/verse-of-day"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to load verse of the day"));
        }

        const verse = payload?.verse || {};
        const nextVerse = {
          status: "ready",
          text: String(verse?.text || "").trim(),
          reference: String(verse?.reference || "").trim(),
          source: String(verse?.source || payload?.meta?.source || "youversion"),
          warning: String(payload?.meta?.warning || ""),
          updatedAt: payload?.meta?.fetchedAt || new Date().toISOString(),
        };
        if (!nextVerse.text || !nextVerse.reference) {
          throw new Error("Verse endpoint returned incomplete data.");
        }
        if (!isActive) return;
        setVerseOfDay(nextVerse);
        writeOfflineCache(verseCacheKey, nextVerse);
      })
      .catch((requestError) => {
        if (!isActive) return;
        const cached = readOfflineCache(verseCacheKey);
        if (cached?.payload?.text && cached?.payload?.reference) {
          setVerseOfDay({
            ...cached.payload,
            status: "ready",
            warning: cached.payload.warning || "Offline mode: showing cached verse.",
          });
          return;
        }
        setVerseOfDay((prev) => ({
          ...prev,
          status: "error",
          warning: requestError.message || "Unable to load verse of the day.",
        }));
      });

    return () => {
      isActive = false;
    };
  }, [verseCacheKey, briefRefreshTick]);

  useEffect(() => {
    let isActive = true;
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
      const cached = readOfflineCache(weatherCacheKey);
      if (cached?.payload) {
        setDailyWeather({
          ...DEFAULT_DAILY_WEATHER,
          ...cached.payload,
          status: "ready",
          warning: cached.payload.warning || "Offline mode: showing cached weather.",
        });
      } else {
        setDailyWeather((prev) => ({ ...prev, status: "unavailable" }));
      }
      return undefined;
    }

    setDailyWeather((prev) => ({ ...prev, status: "loading" }));

    const handleSuccess = async (position) => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!isActive) return;
        setDailyWeather((prev) => ({
          ...prev,
          status: "error",
          warning: "Missing session. Please sign in again.",
        }));
        return;
      }

      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (!isActive) return;
        setDailyWeather((prev) => ({ ...prev, status: "error" }));
        return;
      }

      try {
        const weatherQuery = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
        });
        const weatherResponse = await fetch(
          buildApiUrl(`/api/dashboard/weather?${weatherQuery.toString()}`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const weatherPayload = await readJsonResponse(weatherResponse);
        if (!weatherResponse.ok) {
          throw new Error(getApiErrorMessage(weatherPayload, "Unable to load weather"));
        }

        const weather = weatherPayload?.weather || {};
        const parsedTemperature = Number(weather?.temperature);
        const parsedFeelsLike = Number(weather?.feelsLike);
        const nextWeather = {
          status: "ready",
          temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : null,
          feelsLike: Number.isFinite(parsedFeelsLike) ? parsedFeelsLike : null,
          temperatureUnit: String(weather?.temperatureUnit || "FAHRENHEIT"),
          conditionLabel: String(weather?.conditionLabel || "Current conditions"),
          locationLabel: String(weather?.locationLabel || "Current location"),
          warning: String(weatherPayload?.meta?.warning || ""),
          updatedAt: weatherPayload?.meta?.fetchedAt || new Date().toISOString(),
        };
        if (!isActive) return;
        setDailyWeather(nextWeather);
        writeOfflineCache(weatherCacheKey, nextWeather);
      } catch (requestError) {
        if (!isActive) return;
        const cached = readOfflineCache(weatherCacheKey);
        if (cached?.payload) {
          setDailyWeather({
            ...DEFAULT_DAILY_WEATHER,
            ...cached.payload,
            status: "ready",
            warning: cached.payload.warning || "Offline mode: showing cached weather.",
          });
          return;
        }
        setDailyWeather((prev) => ({
          ...prev,
          status: "error",
          warning: requestError.message || "Unable to fetch weather forecast.",
        }));
      }
    };

    const handleError = () => {
      if (!isActive) return;
      const cached = readOfflineCache(weatherCacheKey);
      if (cached?.payload) {
        setDailyWeather({
          ...DEFAULT_DAILY_WEATHER,
          ...cached.payload,
          status: "ready",
          warning: cached.payload.warning || "Location unavailable. Showing cached weather.",
        });
        return;
      }
      setDailyWeather((prev) => ({ ...prev, status: "unavailable" }));
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 20 * 60 * 1000,
    });

    return () => {
      isActive = false;
    };
  }, [weatherCacheKey, briefRefreshTick]);

  const handleRefresh = () => {
    if (!isRefreshing) {
      reload({ silent: true });
    }
    loadAvailability();
    loadAccountingSummary({ silent: true });
    loadProductivity();
    setBriefRefreshTick((previous) => previous + 1);
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

  const organizationStatusBreakdown = kpiData?.organizationStatusBreakdown ?? [];

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
      label: "By Nana DB",
      status: systemStatus.portfolioDb,
      note: "Primary org data",
    },
    {
      id: "reebs",
      label: "Reebs DB",
      status: systemStatus.reebsDb,
      note: "Operational data",
    },
    {
      id: "faako",
      label: "Faako DB",
      status: systemStatus.faakoDb,
      note: "ERP members",
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
  const accountingNetTotals = useMemo(() => {
    if (!accountingSummary) return null;
    return {
      CAD: accountingSummary.paidRevenue.CAD - accountingSummary.paidExpenses.CAD,
      GHS: accountingSummary.paidRevenue.GHS - accountingSummary.paidExpenses.GHS,
    };
  }, [accountingSummary]);
  const productivityMetrics = useMemo(() => {
    const plannedTasks = Math.max(Number(productivityState.plannedTasks) || 0, 0);
    const completedTasks = Math.max(Number(productivityState.completedTasks) || 0, 0);
    const deepWorkMinutes = Math.max(Number(productivityState.deepWorkMinutes) || 0, 0);
    const focusBlocks = Math.max(Number(productivityState.focusBlocks) || 0, 0);
    const completionRate = plannedTasks ? Math.round((completedTasks / plannedTasks) * 100) : 0;
    const focusScore = Math.min(
      100,
      Math.round(completionRate * 0.5 + Math.min(deepWorkMinutes, 240) * 0.2 + focusBlocks * 8)
    );

    let momentumLabel = "Start a focus block";
    if (completionRate >= 80 && deepWorkMinutes >= 90) momentumLabel = "Strong momentum";
    else if (completionRate >= 60 || deepWorkMinutes >= 60) momentumLabel = "On track";

    return {
      plannedTasks,
      completedTasks,
      deepWorkMinutes,
      focusBlocks,
      completionRate,
      focusScore,
      momentumLabel,
    };
  }, [productivityState]);
  const productivitySavedLabel = productivityState.updatedAt
    ? new Date(productivityState.updatedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not saved yet";
  const verseTextLabel =
    verseOfDay.status === "ready" && verseOfDay.text
      ? `"${verseOfDay.text}"`
      : verseOfDay.status === "loading"
        ? "Loading verse..."
        : '"Keep moving with purpose today."';
  const verseReferenceLabel =
    verseOfDay.status === "ready" && verseOfDay.reference
      ? verseOfDay.reference
      : verseOfDay.warning || "Verse unavailable.";
  const weatherPrimaryLabel =
    dailyWeather.status === "ready"
      ? formatTemperatureValue(dailyWeather.temperature, dailyWeather.temperatureUnit)
      : dailyWeather.status === "loading"
        ? "Loading..."
        : "--";
  const weatherSecondaryLabel =
    dailyWeather.status === "ready"
      ? `${dailyWeather.conditionLabel || "Current conditions"} • ${dailyWeather.locationLabel}`
      : dailyWeather.status === "unavailable"
        ? "Enable location for local weather."
        : dailyWeather.status === "error"
          ? dailyWeather.warning || "Unable to fetch forecast."
          : "Fetching local forecast.";
  const weatherFeelsLikeLabel =
    dailyWeather.status === "ready" && Number.isFinite(dailyWeather.feelsLike)
      ? `Feels like ${formatTemperatureValue(dailyWeather.feelsLike, dailyWeather.temperatureUnit)}`
      : dailyWeather.warning || "Current forecast";

  const handleProductivityField = (field, value) => {
    setProductivityState((prev) => ({
      ...prev,
      [field]: value,
      updatedAt: prev.updatedAt,
    }));
  };

  const bumpProductivityMetric = (field, amount) => {
    setProductivityState((prev) => {
      const current = Math.max(Number(prev[field]) || 0, 0);
      return {
        ...prev,
        [field]: String(Math.max(current + amount, 0)),
      };
    });
  };

  const handleSaveProductivity = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setProductivityError("Missing session. Please sign in again.");
      return;
    }

    const payload = {
      entryDate: productivityState.entryDate || buildTodayDate(),
      plannedTasks: Number(productivityState.plannedTasks || 0),
      completedTasks: Number(productivityState.completedTasks || 0),
      deepWorkMinutes: Number(productivityState.deepWorkMinutes || 0),
      focusBlocks: Number(productivityState.focusBlocks || 0),
      blockers: productivityState.blockers,
    };

    setIsProductivitySaving(true);
    setProductivityError("");

    fetch(buildApiUrl("/api/productivity/entries"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const result = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(result, "Unable to save productivity entry"));
        }
        setProductivityState(buildProductivityState(result));
        setProductivityNotice("Productivity tracker saved.");
        loadProductivity();
      })
      .catch((saveError) => {
        setProductivityError(saveError.message || "Unable to save productivity entry");
      })
      .finally(() => {
        setIsProductivitySaving(false);
      });
  };

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
          detail: `Orgs ${kpiData.totalOrganizations ?? 0} | Sites ${onlineSites}/${totalSites} online`,
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
  const slotTitle = slotModal?.booking ? "Edit appointment" : "Add appointment";
  const slotDateLabel = slotModal
    ? `${slotModal.day.dateLabel} • ${slotModal.slot.label}`
    : "";

  return (
    <section className="page dashboard">
      <div className="panel dashboard-hero availability-hero">
        <div className="dashboard-hero__intro">
          <p className="eyebrow">Daily brief</p>
          <h1>Welcome Baaba</h1>
          <p className="muted">
            {todayLabel} | Window {rangeDescription} | Last synced {lastSyncedLabel}
          </p>
          <article className="dashboard-verse">
            <span className="dashboard-verse__label">Verse of the day</span>
            <p className="dashboard-verse__text">{verseTextLabel}</p>
            <p className="dashboard-verse__reference">{verseReferenceLabel}</p>
          </article>
        </div>
        <div className="dashboard-hero__side">
          <div className="dashboard-brief-grid">
            <article className="dashboard-brief-card">
              <span className="kpi-label">Weather</span>
              <div className="kpi-value">{weatherPrimaryLabel}</div>
              <span className="muted">{weatherSecondaryLabel}</span>
              <span className="kpi-delta">{weatherFeelsLikeLabel}</span>
            </article>
            <article className="dashboard-brief-card">
              <span className="kpi-label">Appointments today</span>
              <div className="kpi-value">{todayBookingsCount}</div>
              <span className="muted">Scheduled appointments</span>
              <span className="kpi-delta">Availability {availableSlots}/{totalSlots}</span>
            </article>
            <article className="dashboard-brief-card">
              <span className="kpi-label">Open slots today</span>
              <div className="kpi-value">{todayOpenSlots}/{TIME_SLOTS.length}</div>
              <span className="muted">Available windows</span>
              <span className="kpi-delta">
                {nextAvailable ? `Next open ${nextAvailable.day.dateLabel} ${nextAvailable.time}` : "No open slots"}
              </span>
            </article>
            <article className="dashboard-brief-card">
              <span className="kpi-label">Service health</span>
              <div className="kpi-value">{serviceHealthPercent}</div>
              <span className="muted">{healthyServices}/{totalServices} healthy services</span>
              <span className="kpi-delta">{onlineSites}/{totalSites} sites online</span>
            </article>
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
              Appointments
            </Link>
            <a className="button button-ghost" href="#site-status">
              Site status
            </a>
          </div>
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

      <section className="panel dashboard-productivity" id="productivity">
        <div className="panel-header">
          <div>
            <h3>Productivity tracker</h3>
            <p className="muted">Track daily execution from the dashboard.</p>
          </div>
          <div className="dashboard-productivity__header-actions">
            <span className="status-pill is-info">
              {productivitySummary.momentumLabel || productivityMetrics.momentumLabel}
            </span>
            <Link className="button button-ghost" to="/productivity">
              Open module
            </Link>
          </div>
        </div>

        {productivityError ? (
          <div className="notice is-error" role="alert">
            {productivityError}
          </div>
        ) : null}

        <div className="productivity-grid">
          <div className="productivity-card">
            <span className="productivity-card__meta">
              <TaskSquare size={14} variant="Linear" />
              Completion
            </span>
            <div className="kpi-value">{productivityMetrics.completionRate}%</div>
            <span className="muted">
              {productivityMetrics.completedTasks}/{productivityMetrics.plannedTasks} tasks
            </span>
          </div>
          <div className="productivity-card">
            <span className="productivity-card__meta">
              <Timer1 size={14} variant="Linear" />
              Deep work
            </span>
            <div className="kpi-value">{productivityMetrics.deepWorkMinutes}m</div>
            <span className="muted">{productivityMetrics.focusBlocks} blocks</span>
          </div>
          <div className="productivity-card">
            <span className="productivity-card__meta">
              <ReceiptItem size={14} variant="Linear" />
              Focus score
            </span>
            <div className="kpi-value">{productivityMetrics.focusScore}</div>
            <span className="muted">
              {Math.max(productivityMetrics.plannedTasks - productivityMetrics.completedTasks, 0)} left
            </span>
          </div>
        </div>

        <div className="dashboard-productivity__workspace">
          <div className="dashboard-productivity__fields">
            <label className="form-field dashboard-productivity__field">
              <span>Planned</span>
              <input
                className="input"
                type="number"
                min="0"
                value={productivityState.plannedTasks}
                onChange={(event) => handleProductivityField("plannedTasks", event.target.value)}
                aria-label="Planned tasks"
              />
            </label>
            <label className="form-field dashboard-productivity__field">
              <span>Done</span>
              <input
                className="input"
                type="number"
                min="0"
                value={productivityState.completedTasks}
                onChange={(event) => handleProductivityField("completedTasks", event.target.value)}
                aria-label="Completed tasks"
              />
            </label>
            <label className="form-field dashboard-productivity__field">
              <span>Focus min</span>
              <input
                className="input"
                type="number"
                min="0"
                value={productivityState.deepWorkMinutes}
                onChange={(event) => handleProductivityField("deepWorkMinutes", event.target.value)}
                aria-label="Deep work minutes"
              />
            </label>
          </div>

          <div className="dashboard-productivity__notes">
            <label className="form-field">
              <span>Blockers</span>
              <textarea
                className="input"
                value={productivityState.blockers}
                onChange={(event) => handleProductivityField("blockers", event.target.value)}
                placeholder="What is slowing you down?"
              />
            </label>
            <div className="productivity-quick-actions">
              <button
                className="button button-ghost"
                type="button"
                onClick={() => bumpProductivityMetric("deepWorkMinutes", 25)}
              >
                +25m focus
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => bumpProductivityMetric("completedTasks", 1)}
              >
                +1 task
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => bumpProductivityMetric("focusBlocks", 1)}
              >
                +1 block
              </button>
            </div>
            <div className="dashboard-productivity__save">
              <button
                className="button button-primary"
                type="button"
                onClick={handleSaveProductivity}
                disabled={isProductivitySaving}
              >
                {isProductivitySaving ? "Saving..." : "Save update"}
              </button>
              <span className="muted">Last saved {productivitySavedLabel}</span>
            </div>
          </div>
        </div>

        {productivityNotice ? (
          <div className="notice is-success" role="status">
            {productivityNotice}
          </div>
        ) : null}
      </section>

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

        <div className="availability-scroll availability-desktop">
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

        <div className="availability-mobile" aria-label="Mobile weekly availability">
          <div className="availability-mobile__days" role="tablist" aria-label="Choose day">
            {days.map((day, dayIndex) => {
              const isActive = selectedAvailabilityDay?.key === day.key;
              const hasOpenSlot = (availabilityMatrix[dayIndex] || []).some(
                (slotStatus) => slotStatus === "available"
              );
              return (
                <button
                  key={day.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`availability-day-chip ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedAvailabilityDayKey(day.key)}
                >
                  <span className="availability-day-chip__label">{day.label}</span>
                  <span className="availability-day-chip__number">{day.date.getDate()}</span>
                  {hasOpenSlot ? <span className="availability-day-chip__dot" /> : null}
                </button>
              );
            })}
          </div>

          <div className="availability-mobile__agenda" role="list">
            {selectedAvailabilityDay
              ? TIME_SLOTS.map((slot, slotIndex) => {
                  const status = availabilityMatrix[selectedAvailabilityDayIndex]?.[slotIndex] || "blocked";
                  const slotBooking = findSlotBooking(selectedAvailabilityDay, slot);
                  const isBlocked = status === "blocked" && !slotBooking;
                  return (
                    <button
                      key={`${selectedAvailabilityDay.key}-${slot.label}`}
                      type="button"
                      className={`availability-agenda-slot is-${status}`}
                      onClick={() => openSlotModal(selectedAvailabilityDay, slot, status)}
                      disabled={isBlocked}
                    >
                      <span>{slot.label}</span>
                      <span>{STATUS_LABELS[status]}</span>
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      </section>

      {slotModal ? (
        <div className="slot-modal" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
          <div className="slot-modal__card">
            <div className="slot-modal__header">
              <div>
                <p className="eyebrow">Appointment</p>
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
                This appointment is synced from Google Calendar and can only be edited there.
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
                  placeholder="Customer appointment"
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
                  placeholder="Add any notes for this appointment"
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
                  {isSlotSaving ? "Saving..." : "Save appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}


      <section className="stack">
          <div className="panel-header">
            <div>
              <h3>Accounting snapshot</h3>
              <p className="muted">Window: {ACCOUNTING_RANGE.label} across CAD and GHS.</p>
            </div>
            <Link className="button button-ghost" to="/accounting">
              View ledger
            </Link>
        </div>

        {accountingError ? (
          <div className="notice is-error" role="alert">
            {accountingError}
          </div>
        ) : null}

        {accountingLoading ? (
          <div className="loading-card" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Loading accounting summary...</span>
          </div>
        ) : null}

        {!accountingLoading && accountingSummary ? (
          <div className="kpi-grid">
            <article className="panel kpi-card">
              <span className="kpi-label">Paid revenue</span>
              <div className="kpi-value">
                <div>{formatAmount(accountingSummary.paidRevenue.CAD, "CAD")}</div>
                <div>{formatAmount(accountingSummary.paidRevenue.GHS, "GHS")}</div>
              </div>
              <span className="kpi-delta">{accountingSummary.counts.paidRevenue} paid</span>
            </article>
            <article className="panel kpi-card">
              <span className="kpi-label">Paid expenses</span>
              <div className="kpi-value">
                <div>{formatAmount(accountingSummary.paidExpenses.CAD, "CAD")}</div>
                <div>{formatAmount(accountingSummary.paidExpenses.GHS, "GHS")}</div>
              </div>
              <span className="kpi-delta">{accountingSummary.counts.paidExpenses} paid</span>
            </article>
            <article className="panel kpi-card">
              <span className="kpi-label">Net profit</span>
              <div className="kpi-value">
                <div>{formatAmount(accountingNetTotals?.CAD ?? 0, "CAD")}</div>
                <div>{formatAmount(accountingNetTotals?.GHS ?? 0, "GHS")}</div>
              </div>
              <span className="kpi-delta">After paid expenses</span>
            </article>
            <article className="panel kpi-card">
              <span className="kpi-label">Pending payables</span>
              <div className="kpi-value">
                <div>{formatAmount(accountingSummary.pendingPayables.CAD, "CAD")}</div>
                <div>{formatAmount(accountingSummary.pendingPayables.GHS, "GHS")}</div>
              </div>
              <span className="kpi-delta">
                {accountingSummary.counts.pendingPayables} pending
              </span>
            </article>
          </div>
        ) : null}
      </section>

      {kpiData ? (
        <>
          <p className="muted">KPI window: {rangeDescription}.</p>
          <div className="kpi-grid">
            {[
              {
                id: "orgs",
                label: "Organizations",
                value: kpiData.totalOrganizations,
                delta: `By Nana ${kpiData.portfolio?.organizations ?? 0} | Reebs ${
                  kpiData.reebs?.organizations ?? 0
                } | Faako ${kpiData.faako?.organizations ?? 0}`,
              },
              {
                id: "services",
                label: "Services healthy",
                value: formatRatio(healthyServices, totalServices),
                delta: `${serviceHealthPercent}% healthy`,
              },
              {
                id: "sites",
                label: "Sites online",
                value: formatRatio(onlineSites, totalSites),
                delta: `${siteHealthPercent}% uptime`,
              },
              {
                id: "pages",
                label: "Pages online",
                value: formatRatio(onlinePages, totalPages),
                delta: `${pageHealthPercent}% uptime`,
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
                id: "service-health",
                label: "Service health",
                value: serviceHealthPercent,
                hint: `${healthyServices}/${totalServices} services healthy`,
              },
              {
                id: "site-health",
                label: "Site health",
                value: siteHealthPercent,
                hint: `${onlineSites}/${totalSites} sites online`,
              },
              {
                id: "tracked-organizations",
                label: "Tracked organizations",
                value: kpiData.totalOrganizations ?? 0,
                hint: "By Nana + ERP sources",
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
                  <p className="muted">By Nana, Reebs, and Faako totals.</p>
                </div>
              </div>
              <div className="data-table">
                <div className="table-row table-head is-3">
                  <span>Source</span>
                  <span>Orgs</span>
                  <span>Status</span>
                </div>
                {[
                  {
                    id: "portfolio",
                    label: "By Nana",
                    orgs: kpiData.portfolio?.organizations ?? 0,
                    status: systemStatus.portfolioDb,
                  },
                  {
                    id: "reebs",
                    label: "Reebs",
                    orgs: kpiData.reebs?.organizations ?? 0,
                    status: systemStatus.reebsDb,
                  },
                  {
                    id: "faako",
                    label: "Faako",
                    orgs: kpiData.faako?.organizations ?? 0,
                    status: systemStatus.faakoDb,
                  },
                ].map((row) => (
                  <div className="table-row is-3" key={row.id}>
                    <span className="table-strong">{row.label}</span>
                    <span>{row.orgs}</span>
                    {renderStatusPill(row.status)}
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

            <article className="panel">
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

            <article className="panel">
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

            <article className="panel panel-span-3">
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
