const normalizeModuleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const getAllowedModules = (user) => {
  const modulesFromRole = user?.role?.permissions?.modules;
  const modulesFromUser = user?.allowedModules;
  const source = Array.isArray(modulesFromRole)
    ? modulesFromRole
    : Array.isArray(modulesFromUser)
      ? modulesFromUser
      : [];

  return Array.from(new Set(source.map((module) => normalizeModuleName(module)).filter(Boolean)));
};

export const isModuleRestrictedUser = (user) => getAllowedModules(user).length > 0;

export const hasModuleAccess = (user, moduleKey) => {
  const normalizedKey = normalizeModuleName(moduleKey);
  if (!normalizedKey) return true;
  const allowedModules = getAllowedModules(user);
  if (!allowedModules.length) return true;
  return allowedModules.includes(normalizedKey);
};

export const isRentOnlyUser = (user) => {
  const allowedModules = getAllowedModules(user);
  return allowedModules.length === 1 && allowedModules[0] === "rent";
};

export const canAccessPath = (user, pathname) => {
  const path = String(pathname || "").trim();
  if (!path) return true;
  if (!isRentOnlyUser(user)) return true;
  return path === "/dashboard" || path === "/rent" || path === "/profile";
};
