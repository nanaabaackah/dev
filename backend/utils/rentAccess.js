const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeScopedEmail = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized || null;
};

const readUserRoleName = (user) => user?.roleName ?? user?.role?.name ?? "";

export const isRentManagerUser = (user) => {
  const roleName = normalizeRoleName(readUserRoleName(user));
  return roleName === "admin" || roleName === "landlord";
};

export const getManagedLandlordEmail = (user) => {
  if (normalizeRoleName(readUserRoleName(user)) !== "landlord") {
    return null;
  }

  return normalizeScopedEmail(user?.email);
};

export const buildRentTenantWhereForUser = (user) => {
  const baseWhere = { organizationId: user?.organizationId };
  const roleName = normalizeRoleName(readUserRoleName(user));

  if (roleName === "admin") {
    return baseWhere;
  }

  const scopedEmail = normalizeScopedEmail(user?.email);
  if (!scopedEmail) {
    return { ...baseWhere, id: -1 };
  }

  const emailField = roleName === "landlord" ? "landlordEmail" : "tenantEmail";

  return {
    ...baseWhere,
    [emailField]: {
      equals: scopedEmail,
      mode: "insensitive",
    },
  };
};
