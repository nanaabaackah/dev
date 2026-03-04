export const createBuildToken = ({ jwt, jwtSecret }) => (user) => {
  const payload = {
    userId: user.id,
    organizationId: user.organizationId,
    roleId: user.roleId,
    roleName: user.role.name,
    email: user.email,
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

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = buildToken(user);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, { token, csrfToken });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: { id: user.role.id, name: user.role.name },
        organizationId: user.organizationId,
      },
      token,
    });
  };

export const createLogoutHandler =
  ({ clearAuthCookies }) =>
  (_req, res) => {
    clearAuthCookies(res);
    return res.json({ ok: true });
  };

export const createForgotPasswordHandler =
  ({ defaultAdminEmail }) =>
  async (req, res) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: "Email is required to recover your login." });
    }

    console.info(`Password reset requested for ${email}`);
    return res.json({
      message: "If that address exists in our system, we will email you instructions shortly.",
      supportEmail: defaultAdminEmail,
    });
  };
