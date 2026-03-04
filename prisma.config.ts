import dotenv from "dotenv";
import { defineConfig, env } from "@prisma/config";

const normalizeEnvironmentName = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "dev") return "development";
  if (normalized === "prod") return "production";
  return normalized;
};

const getRuntimeEnvironment = () =>
  normalizeEnvironmentName(process.env.NODE_ENV || process.env.APP_ENV || "development");

const loadEnvironmentConfig = () => {
  dotenv.config();
  const runtimeEnvironment = getRuntimeEnvironment();
  const envFile = `.env.${runtimeEnvironment}`;
  const loadedFile = dotenv.config({ path: envFile, override: true });
  if (loadedFile.error && loadedFile.error.code !== "ENOENT") {
    throw loadedFile.error;
  }
  return runtimeEnvironment;
};

const resolveDatabaseUrl = () => {
  const environment = loadEnvironmentConfig();
  const runtimeUrl =
    environment === "production"
      ? env("DATABASE_URL_PRODUCTION")
      : env("DATABASE_URL_DEVELOPMENT");
  return runtimeUrl || env("DATABASE_URL");
};

export default defineConfig({
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
