const normalizeModuleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const extractRoleModules = (role) => {
  const modules = role?.permissions?.modules;
  if (!Array.isArray(modules)) return [];
  return Array.from(
    new Set(
      modules
        .map((item) => normalizeModuleName(item))
        .filter(Boolean)
    )
  );
};

export const createBuildToken = ({ jwt, jwtSecret }) => (user) => {
  const payload = {
    purpose: "session",
    userId: user.id,
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: "12h" });
};

export const createLoginHandler =
  ({ prisma, bcrypt, buildToken, createCsrfToken, setAuthCookies }) =>
  async (req, res) => {
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
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        error: "Your account is not active yet. Check your invitation email to set up your account.",
      });
    }

    if (!user.role) {
      console.error("Login blocked: user is missing a role assignment.", {
        userId: user.id,
        email,
      });
      return res.status(503).json({
        error: "Your account is not configured correctly. Contact an administrator.",
      });
    }

    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user.password);
    } catch (error) {
      console.error("Login password verification failed.", {
        userId: user.id,
        email,
        error: error?.message || error,
      });
      return res.status(503).json({
        error: "Your account is not configured correctly. Contact an administrator.",
      });
    }

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionToken = buildToken(user);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, { token: sessionToken, csrfToken });
    const allowedModules = extractRoleModules(user?.role);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions ?? null,
        },
        organizationId: user.organizationId,
        allowedModules,
      },
    });
  };

export const createLogoutHandler =
  ({ clearAuthCookies }) =>
  (_req, res) => {
    clearAuthCookies(res);
    return res.json({ ok: true });
  };

export const createForgotPasswordHandler =
  ({ defaultAdminEmail, prisma, sendForgotPasswordEmail }) =>
  async (req, res) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: "Email is required to recover your login." });
    }

    console.info(`Password reset requested for ${email}`);
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user && user.status !== "SUSPENDED" && typeof sendForgotPasswordEmail === "function") {
      try {
        await sendForgotPasswordEmail({ req, user });
      } catch (error) {
        console.error(`Failed to send password reset email for ${email}`, error);
      }
    }

    return res.json({
      message: "If that address exists in our system, we will email you instructions shortly.",
      supportEmail: defaultAdminEmail,
    });
  };

export const createSetupAccountVerifyHandler =
  ({ verifySetupTokenPayload, prisma }) =>
  async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Invitation token is required." });
    }

    const payload = verifySetupTokenPayload(token);
    if (!payload) {
      return res.status(400).json({ error: "Invalid or expired invitation token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user) {
      return res.status(404).json({ error: "Invitation account was not found." });
    }

    if (
      String(user.email || "").trim().toLowerCase() !== payload.email ||
      user.updatedAt.toISOString() !== payload.version
    ) {
      return res.status(400).json({ error: "This invitation is no longer valid." });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "This account is suspended. Contact an administrator." });
    }

    return res.json({
      ok: true,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: { id: user.role.id, name: user.role.name },
      },
    });
  };

export const createSetupAccountCompleteHandler =
  ({ verifySetupTokenPayload, validatePasswordStrength, passwordPolicyHint, prisma, bcrypt }) =>
  async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Invitation token is required." });
    }
    if (!password) {
      return res.status(400).json({ error: "password is required." });
    }

    const payload = verifySetupTokenPayload(token);
    if (!payload) {
      return res.status(400).json({ error: "Invalid or expired invitation token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      return res.status(404).json({ error: "Invitation account was not found." });
    }
    if (
      String(user.email || "").trim().toLowerCase() !== payload.email ||
      user.updatedAt.toISOString() !== payload.version
    ) {
      return res.status(400).json({ error: "This invitation is no longer valid." });
    }
    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "This account is suspended. Contact an administrator." });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.ok) {
      return res.status(400).json({
        error: passwordValidation.error,
        passwordPolicy: passwordPolicyHint,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        status: user.status === "PENDING" ? "ACTIVE" : user.status,
      },
    });

    return res.json({
      ok: true,
      message: "Account setup complete. You can now sign in.",
    });
  };
