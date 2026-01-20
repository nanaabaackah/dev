/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

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
const SITE_STATUS_TIMEOUT_MS = Number(process.env.SITE_STATUS_TIMEOUT_MS ?? 6500);
const SITE_STATUS_CACHE_TTL_MS = Number(process.env.SITE_STATUS_CACHE_TTL_MS ?? 5 * 60 * 1000);
const SITE_STATUS_USER_AGENT =
  process.env.SITE_STATUS_USER_AGENT ?? "bynana-portfolio-status/1.0 (+https://dev.nanaabaackah.com)";

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
    id: "faako",
    title: "faako.nanaabaackah.com",
    baseUrl: "https://faako.nanaabaackah.com",
    pages: [{ label: "Home", path: "/" }],
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

const getSiteStatus = async () => {
  const now = Date.now();
  if (siteStatusCache.data && now - siteStatusCache.checkedAt < SITE_STATUS_CACHE_TTL_MS) {
    return siteStatusCache;
  }
  const data = await buildSiteStatus();
  siteStatusCache = { data, checkedAt: now };
  return siteStatusCache;
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

const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME ?? "bynana-portfolio";
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG ?? "bynana-portfolio";
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? "dev@nanaabaackah.com";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? "Th@Tr$$1142!";

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
        faakoPool.query('SELECT COUNT(*)::int AS count FROM "organization"'),
        faakoPool.query('SELECT COUNT(*)::int AS count FROM "user"'),
      ]);
      faakoOrgs = orgsResult.rows[0]?.count ?? 0;
      faakoUsers = usersResult.rows[0]?.count ?? 0;
    } catch (error) {
      console.warn("Faako KPI query failed", error);
      faakoStatus = "error";
    }
  }

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
  let organization = await prisma.organization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
      },
    });
  }

  const roles = [
    { name: "Admin", description: "Full access to every endpoint" },
    { name: "Editor", description: "Can update dashboard data and content" },
    { name: "Viewer", description: "Read-only access to dashboard" },
  ];

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

  const adminRole = await prisma.role.findFirst({
    where: { organizationId: organization.id, name: "Admin" },
  });
  if (!adminRole) return;

  const existingAdmin = await prisma.user.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
        firstName: "Admin",
        lastName: "Portfolio",
        fullName: "Admin Portfolio",
        password: hashed,
        roleId: adminRole.id,
        organizationId: organization.id,
      },
    });
  }
};

const start = async () => {
  await ensureDefaults();
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
