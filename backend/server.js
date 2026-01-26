/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Resend } from "resend";
import { google } from "googleapis";

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient({ adapter });
const reebsDatabaseUrl = process.env.REEBS_DATABASE_URL;
const faakoDatabaseUrl = process.env.FAAKO_DATABASE_URL;
const normalizeOrigin = (origin) => origin.replace(/\/$/, "");
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter(Boolean);
const productionExtraOrigins = ["https://dev.nanaabaackah.com"];
const devOrigins = isProduction
  ? productionExtraOrigins
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://localhost:8888",
      "https://dev.nanaabaackah.com",
    ];
const allowedOriginSet = new Set([...allowedOrigins, ...devOrigins]);
const allowAllOrigins = allowedOriginSet.size === 0;
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 120);
const requestBuckets = new Map();
const reebsPool = reebsDatabaseUrl
  ? new Pool({
      connectionString: reebsDatabaseUrl,
      ssl: { rejectUnauthorized: false },
    })
  : null;
const faakoPool = faakoDatabaseUrl
  ? new Pool({
      connectionString: faakoDatabaseUrl,
      ssl: { rejectUnauthorized: false },
    })
  : null;
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8080);
const jwtSecret = process.env.JWT_SECRET;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
const googleWebhookUrl = process.env.GOOGLE_WEBHOOK_URL;
const appBaseUrl = process.env.APP_BASE_URL;
const googleNightlySyncEnabled = ["true", "1", "yes", "on"].includes(
  String(process.env.GOOGLE_NIGHTLY_SYNC_ENABLED ?? "").trim().toLowerCase()
);
const googleNightlySyncHour = Number(process.env.GOOGLE_NIGHTLY_SYNC_HOUR ?? 2);
const googleNightlySyncMinute = Number(process.env.GOOGLE_NIGHTLY_SYNC_MINUTE ?? 0);
const SITE_STATUS_TIMEOUT_MS = Number(process.env.SITE_STATUS_TIMEOUT_MS ?? 6500);
const SITE_STATUS_CACHE_TTL_MS = Number(process.env.SITE_STATUS_CACHE_TTL_MS ?? 5 * 60 * 1000);
const SITE_STATUS_USER_AGENT =
  process.env.SITE_STATUS_USER_AGENT ?? "bynana-portfolio-status/1.0 (+https://dev.nanaabaackah.com)";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar"];

const SITE_PAGES = [
  {
    id: "nana",
    title: "nanaabaackah.com",
    baseUrl: "https://nanaabaackah.com",
    pages: [
      { label: "Home", path: "/" },
      { label: "About", path: "/about" },
      { label: "Resume", path: "/resume" },
      { label: "Projects", path: "/projects" },
      { label: "Blog", path: "/blog" },
      { label: "Contact", path: "/contact" },
    ],
  },
  {
    id: "reebs",
    title: "reebspartythemes.com",
    baseUrl: "https://reebspartythemes.com",
    pages: [
      { label: "Home", path: "/" },
      { label: "Shop", path: "/shop" },
      { label: "Rentals", path: "/rentals" },
      { label: "Gallery", path: "/gallery" },
      { label: "FAQ", path: "/faq" },
      { label: "Contact", path: "/contact" },
      { label: "Book", path: "/book" },
    ],
  },
  {
    id: "reebs-portal",
    title: "portal.reebspartythemes.com",
    baseUrl: "https://portal.reebspartythemes.com",
    pages: [
      { label: "Admin dashboard", path: "/admin" },
      { label: "Inventory", path: "/admin/inventory" },
      { label: "CRM", path: "/admin/crm" },
      { label: "Customers", path: "/admin/customers" },
      { label: "Orders", path: "/admin/orders" },
      { label: "Order builder", path: "/admin/orders/new" },
      { label: "Bookings", path: "/admin/bookings" },
      { label: "Scheduler", path: "/admin/schedule" },
      { label: "Accounting", path: "/admin/accounting" },
      { label: "Invoicing", path: "/admin/invoicing" },
      { label: "Directory", path: "/admin/directory" },
      { label: "Users", path: "/admin/users" },
      { label: "Employees", path: "/admin/employees" },
      { label: "Expenses", path: "/admin/expenses" },
      { label: "HR", path: "/admin/hr" },
      { label: "Vendors", path: "/admin/vendors" },
      { label: "Maintenance", path: "/admin/maintenance" },
      { label: "Delivery", path: "/admin/delivery" },
      { label: "Documents", path: "/admin/documents" },
      { label: "Timesheets", path: "/admin/timesheets" },
      { label: "Roles", path: "/admin/roles" },
      { label: "Marketing", path: "/admin/marketing" },
      { label: "Settings", path: "/admin/settings" },
      { label: "Website template", path: "/admin/website-template" },
    ],
  },
  {
    id: "faako",
    title: "faako.nanaabaackah.com",
    baseUrl: "https://faako.nanaabaackah.com",
    pages: [
      { label: "Home", path: "/" },
      { label: "Pricing", path: "/pricing" },
      { label: "Signup", path: "/signup" },
    ],
  },
];

let siteStatusCache = { checkedAt: 0, data: null };

const classifyResponseStatus = (response) => {
  if (!response) return "offline";
  if (response.ok) return "online";
  if (response.status >= 500) return "offline";
  return "degraded";
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SITE_STATUS_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      headers: {
        "User-Agent": SITE_STATUS_USER_AGENT,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const checkUrlStatus = async (url) => {
  try {
    let response = await fetchWithTimeout(url, { method: "HEAD" });
    if ([405, 501].includes(response.status)) {
      response = await fetchWithTimeout(url, { method: "GET" });
    }
    return classifyResponseStatus(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      return "offline";
    }
    return "offline";
  }
};

const buildSiteStatus = async () => {
  const sites = await Promise.all(
    SITE_PAGES.map(async (site) => {
      const pages = await Promise.all(
        site.pages.map(async (page) => {
          const url = new URL(page.path, site.baseUrl).toString();
          const status = await checkUrlStatus(url);
          return { ...page, url, status };
        })
      );
      return { ...site, pages };
    })
  );
  return sites;
};

const buildSiteStatusFallback = (status = "unknown") =>
  SITE_PAGES.map((site) => ({
    ...site,
    pages: site.pages.map((page) => ({
      ...page,
      url: new URL(page.path, site.baseUrl).toString(),
      status,
    })),
  }));

const getAggregateStatus = (pages = []) => {
  if (!pages.length) return "unknown";
  if (pages.some((page) => page.status === "offline")) return "offline";
  if (pages.some((page) => page.status === "degraded")) return "degraded";
  if (pages.every((page) => page.status === "online")) return "online";
  return "unknown";
};

const getSiteStatus = async () => {
  const now = Date.now();
  if (siteStatusCache.data && now - siteStatusCache.checkedAt < SITE_STATUS_CACHE_TTL_MS) {
    return siteStatusCache;
  }
  const data = await buildSiteStatus();
  siteStatusCache = { data, checkedAt: now };
  return siteStatusCache;
};

const getRequestBaseUrl = (req) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const protocol =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.get("host");
  if (!host) return null;
  return `${protocol}://${host}`;
};

const isGoogleConfigured = () =>
  Boolean(googleClientId && googleClientSecret && googleRedirectUri);

const createGoogleClient = () =>
  new google.auth.OAuth2(googleClientId, googleClientSecret, googleRedirectUri);

const signGoogleState = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: "15m" });

const verifyGoogleState = (value) => {
  try {
    return jwt.verify(value, jwtSecret);
  } catch {
    return null;
  }
};

const normalizeEventStatus = (status) => {
  if (status === "cancelled") return "CANCELED";
  if (status === "tentative") return "TENTATIVE";
  return "CONFIRMED";
};

const normalizeBookingStatusForEvent = (status) => {
  if (status === "CANCELED") return "cancelled";
  if (status === "TENTATIVE") return "tentative";
  return "confirmed";
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

const buildGhanaHolidaySet = (year) => {
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const holidays = [
    new Date(year, 0, 1),
    new Date(year, 2, 6),
    goodFriday,
    easterMonday,
    new Date(year, 4, 1),
    new Date(year, 8, 21),
    getNthWeekday(year, 11, 5, 1),
    new Date(year, 11, 25),
    new Date(year, 11, 26),
  ];
  return new Set(
    holidays.map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      return key;
    })
  );
};

const isGhanaHoliday = (date) => {
  if (!date) return false;
  const year = date.getFullYear();
  const holidaySet = buildGhanaHolidaySet(year);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return holidaySet.has(key);
};

const buildEventDate = (dateTimeValue, dateValue) => {
  if (dateTimeValue) return new Date(dateTimeValue);
  if (dateValue) return new Date(`${dateValue}T00:00:00.000Z`);
  return null;
};

const pickAttendee = (event) => {
  const attendees = event.attendees || [];
  const attendee = attendees.find((item) => !item.self) || attendees[0];
  return {
    attendeeEmail: attendee?.email ?? null,
    attendeeName: attendee?.displayName ?? null,
  };
};

const extractMeetingLink = (event) =>
  event?.hangoutLink ||
  event?.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ||
  null;

const canAutoCreateMeetLink = (event) => {
  if (!event?.id) return false;
  if (!event?.start?.dateTime || !event?.end?.dateTime) return false;
  if (event.status === "cancelled") return false;
  return true;
};

const ensureGoogleMeetLink = async ({ calendar, calendarId, event }) => {
  const existing = extractMeetingLink(event);
  if (existing || !canAutoCreateMeetLink(event)) {
    return { event, meetingLink: existing };
  }

  try {
    const response = await calendar.events.patch({
      calendarId,
      eventId: event.id,
      conferenceDataVersion: 1,
      requestBody: {
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });
    const updatedEvent = response.data ?? event;
    return { event: updatedEvent, meetingLink: extractMeetingLink(updatedEvent) };
  } catch (error) {
    console.warn("Unable to auto-create Google Meet link", error);
    return { event, meetingLink: null };
  }
};

const getPrivateBookingId = (event) => {
  const raw = event?.extendedProperties?.private?.bookingId;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
};

const getCalendarClient = (integration) => {
  const auth = createGoogleClient();
  auth.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken ?? undefined,
    expiry_date: integration.tokenExpiry ? new Date(integration.tokenExpiry).getTime() : undefined,
  });

  auth.on("tokens", async (tokens) => {
    if (!tokens.access_token && !tokens.refresh_token) return;
    await prisma.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokens.access_token ?? integration.accessToken,
        refreshToken: tokens.refresh_token ?? integration.refreshToken,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : integration.tokenExpiry,
      },
    });
  });

  return { calendar: google.calendar({ version: "v3", auth }), auth };
};

const upsertBookingFromEvent = async ({ organizationId, event }) => {
  if (!event?.id || !event.start || !event.end) return null;
  const startAt = buildEventDate(event.start.dateTime, event.start.date);
  const endAt = buildEventDate(event.end.dateTime, event.end.date);
  if (!startAt || !endAt) return null;

  const { attendeeEmail, attendeeName } = pickAttendee(event);
  const meetingLink = extractMeetingLink(event);
  const bookingId = getPrivateBookingId(event);
  if (bookingId) {
    const existingBooking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId },
    });
    if (existingBooking) {
      return prisma.booking.update({
        where: { id: existingBooking.id },
        data: {
          title: event.summary || existingBooking.title,
          description: event.description || existingBooking.description,
          startAt,
          endAt,
          location: event.location || existingBooking.location,
          status: normalizeEventStatus(event.status),
          attendeeEmail,
          attendeeName,
          meetingLink,
          calendarEventId: event.id,
          calendarProvider: "GOOGLE_CALENDAR",
        },
      });
    }
  }
  const data = {
    organizationId,
    externalId: event.id,
    source: "GOOGLE_CALENDAR",
    title: event.summary || "Untitled event",
    description: event.description || null,
    startAt,
    endAt,
    location: event.location || null,
    meetingLink,
    calendarEventId: event.id,
    calendarProvider: "GOOGLE_CALENDAR",
    status: normalizeEventStatus(event.status),
    attendeeEmail,
    attendeeName,
  };

  return prisma.booking.upsert({
    where: {
      organizationId_externalId_source: {
        organizationId,
        externalId: event.id,
        source: "GOOGLE_CALENDAR",
      },
    },
    create: data,
    update: data,
  });
};

const buildGoogleEventPayload = (booking, { createConference = false } = {}) => {
  const requestBody = {
    summary: booking.title,
    description: booking.description || undefined,
    start: { dateTime: new Date(booking.startAt).toISOString() },
    end: { dateTime: new Date(booking.endAt).toISOString() },
    location: booking.location || undefined,
    status: normalizeBookingStatusForEvent(booking.status),
    extendedProperties: {
      private: { bookingId: String(booking.id) },
    },
  };

  if (booking.attendeeEmail) {
    requestBody.attendees = [
      {
        email: booking.attendeeEmail,
        displayName: booking.attendeeName || undefined,
      },
    ];
  }

  if (createConference) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  return requestBody;
};

const createGoogleCalendarEvent = async (integration, booking) => {
  const { calendar } = getCalendarClient(integration);
  const response = await calendar.events.insert({
    calendarId: integration.calendarId || "primary",
    conferenceDataVersion: 1,
    requestBody: buildGoogleEventPayload(booking, { createConference: true }),
  });
  return {
    eventId: response.data.id ?? null,
    meetingLink: extractMeetingLink(response.data),
  };
};

const updateGoogleCalendarEvent = async (integration, booking, { createConference = false } = {}) => {
  const { calendar } = getCalendarClient(integration);
  const response = await calendar.events.patch({
    calendarId: integration.calendarId || "primary",
    eventId: booking.calendarEventId,
    conferenceDataVersion: 1,
    requestBody: buildGoogleEventPayload(booking, { createConference }),
  });
  return {
    eventId: response.data.id ?? booking.calendarEventId,
    meetingLink: extractMeetingLink(response.data),
  };
};

const stopGoogleWatch = async (integration) => {
  if (!integration.channelId || !integration.channelResourceId) return;
  const { calendar } = getCalendarClient(integration);
  await calendar.channels.stop({
    requestBody: {
      id: integration.channelId,
      resourceId: integration.channelResourceId,
    },
  });
};

const syncGoogleCalendar = async (integration) => {
  const { calendar } = getCalendarClient(integration);
  const calendarId = integration.calendarId || "primary";
  const timeMin = integration.lastSyncedAt
    ? new Date(new Date(integration.lastSyncedAt).getTime() - 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    conferenceDataVersion: 1,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500,
  });

  const events = response.data.items ?? [];
  const eventIds = events.map((event) => event.id).filter(Boolean);
  const existingBookings = eventIds.length
    ? await prisma.booking.findMany({
        where: {
          organizationId: integration.organizationId,
          source: "GOOGLE_CALENDAR",
          externalId: { in: eventIds },
        },
        select: { externalId: true },
      })
    : [];
  const existingSet = new Set(existingBookings.map((booking) => booking.externalId));
  let created = 0;
  let updated = 0;

  for (const event of events) {
    let eventToUse = event;
    if (!extractMeetingLink(event)) {
      const meetResult = await ensureGoogleMeetLink({
        calendar,
        calendarId,
        event,
      });
      eventToUse = meetResult.event || event;
    }
    await upsertBookingFromEvent({
      organizationId: integration.organizationId,
      event: eventToUse,
    });
    if (existingSet.has(event.id)) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: { lastSyncedAt: new Date() },
  });

  return { synced: events.length, created, updated };
};

const ensureGoogleWatch = async (integration) => {
  if (!googleWebhookUrl) return null;
  const { calendar } = getCalendarClient(integration);
  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomUUID();

  const response = await calendar.events.watch({
    calendarId: integration.calendarId || "primary",
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: googleWebhookUrl,
      token: channelToken,
      params: { ttl: "604800" },
    },
  });

  const expiration = response.data.expiration ? new Date(Number(response.data.expiration)) : null;

  return {
    channelId,
    channelToken,
    channelResourceId: response.data.resourceId ?? null,
    channelExpiration: expiration,
  };
};

const runNightlyGoogleSync = async () => {
  if (!googleNightlySyncEnabled) return;
  try {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { provider: "GOOGLE_CALENDAR" },
    });
    if (!integrations.length) return;
    const results = await Promise.allSettled(
      integrations.map((integration) => syncGoogleCalendar(integration))
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) {
      console.warn(`Nightly Google sync completed with ${failures.length} failure(s).`);
    } else {
      console.info(`Nightly Google sync completed for ${integrations.length} calendar(s).`);
    }
  } catch (error) {
    console.error("Nightly Google sync failed", error);
  }
};

const scheduleNightlyGoogleSync = () => {
  if (!googleNightlySyncEnabled) return;
  if (!Number.isFinite(googleNightlySyncHour) || !Number.isFinite(googleNightlySyncMinute)) {
    console.warn("Nightly Google sync skipped: invalid schedule configuration.");
    return;
  }

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(googleNightlySyncHour, googleNightlySyncMinute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const delay = Math.max(next.getTime() - now.getTime(), 0);
    setTimeout(async () => {
      await runNightlyGoogleSync();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
};

const fetchErpMetrics = async (poolInstance, label) => {
  if (!poolInstance) {
    return {
      organizations: 0,
      users: 0,
      inventoryItems: 0,
      status: "not_configured",
    };
  }
  try {
    const [orgsResult, usersResult, inventoryResult] = await Promise.all([
      poolInstance.query('SELECT COUNT(*)::int AS count FROM "organization"'),
      poolInstance.query('SELECT COUNT(*)::int AS count FROM "user"'),
      poolInstance.query('SELECT COUNT(*)::int AS count FROM "product"'),
    ]);
    return {
      organizations: orgsResult.rows[0]?.count ?? 0,
      users: usersResult.rows[0]?.count ?? 0,
      inventoryItems: inventoryResult.rows[0]?.count ?? 0,
      status: "ok",
    };
  } catch (error) {
    console.warn(`${label} KPI query failed`, error);
    return {
      organizations: 0,
      users: 0,
      inventoryItems: 0,
      status: "error",
    };
  }
};

const resolveTableCount = async (poolInstance, tableNames) => {
  const tableResult = await poolInstance.query(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name = ANY($1) ORDER BY CASE WHEN table_schema = 'public' THEN 0 ELSE 1 END, table_schema",
    [tableNames]
  );

  if (!tableResult.rows.length) {
    return { count: 0, qualifiedName: null };
  }

  let fallback = null;
  for (const row of tableResult.rows) {
    const qualifiedName = `\"${row.table_schema}\".\"${row.table_name}\"`;
    const countResult = await poolInstance.query(
      `SELECT COUNT(*)::int AS count FROM ${qualifiedName}`
    );
    const count = countResult.rows[0]?.count ?? 0;
    if (!fallback) {
      fallback = { count, qualifiedName };
    }
    if (count > 0) {
      return { count, qualifiedName };
    }
  }

  return fallback ?? { count: 0, qualifiedName: null };
};

const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME ?? "bynana-portfolio";
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? "bynana-portfolio";
const FAAKO_ORG_NAME = process.env.FAAKO_ORG_NAME ?? "Faako";
const FAAKO_ORG_SLUG = process.env.FAAKO_ORG_SLUG ?? "faako";
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? "dev@nanaabaackah.com";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? "Th@Tr$$1142!";
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS ?? 15 * 60 * 1000);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const coerceBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ["true", "1", "yes", "on"].includes(normalized);
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseRecipients = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => EMAIL_PATTERN.test(item));
  }
  const normalized = String(value || "").trim();
  if (!normalized) return [];
  return normalized
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter((item) => EMAIL_PATTERN.test(item));
};

const normalizeAlertPreferences = (input = {}, base = {}) => {
  const emailRecipients = parseRecipients(
    input.emailRecipients ?? base.emailRecipients ?? DEFAULT_ADMIN_EMAIL
  );
  return {
    emailEnabled: coerceBoolean(input.emailEnabled, base.emailEnabled ?? false),
    notifyOffline: coerceBoolean(input.notifyOffline, base.notifyOffline ?? true),
    notifyDegraded: coerceBoolean(input.notifyDegraded, base.notifyDegraded ?? true),
    emailRecipients: emailRecipients.length ? emailRecipients : parseRecipients(DEFAULT_ADMIN_EMAIL),
    fromEmail: String(input.fromEmail ?? base.fromEmail ?? DEFAULT_ADMIN_EMAIL).trim(),
  };
};

const serializeAlertPreferences = (prefs, lastEmailSentAt = null) => ({
  emailEnabled: prefs.emailEnabled,
  notifyOffline: prefs.notifyOffline,
  notifyDegraded: prefs.notifyDegraded,
  emailRecipients: prefs.emailRecipients.join(", "),
  fromEmail: prefs.fromEmail,
  lastEmailSentAt,
});

let alertPreferences = normalizeAlertPreferences({
  emailEnabled: coerceBoolean(process.env.ALERT_EMAIL_ENABLED, false),
  notifyOffline: coerceBoolean(process.env.ALERT_NOTIFY_OFFLINE, true),
  notifyDegraded: coerceBoolean(process.env.ALERT_NOTIFY_DEGRADED, true),
  emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS ?? DEFAULT_ADMIN_EMAIL,
  fromEmail: process.env.ALERT_FROM_EMAIL ?? DEFAULT_ADMIN_EMAIL,
});

const alertState = {
  snapshot: {},
  lastSentAt: {},
  lastEmailSentAt: null,
};

const getAlertLevel = (status) => {
  if (status === "offline" || status === "error") return "offline";
  if (status === "degraded") return "degraded";
  return null;
};

const shouldNotifyLevel = (level, prefs) => {
  if (!level) return false;
  if (level === "offline") return prefs.notifyOffline;
  if (level === "degraded") return prefs.notifyDegraded;
  return false;
};

const buildAlertEntries = (systemEntries, siteOverview) => [
  ...systemEntries.map((entry) => ({
    key: `service:${entry.id}`,
    label: entry.label,
    status: entry.status,
    note: entry.note,
    type: "Service",
  })),
  ...siteOverview.map((site) => ({
    key: `site:${site.id}`,
    label: site.title,
    status: site.aggregateStatus,
    note: `${site.pages.length} pages tracked`,
    type: "Site",
  })),
];

const buildAlertEmailContent = (changes) => {
  const lines = changes.map(
    (change) =>
      `- ${change.type}: ${change.label} -> ${change.status.toUpperCase()} (${change.note})`
  );
  const text = `Dev KPI alert\n\n${lines.join("\n")}\n\nGenerated at ${new Date().toISOString()}`;
  const htmlList = changes
    .map(
      (change) =>
        `<li><strong>${change.type}:</strong> ${change.label} <strong>${change.status.toUpperCase()}</strong> (${change.note})</li>`
    )
    .join("");
  const html = `<p><strong>Dev KPI alert</strong></p><ul>${htmlList}</ul><p>Generated at ${new Date().toISOString()}</p>`;
  return { text, html };
};

const sendAlertEmail = async ({ subject, text, html, recipients }) => {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const result = await resend.emails.send({
    from: alertPreferences.fromEmail,
    to: recipients,
    subject,
    text,
    html,
  });
  alertState.lastEmailSentAt = new Date().toISOString();
  return result;
};

const maybeSendStatusAlerts = (systemEntries, siteOverview) => {
  const entries = buildAlertEntries(systemEntries, siteOverview);
  const nextSnapshot = {};
  const changes = [];
  const now = Date.now();

  entries.forEach((entry) => {
    nextSnapshot[entry.key] = entry.status;
    const previous = alertState.snapshot[entry.key];
    if (!previous || previous === entry.status) return;
    const level = getAlertLevel(entry.status);
    if (!shouldNotifyLevel(level, alertPreferences)) return;
    const lastSentAt = alertState.lastSentAt[entry.key] ?? 0;
    if (now - lastSentAt < ALERT_COOLDOWN_MS) return;
    changes.push(entry);
    alertState.lastSentAt[entry.key] = now;
  });

  alertState.snapshot = nextSnapshot;

  if (!alertPreferences.emailEnabled || !changes.length) return;
  if (!alertPreferences.emailRecipients.length) {
    console.warn("Alert email recipients missing; skipping email.");
    return;
  }

  const { text, html } = buildAlertEmailContent(changes);
  const subject = `Dev KPI alert (${changes.length})`;
  sendAlertEmail({ subject, text, html, recipients: alertPreferences.emailRecipients }).catch(
    (error) => {
      console.error("Alert email failed", error);
    }
  );
};

if (!jwtSecret) {
  throw new Error("Missing JWT_SECRET in environment config.");
}

const authMiddleware = (req, res, next) => {
  const header = (req.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.roleName !== "Admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) {
        callback(null, true);
        return;
      }
      if (allowedOriginSet.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(
  express.json({
    limit: "1mb",
  })
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use((req, res, next) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(ip) || { count: 0, resetAt: now + rateLimitWindowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + rateLimitWindowMs;
  }
  bucket.count += 1;
  requestBuckets.set(ip, bucket);
  res.setHeader("X-RateLimit-Limit", String(rateLimitMax));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(rateLimitMax - bucket.count, 0)));
  res.setHeader("X-RateLimit-Reset", String(bucket.resetAt));
  if (bucket.count > rateLimitMax) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  next();
});

const buildToken = (user) => {
  const payload = {
    userId: user.id,
    organizationId: user.organizationId,
    roleId: user.roleId,
    roleName: user.role.name,
    email: user.email,
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "12h" });
};

app.post("/api/auth/login", async (req, res) => {
  const email = (req.body?.email || "").toLowerCase().trim();
  const password = (req.body?.password || "").trim();
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = buildToken(user);
  const safeUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    role: { id: user.role.id, name: user.role.name },
    organizationId: user.organizationId,
  };
  res.json({ token, user: safeUser });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = (req.body?.email || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: "Email is required to recover your login." });
  }
  console.info(`Password reset requested for ${email}`);
  res.json({
    message: "If that address exists in our system, we will email you instructions shortly.",
    supportEmail: DEFAULT_ADMIN_EMAIL,
  });
});

app.get("/api/users/me", authMiddleware, async (req, res) => {
  const { userId } = req.user;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    email: user.email,
    role: { id: user.role.id, name: user.role.name },
  });
});

app.get("/api/users", authMiddleware, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: { id: user.role.id, name: user.role.name },
    }))
  );
});

app.post("/api/users", authMiddleware, requireAdmin, async (req, res) => {
  const { email, firstName, lastName, roleName, password } = req.body;
  if (!email || !firstName || !lastName || !roleName) {
    return res.status(400).json({ error: "Missing required properties" });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(400).json({ error: "Email is already registered" });
  }
  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) {
    return res.status(404).json({ error: "Role not found" });
  }
  const hashed = await bcrypt.hash(password || DEFAULT_ADMIN_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      password: hashed,
      roleId: role.id,
      organizationId: req.user.organizationId,
    },
    include: { role: true },
  });
  res.status(201).json({
    id: user.id,
    email: user.email,
    role: { id: user.role.id, name: user.role.name },
  });
});

app.get("/api/roles", authMiddleware, async (req, res) => {
  const roles = await prisma.role.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { name: "asc" },
  });
  res.json(roles.map((role) => ({ id: role.id, name: role.name, description: role.description })));
});

app.get("/api/alerts/preferences", authMiddleware, requireAdmin, (req, res) => {
  res.json(serializeAlertPreferences(alertPreferences, alertState.lastEmailSentAt));
});

app.post("/api/alerts/preferences", authMiddleware, requireAdmin, (req, res) => {
  alertPreferences = normalizeAlertPreferences(req.body, alertPreferences);
  res.json(serializeAlertPreferences(alertPreferences, alertState.lastEmailSentAt));
});

app.post("/api/alerts/test-email", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const recipients = parseRecipients(
      req.body?.emailRecipients ?? alertPreferences.emailRecipients
    );
    if (!alertPreferences.emailEnabled) {
      return res.status(400).json({ error: "Email alerts are disabled" });
    }
    if (!recipients.length) {
      return res.status(400).json({ error: "No email recipients configured" });
    }
    const subject = "Dev KPI test alert";
    const text = `This is a test alert from the Dev KPI dashboard (${new Date().toISOString()}).`;
    const html = `<p><strong>This is a test alert</strong> from the Dev KPI dashboard.</p><p>${new Date().toISOString()}</p>`;
    await sendAlertEmail({ subject, text, html, recipients });
    res.json({ ok: true, sentAt: alertState.lastEmailSentAt });
  } catch (error) {
    console.error("Unable to send test email", error);
    res.status(500).json({ error: error.message || "Unable to send test email" });
  }
});

app.get("/api/dashboard", authMiddleware, async (req, res) => {
  const [portfolioUsers, portfolioOrgs] = await Promise.all([
    prisma.user.count({ where: { organizationId: req.user.organizationId } }),
    prisma.organization.count(),
  ]);

  let reebsOrgs = 0;
  let reebsUsers = 0;
  let reebsInventory = 0;
  let reebsStatus = reebsPool ? "ok" : "not_configured";

  if (reebsPool) {
    try {
      const [orgsResult, usersResult, inventoryResult] = await Promise.all([
        reebsPool.query('SELECT COUNT(*)::int AS count FROM "organization"'),
        reebsPool.query('SELECT COUNT(*)::int AS count FROM "user"'),
        reebsPool.query('SELECT COUNT(*)::int AS count FROM "product"'),
      ]);
      reebsOrgs = orgsResult.rows[0]?.count ?? 0;
      reebsUsers = usersResult.rows[0]?.count ?? 0;
      reebsInventory = inventoryResult.rows[0]?.count ?? 0;
    } catch (error) {
      console.warn("Reebs KPI query failed", error);
      reebsStatus = "error";
    }
  }

  let faakoOrgs = 0;
  let faakoUsers = 0;
  let faakoStatus = faakoPool ? "ok" : "not_configured";
  if (faakoPool) {
    try {
      const [orgsResult, usersResult] = await Promise.all([
        resolveTableCount(faakoPool, ["Organization", "organization"]),
        resolveTableCount(faakoPool, ["User", "user"]),
      ]);
      faakoOrgs = orgsResult.count ?? 0;
      faakoUsers = usersResult.count ?? 0;
      if (!orgsResult.qualifiedName || !usersResult.qualifiedName) {
        faakoStatus = "error";
      }
    } catch (error) {
      console.warn("Faako KPI query failed", error);
      faakoStatus = "error";
    }
  }

  const [roleBreakdown, userStatusBreakdown, organizationStatusBreakdown] =
    await Promise.all([
      prisma.role.findMany({
        where: { organizationId: req.user.organizationId },
        select: {
          name: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.groupBy({
        by: ["status"],
        where: { organizationId: req.user.organizationId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      prisma.organization.groupBy({
        by: ["status"],
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
    ]);

  const averageUsersPerOrg = portfolioOrgs > 0 ? Number((portfolioUsers / portfolioOrgs).toFixed(1)) : 0;
  const inventoryPerReebsUser = reebsUsers > 0 ? Number((reebsInventory / reebsUsers).toFixed(1)) : 0;

  let siteStatusPayload = null;
  let siteStatusCheckedAt = null;
  try {
    const siteStatus = await getSiteStatus();
    siteStatusPayload = siteStatus?.data ?? buildSiteStatusFallback("unknown");
    siteStatusCheckedAt = siteStatus?.checkedAt
      ? new Date(siteStatus.checkedAt).toISOString()
      : null;
  } catch (error) {
    console.warn("Site status check failed", error);
    siteStatusPayload = buildSiteStatusFallback("unknown");
  }

  const systemEntries = [
    { id: "api", label: "API", status: "ok", note: "Auth + metrics" },
    { id: "portfolio", label: "Portfolio DB", status: "ok", note: "Primary org data" },
    { id: "reebs", label: "Reebs DB", status: reebsStatus, note: "Products and inventory" },
    { id: "faako", label: "Faako DB", status: faakoStatus, note: "ERP users" },
  ];

  const siteOverview = (siteStatusPayload ?? []).map((site) => ({
    id: site.id,
    title: site.title,
    pages: site.pages ?? [],
    aggregateStatus: getAggregateStatus(site.pages ?? []),
  }));

  maybeSendStatusAlerts(systemEntries, siteOverview);

  res.json({
    totalOrganizations: portfolioOrgs + reebsOrgs + faakoOrgs,
    totalUsers: portfolioUsers + reebsUsers + faakoUsers,
    totalInventoryItems: reebsInventory,
    portfolio: {
      organizations: portfolioOrgs,
      users: portfolioUsers,
    },
    reebs: {
      organizations: reebsOrgs,
      users: reebsUsers,
      inventoryItems: reebsInventory,
    },
    faako: {
      organizations: faakoOrgs,
      users: faakoUsers,
    },
    lastSyncedAt: new Date().toISOString(),
    status: {
      api: "ok",
      portfolioDb: "ok",
      reebsDb: reebsStatus,
      faakoDb: faakoStatus,
    },
    siteStatus: {
      checkedAt: siteStatusCheckedAt,
      sites: siteStatusPayload,
    },
    roleBreakdown: roleBreakdown.map((role) => ({
      name: role.name,
      users: role._count?.users ?? 0,
    })),
    userStatusBreakdown: userStatusBreakdown.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    organizationStatusBreakdown: organizationStatusBreakdown.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    insights: {
      averageUsersPerOrg,
      inventoryPerReebsUser,
    },
  });
});

const BOOKING_STATUS_VALUES = new Set(["CONFIRMED", "TENTATIVE", "CANCELED"]);

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const normalizeBookingStatus = (value) =>
  BOOKING_STATUS_VALUES.has(value) ? value : null;

const serializeBooking = (booking) => ({
  id: booking.id,
  title: booking.title,
  description: booking.description,
  startAt: booking.startAt.toISOString(),
  endAt: booking.endAt.toISOString(),
  location: booking.location,
  meetingLink: booking.meetingLink,
  status: booking.status,
  source: booking.source,
  attendeeEmail: booking.attendeeEmail,
  attendeeName: booking.attendeeName,
});

app.get("/api/bookings", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const where = { organizationId: req.user.organizationId };
  if (from || to) {
    where.startAt = {};
    if (from) {
      where.startAt.gte = new Date(from);
    }
    if (to) {
      where.startAt.lte = new Date(to);
    }
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "asc" },
  });
  res.json(bookings.map(serializeBooking));
});

app.get("/api/public/booking-settings/:orgSlug", async (req, res) => {
  const orgSlug = String(req.params.orgSlug || "").trim();
  if (!orgSlug) {
    return res.status(400).json({ error: "Organization slug is required." });
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!organization) {
    return res.status(404).json({ error: "Organization not found." });
  }

  const settings = await prisma.bookingSettings.findUnique({
    where: { organizationId: organization.id },
  });

  res.json({
    organizationName: organization.name,
    organizationSlug: organization.slug,
    bookingLink: settings?.bookingLink ?? "",
    defaultLocation: settings?.defaultLocation ?? "",
  });
});

app.get("/api/public/bookings/:orgSlug", async (req, res) => {
  const orgSlug = String(req.params.orgSlug || "").trim();
  if (!orgSlug) {
    return res.status(400).json({ error: "Organization slug is required." });
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!organization) {
    return res.status(404).json({ error: "Organization not found." });
  }

  const { from, to } = req.query;
  const where = {
    organizationId: organization.id,
    status: { not: "CANCELED" },
  };
  if (from || to) {
    where.startAt = {};
    if (from) {
      where.startAt.gte = new Date(from);
    }
    if (to) {
      where.startAt.lte = new Date(to);
    }
  }

  const bookings = await prisma.booking.findMany({
    where,
    select: { startAt: true, endAt: true, status: true },
    orderBy: { startAt: "asc" },
  });

  res.json(
    bookings.map((booking) => ({
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
    }))
  );
});

app.post("/api/public/bookings/:orgSlug", async (req, res) => {
  const orgSlug = String(req.params.orgSlug || "").trim();
  if (!orgSlug) {
    return res.status(400).json({ error: "Organization slug is required." });
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!organization) {
    return res.status(404).json({ error: "Organization not found." });
  }

  const {
    attendeeName,
    attendeeEmail,
    title,
    description,
    startAt,
    endAt,
    durationMinutes,
    company,
  } = req.body ?? {};

  if (typeof company === "string" && company.trim()) {
    return res.status(202).json({ ok: true });
  }

  const normalizedEmail = typeof attendeeEmail === "string" ? attendeeEmail.trim() : "";
  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const normalizedName = typeof attendeeName === "string" ? attendeeName.trim() : "";
  const normalizedTitle =
    typeof title === "string" && title.trim() ? title.trim() : "Appointment";
  const normalizedDescription =
    typeof description === "string" && description.trim() ? description.trim() : null;

  const startDate = parseDateValue(startAt);
  if (!startDate) {
    return res.status(400).json({ error: "Valid start time is required." });
  }
  const startDay = startDate.getDay();
  if (startDay === 0 || startDay === 6) {
    return res.status(400).json({ error: "Weekend bookings are not available." });
  }

  let endDate = parseDateValue(endAt);
  if (!endDate) {
    const minutes = Number(durationMinutes ?? 60);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
      return res.status(400).json({ error: "Valid duration is required." });
    }
    endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
  }

  if (endDate <= startDate) {
    return res.status(400).json({ error: "End time must be after start time." });
  }

  const minimumStart = new Date(Date.now() + 5 * 60 * 1000);
  if (startDate < minimumStart) {
    return res.status(400).json({ error: "Start time must be in the future." });
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      organizationId: organization.id,
      status: { not: "CANCELED" },
      startAt: { lt: endDate },
      endAt: { gt: startDate },
    },
  });
  if (conflict) {
    return res.status(409).json({ error: "That time slot is no longer available." });
  }

  const settings = await prisma.bookingSettings.findUnique({
    where: { organizationId: organization.id },
  });
  const location = settings?.defaultLocation ?? null;

  const booking = await prisma.booking.create({
    data: {
      organizationId: organization.id,
      title: normalizedTitle,
      description: normalizedDescription,
      startAt: startDate,
      endAt: endDate,
      location,
      status: "CONFIRMED",
      source: "MANUAL",
      attendeeEmail: normalizedEmail,
      attendeeName: normalizedName || null,
    },
  });

  let updatedBooking = booking;
  const integration = await prisma.calendarIntegration.findFirst({
    where: { organizationId: organization.id, provider: "GOOGLE_CALENDAR" },
  });
  if (integration) {
    try {
      const { meetingLink, eventId } = await createGoogleCalendarEvent(integration, booking);
      updatedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          meetingLink,
          calendarEventId: eventId,
          calendarProvider: "GOOGLE_CALENDAR",
        },
      });
    } catch (error) {
      console.warn("Unable to create Google Calendar event for public booking", error);
    }
  }

  res.status(201).json(serializeBooking(updatedBooking));
});

app.post("/api/bookings", authMiddleware, requireAdmin, async (req, res) => {
  const {
    title,
    description,
    startAt,
    endAt,
    location,
    status,
    attendeeEmail,
    attendeeName,
  } = req.body ?? {};

  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (!normalizedTitle) {
    return res.status(400).json({ error: "Title is required" });
  }

  const startDate = parseDateValue(startAt);
  const endDate = parseDateValue(endAt);
  if (!startDate || !endDate || endDate <= startDate) {
    return res.status(400).json({ error: "Valid start and end times are required" });
  }

  const normalizedStatus = normalizeBookingStatus(status) ?? "CONFIRMED";

  const booking = await prisma.booking.create({
    data: {
      organizationId: req.user.organizationId,
      title: normalizedTitle,
      description: typeof description === "string" ? description.trim() || null : null,
      startAt: startDate,
      endAt: endDate,
      location: typeof location === "string" ? location.trim() || null : null,
      status: normalizedStatus,
      source: "MANUAL",
      attendeeEmail: typeof attendeeEmail === "string" ? attendeeEmail.trim() || null : null,
      attendeeName: typeof attendeeName === "string" ? attendeeName.trim() || null : null,
    },
  });

  let updatedBooking = booking;
  if (normalizedStatus !== "CANCELED") {
    const integration = await prisma.calendarIntegration.findFirst({
      where: { organizationId: req.user.organizationId, provider: "GOOGLE_CALENDAR" },
    });
    if (integration) {
      try {
        const { meetingLink, eventId } = await createGoogleCalendarEvent(integration, booking);
        updatedBooking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            meetingLink,
            calendarEventId: eventId,
            calendarProvider: "GOOGLE_CALENDAR",
          },
        });
      } catch (error) {
        console.warn("Unable to create Google Calendar event for booking", error);
      }
    }
  }

  res.status(201).json(serializeBooking(updatedBooking));
});

app.patch("/api/bookings/:id", authMiddleware, requireAdmin, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, organizationId: req.user.organizationId },
  });
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (booking.source !== "MANUAL") {
    return res.status(400).json({ error: "Only manual bookings can be edited here" });
  }

  const {
    title,
    description,
    startAt,
    endAt,
    location,
    status,
    attendeeEmail,
    attendeeName,
  } = req.body ?? {};

  const updates = {};
  if (title !== undefined) {
    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    if (!normalizedTitle) {
      return res.status(400).json({ error: "Title is required" });
    }
    updates.title = normalizedTitle;
  }

  if (description !== undefined) {
    updates.description = typeof description === "string" ? description.trim() || null : null;
  }

  if (location !== undefined) {
    updates.location = typeof location === "string" ? location.trim() || null : null;
  }

  if (attendeeEmail !== undefined) {
    updates.attendeeEmail =
      typeof attendeeEmail === "string" ? attendeeEmail.trim() || null : null;
  }

  if (attendeeName !== undefined) {
    updates.attendeeName =
      typeof attendeeName === "string" ? attendeeName.trim() || null : null;
  }

  if (status !== undefined) {
    const normalizedStatus = normalizeBookingStatus(status);
    if (!normalizedStatus) {
      return res.status(400).json({ error: "Invalid booking status" });
    }
    updates.status = normalizedStatus;
  }

  const startDate = startAt !== undefined ? parseDateValue(startAt) : booking.startAt;
  const endDate = endAt !== undefined ? parseDateValue(endAt) : booking.endAt;
  if (!startDate || !endDate || endDate <= startDate) {
    return res.status(400).json({ error: "Valid start and end times are required" });
  }

  if (startAt !== undefined) {
    updates.startAt = startDate;
  }
  if (endAt !== undefined) {
    updates.endAt = endDate;
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: updates,
  });

  let syncedBooking = updated;
  const integration = await prisma.calendarIntegration.findFirst({
    where: { organizationId: req.user.organizationId, provider: "GOOGLE_CALENDAR" },
  });
  if (integration) {
    try {
      if (syncedBooking.calendarEventId) {
        const shouldCreateConference =
          !syncedBooking.meetingLink && syncedBooking.status !== "CANCELED";
        const { meetingLink, eventId } = await updateGoogleCalendarEvent(integration, syncedBooking, {
          createConference: shouldCreateConference,
        });
        syncedBooking = await prisma.booking.update({
          where: { id: syncedBooking.id },
          data: {
            meetingLink,
            calendarEventId: eventId,
            calendarProvider: "GOOGLE_CALENDAR",
          },
        });
      } else if (syncedBooking.status !== "CANCELED") {
        const { meetingLink, eventId } = await createGoogleCalendarEvent(integration, syncedBooking);
        syncedBooking = await prisma.booking.update({
          where: { id: syncedBooking.id },
          data: {
            meetingLink,
            calendarEventId: eventId,
            calendarProvider: "GOOGLE_CALENDAR",
          },
        });
      }
    } catch (error) {
      console.warn("Unable to sync Google Calendar event for booking", error);
    }
  }

  res.json(serializeBooking(syncedBooking));
});

app.get("/api/debug/faako", authMiddleware, requireAdmin, async (req, res) => {
  if (!faakoPool) {
    return res.status(400).json({ error: "FAAKO_DATABASE_URL is not configured." });
  }

  try {
    const schemasResult = await faakoPool.query(
      "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name"
    );
    const tablesResult = await faakoPool.query(
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' ORDER BY table_schema, table_name"
    );
    const orgResult = await resolveTableCount(faakoPool, ["Organization", "organization"]);
    const userResult = await resolveTableCount(faakoPool, ["User", "user"]);

    res.json({
      schemas: schemasResult.rows,
      tables: tablesResult.rows,
      organizationCount: orgResult,
      userCount: userResult,
    });
  } catch (error) {
    console.error("Faako debug failed", error);
    res.status(500).json({ error: error.message || "Faako debug failed" });
  }
});

app.get("/api/bookings/settings", authMiddleware, requireAdmin, async (req, res) => {
  const settings = await prisma.bookingSettings.findUnique({
    where: { organizationId: req.user.organizationId },
  });
  const integration = await prisma.calendarIntegration.findFirst({
    where: { organizationId: req.user.organizationId, provider: "GOOGLE_CALENDAR" },
  });
  res.json({
    bookingLink: settings?.bookingLink ?? "",
    calendarEmail: settings?.calendarEmail ?? "",
    defaultLocation: settings?.defaultLocation ?? "",
    googleConnected: Boolean(integration),
    lastSyncedAt: integration?.lastSyncedAt ?? null,
  });
});

app.post("/api/bookings/settings", authMiddleware, requireAdmin, async (req, res) => {
  const { bookingLink, calendarEmail, defaultLocation } = req.body ?? {};
  const settings = await prisma.bookingSettings.upsert({
    where: { organizationId: req.user.organizationId },
    update: {
      bookingLink: bookingLink?.trim() || null,
      calendarEmail: calendarEmail?.trim() || null,
      defaultLocation: defaultLocation?.trim() || null,
    },
    create: {
      organizationId: req.user.organizationId,
      bookingLink: bookingLink?.trim() || null,
      calendarEmail: calendarEmail?.trim() || null,
      defaultLocation: defaultLocation?.trim() || null,
    },
  });
  res.json({
    bookingLink: settings.bookingLink ?? "",
    calendarEmail: settings.calendarEmail ?? "",
    defaultLocation: settings.defaultLocation ?? "",
  });
});

app.post("/api/bookings/sync/google", authMiddleware, requireAdmin, async (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(500).json({ error: "Google Calendar integration is not configured." });
  }
  const integration = await prisma.calendarIntegration.findFirst({
    where: { organizationId: req.user.organizationId, provider: "GOOGLE_CALENDAR" },
  });
  if (!integration) {
    return res.status(404).json({ error: "Google Calendar is not connected yet." });
  }
  try {
    const result = await syncGoogleCalendar(integration);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("Google Calendar sync failed", error);
    res.status(500).json({ error: error.message || "Google Calendar sync failed" });
  }
});

app.post("/api/integrations/google/disconnect", authMiddleware, requireAdmin, async (req, res) => {
  const integration = await prisma.calendarIntegration.findFirst({
    where: { organizationId: req.user.organizationId, provider: "GOOGLE_CALENDAR" },
  });

  if (integration) {
    if (isGoogleConfigured()) {
      try {
        await stopGoogleWatch(integration);
      } catch (error) {
        console.warn("Google Calendar disconnect: stop watch failed", error);
      }

      const revokeToken = integration.refreshToken || integration.accessToken;
      if (revokeToken) {
        try {
          await createGoogleClient().revokeToken(revokeToken);
        } catch (error) {
          console.warn("Google Calendar disconnect: revoke failed", error);
        }
      }
    }

    await prisma.calendarIntegration.delete({ where: { id: integration.id } });
  }

  const deletedBookings = await prisma.booking.deleteMany({
    where: { organizationId: req.user.organizationId, source: "GOOGLE_CALENDAR" },
  });

  await prisma.bookingSettings.updateMany({
    where: { organizationId: req.user.organizationId },
    data: { calendarEmail: null },
  });

  res.json({
    ok: true,
    disconnected: Boolean(integration),
    googleConnected: false,
    calendarEmail: "",
    deletedBookings: deletedBookings.count,
  });
});

app.get("/api/integrations/google/init", authMiddleware, requireAdmin, (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(500).json({ error: "Missing Google Calendar credentials." });
  }
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
  const state = signGoogleState({
    organizationId: req.user.organizationId,
    returnTo,
  });
  const authUrl = createGoogleClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  });
  res.json({ url: authUrl });
});

app.get("/api/integrations/google/callback", async (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(500).send("Google Calendar credentials missing.");
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    return res.status(400).send("Missing authorization code.");
  }
  const decodedState = verifyGoogleState(state);
  if (!decodedState?.organizationId) {
    return res.status(400).send("Invalid state.");
  }

  try {
    const auth = createGoogleClient();
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    const calendar = google.calendar({ version: "v3", auth });
    const calendarList = await calendar.calendarList.list({ minAccessRole: "owner" });
    const primaryCalendar =
      calendarList.data.items?.find((item) => item.primary) || calendarList.data.items?.[0];
    const calendarId = primaryCalendar?.id ?? "primary";
    const calendarEmail = primaryCalendar?.id ?? null;

    const existing = await prisma.calendarIntegration.findFirst({
      where: {
        organizationId: decodedState.organizationId,
        provider: "GOOGLE_CALENDAR",
      },
    });

    const integration = await prisma.calendarIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: decodedState.organizationId,
          provider: "GOOGLE_CALENDAR",
        },
      },
      update: {
        accessToken: tokens.access_token ?? existing?.accessToken ?? "",
        refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : existing?.tokenExpiry ?? null,
        scope: tokens.scope ?? existing?.scope ?? null,
        email: calendarEmail ?? existing?.email ?? null,
        calendarId,
      },
      create: {
        organizationId: decodedState.organizationId,
        provider: "GOOGLE_CALENDAR",
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope ?? null,
        email: calendarEmail,
        calendarId,
      },
    });

    if (calendarEmail) {
      await prisma.bookingSettings.upsert({
        where: { organizationId: decodedState.organizationId },
        update: { calendarEmail },
        create: { organizationId: decodedState.organizationId, calendarEmail },
      });
    }

    const watch = await ensureGoogleWatch(integration);
    if (watch) {
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: watch,
      });
    }

    await syncGoogleCalendar(integration);

    if (decodedState.returnTo && appBaseUrl && decodedState.returnTo.startsWith("/")) {
      const redirectUrl = new URL(decodedState.returnTo, appBaseUrl);
      redirectUrl.searchParams.set("google", "connected");
      return res.redirect(redirectUrl.toString());
    }

    res.send("Google Calendar connected. You can close this tab.");
  } catch (error) {
    console.error("Google Calendar OAuth failed", error);
    res.status(500).send("Unable to connect Google Calendar.");
  }
});

app.post("/api/webhooks/google-calendar", async (req, res) => {
  const channelId = req.header("x-goog-channel-id");
  const resourceId = req.header("x-goog-resource-id");
  const channelToken = req.header("x-goog-channel-token");
  if (!channelId || !resourceId) {
    res.status(202).end();
    return;
  }

  const integration = await prisma.calendarIntegration.findFirst({
    where: {
      provider: "GOOGLE_CALENDAR",
      channelId,
      channelResourceId: resourceId,
    },
  });

  if (!integration) {
    res.status(202).end();
    return;
  }

  if (integration.channelToken && channelToken && integration.channelToken !== channelToken) {
    res.status(403).end();
    return;
  }

  res.status(200).end();

  syncGoogleCalendar(integration).catch((error) => {
    console.error("Google Calendar webhook sync failed", error);
  });
});

app.use((err, _req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Not allowed by CORS" });
    return;
  }
  next(err);
});

const ensureDefaults = async () => {
  const roles = [
    { name: "Admin", description: "Full access to every endpoint" },
    { name: "Editor", description: "Can update dashboard data and content" },
    { name: "Viewer", description: "Read-only access to dashboard" },
  ];

  const organizationDefinitions = [
    { name: DEFAULT_ORG_NAME, slug: DEFAULT_ORG_SLUG, seedAdmin: true },
    { name: FAAKO_ORG_NAME, slug: FAAKO_ORG_SLUG, seedAdmin: false },
  ].filter(
    (org, index, list) =>
      Boolean(org.slug) && list.findIndex((entry) => entry.slug === org.slug) === index
  );

  const seededOrganizations = [];

  for (const orgInfo of organizationDefinitions) {
    let organization = await prisma.organization.findUnique({ where: { slug: orgInfo.slug } });
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: orgInfo.name,
          slug: orgInfo.slug,
        },
      });
    }

    seededOrganizations.push({ organization, seedAdmin: orgInfo.seedAdmin });

    for (const role of roles) {
      await prisma.role.upsert({
        where: { organizationId_name: { organizationId: organization.id, name: role.name } },
        update: { description: role.description },
        create: {
          name: role.name,
          description: role.description,
          organizationId: organization.id,
        },
      });
    }
  }

  const adminOrganization = seededOrganizations.find((entry) => entry.seedAdmin)?.organization;
  if (!adminOrganization) return;

  const adminRole = await prisma.role.findFirst({
    where: { organizationId: adminOrganization.id, name: "Admin" },
  });
  if (!adminRole) return;

  const adminEmail = DEFAULT_ADMIN_EMAIL.toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: "Admin",
        lastName: "Portfolio",
        fullName: "Admin Portfolio",
        password: hashed,
        roleId: adminRole.id,
        organizationId: adminOrganization.id,
      },
    });
  }
};

const start = async () => {
  await ensureDefaults();
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
  scheduleNightlyGoogleSync();
};

start().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
