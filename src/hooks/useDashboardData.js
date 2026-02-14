import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../api-url";
import { getApiErrorMessage, readJsonResponse } from "../utils/http";
import { buildUserScopedCacheKey, readOfflineCache, writeOfflineCache } from "../utils/offlineCache";

const useDashboardData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const response = await fetch(buildApiUrl("/api/dashboard"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          throw new Error(getApiErrorMessage(payload, "Unable to load dashboard"));
        }
        setData(payload);
        const cacheKey = buildUserScopedCacheKey("dashboard");
        writeOfflineCache(cacheKey, payload);
      } catch (err) {
        if (err.name !== "AbortError") {
          const cacheKey = buildUserScopedCacheKey("dashboard");
          const cached = readOfflineCache(cacheKey);
          if (cached?.payload) {
            setData(cached.payload);
            setError("Offline mode: showing your most recent dashboard snapshot.");
          } else {
            setError(err.message);
          }
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    reload: loadDashboard,
  };
};

export default useDashboardData;
