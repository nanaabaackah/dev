import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ReceiptItem, TaskSquare, Timer1 } from "iconsax-react";
import {
  FiBriefcase,
  FiCheckCircle,
  FiCircle,
  FiExternalLink,
  FiTrash2,
} from "react-icons/fi";
import { buildApiUrl } from "../api-url";
import { formatDateTime } from "../utils/formatters";
import { getApiErrorMessage, readJsonResponse } from "../utils/http";
import "./Productivity.css";

const RANGE_OPTIONS = [
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

const TODO_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

const TODO_PRIORITY_OPTIONS = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const JOB_WORK_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "freelance", label: "Freelance" },
  { value: "contract", label: "Contract" },
  { value: "full_time", label: "Full-time" },
];

const DEFAULT_JOB_SEARCH = "frontend developer react";

const buildTodayDate = () => new Date().toISOString().slice(0, 10);

const DEFAULT_SUMMARY = {
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

const DEFAULT_FORM = {
  entryDate: buildTodayDate(),
  plannedTasks: "5",
  completedTasks: "0",
  deepWorkMinutes: "0",
  focusBlocks: "0",
  blockers: "",
  energyLevel: "",
};

const DEFAULT_TODO_FORM = {
  title: "",
  dueAt: "",
  priority: "medium",
  notes: "",
};

const DEFAULT_JOBS_META = {
  source: "job-boards",
  search: "",
  workTypes: [],
  total: 0,
  warning: "",
  fetchedAt: null,
};

const DEFAULT_AI_PROMPT =
  "Create a high-impact plan for today based on my productivity metrics, open to-dos, and job list.";
const AI_PROMPT_MAX_LENGTH = 1600;

const toSafeNumberString = (value, fallback = "0") => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(Math.max(Math.trunc(parsed), 0));
};

const buildFormFromEntry = (entry) => ({
  entryDate: entry.entryDate || buildTodayDate(),
  plannedTasks: toSafeNumberString(entry.plannedTasks, "5"),
  completedTasks: toSafeNumberString(entry.completedTasks, "0"),
  deepWorkMinutes: toSafeNumberString(entry.deepWorkMinutes, "0"),
  focusBlocks: toSafeNumberString(entry.focusBlocks, "0"),
  blockers: entry.blockers || "",
  energyLevel:
    entry.energyLevel === null || entry.energyLevel === undefined
      ? ""
      : String(entry.energyLevel),
});

const formatEntryDate = (dateValue) => {
  if (!dateValue) return "No date";
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatTodoDue = (value) => {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatWorkType = (value) => {
  if (value === "full_time") return "Full-time";
  if (value === "contract") return "Contract";
  if (value === "freelance") return "Freelance";
  return "Role";
};

const priorityTone = (priority) => {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  if (priority === "low") return "info";
  return "info";
};

const Productivity = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("14d");
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [todoStatus, setTodoStatus] = useState("open");
  const [todoForm, setTodoForm] = useState(DEFAULT_TODO_FORM);
  const [todos, setTodos] = useState([]);
  const [todoLoading, setTodoLoading] = useState(true);
  const [todoSaving, setTodoSaving] = useState(false);
  const [todoError, setTodoError] = useState("");

  const [jobSearch, setJobSearch] = useState(DEFAULT_JOB_SEARCH);
  const [jobWorkType, setJobWorkType] = useState("all");
  const [jobs, setJobs] = useState([]);
  const [jobsMeta, setJobsMeta] = useState(DEFAULT_JOBS_META);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [aiReply, setAiReply] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState({ model: "", createdAt: null });

  const loadEntries = useCallback(
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
        const query = new URLSearchParams({ range: timeRange });
        const response = await fetch(buildApiUrl(`/api/productivity/entries?${query.toString()}`), {
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
          throw new Error(getApiErrorMessage(payload, "Unable to load productivity data"));
        }

        const nextEntries = Array.isArray(payload?.entries) ? payload.entries : [];
        setEntries(nextEntries);
        setSummary(payload?.summary || DEFAULT_SUMMARY);

        if (payload?.activeEntry) {
          setActiveEntryId(payload.activeEntry.id ?? null);
          setFormState(buildFormFromEntry(payload.activeEntry));
        } else {
          setActiveEntryId(null);
          setFormState((prev) => ({
            ...DEFAULT_FORM,
            entryDate: prev.entryDate || buildTodayDate(),
          }));
        }
      } catch (loadError) {
        setError(loadError.message || "Unable to load productivity data");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [navigate, timeRange]
  );

  const loadTodos = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      if (!silent) {
        setTodoLoading(true);
      }
      setTodoError("");

      try {
        const query = new URLSearchParams({ status: todoStatus });
        const response = await fetch(buildApiUrl(`/api/productivity/todos?${query.toString()}`), {
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
          throw new Error(getApiErrorMessage(payload, "Unable to load to-do list"));
        }

        setTodos(Array.isArray(payload?.todos) ? payload.todos : []);
      } catch (loadError) {
        setTodoError(loadError.message || "Unable to load to-do list");
      } finally {
        setTodoLoading(false);
      }
    },
    [navigate, todoStatus]
  );

  const fetchJobs = useCallback(
    async ({ search = "", workType = "all", silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      if (!silent) {
        setJobsLoading(true);
      }
      setJobsError("");

      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        if (workType && workType !== "all") query.set("workTypes", workType);
        query.set("limit", "12");

        const response = await fetch(buildApiUrl(`/api/jobs/recommendations?${query.toString()}`), {
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
          throw new Error(getApiErrorMessage(payload, "Unable to fetch jobs"));
        }

        setJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
        setJobsMeta(payload?.meta || DEFAULT_JOBS_META);
      } catch (loadError) {
        setJobsError(loadError.message || "Unable to fetch jobs");
      } finally {
        setJobsLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    fetchJobs({ search: DEFAULT_JOB_SEARCH, workType: "all", silent: true });
  }, [fetchJobs]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const energyAverage = useMemo(() => {
    const energyValues = entries
      .map((entry) => Number(entry.energyLevel))
      .filter((value) => Number.isFinite(value));
    if (!energyValues.length) return null;
    const total = energyValues.reduce((acc, value) => acc + value, 0);
    return Math.round((total / energyValues.length) * 10) / 10;
  }, [entries]);

  const openTodoCount = useMemo(() => todos.filter((todo) => !todo.isDone).length, [todos]);

  const aiContextPayload = useMemo(
    () => ({
      range: timeRange,
      summary: {
        plannedTasks: Number(summary.plannedTasks || 0),
        completedTasks: Number(summary.completedTasks || 0),
        deepWorkMinutes: Number(summary.deepWorkMinutes || 0),
        focusBlocks: Number(summary.focusBlocks || 0),
        completionRate: Number(summary.completionRate || 0),
        focusScore: Number(summary.focusScore || 0),
        streakDays: Number(summary.streakDays || 0),
        momentumLabel: summary.momentumLabel || "",
        entriesLogged: Number(summary.entriesLogged || 0),
      },
      entry: {
        entryDate: formState.entryDate || buildTodayDate(),
        plannedTasks: Number(formState.plannedTasks || 0),
        completedTasks: Number(formState.completedTasks || 0),
        deepWorkMinutes: Number(formState.deepWorkMinutes || 0),
        focusBlocks: Number(formState.focusBlocks || 0),
        blockers: formState.blockers || "",
        energyLevel: formState.energyLevel === "" ? null : Number(formState.energyLevel),
      },
      todos: todos.slice(0, 8).map((todo) => ({
        title: todo.title,
        priority: todo.priority,
        isDone: Boolean(todo.isDone),
        dueAt: todo.dueAt,
      })),
      jobs: jobs.slice(0, 6).map((job) => ({
        title: job.title,
        companyName: job.companyName,
        workType: job.workType,
        location: job.location,
        publishedAt: job.publishedAt,
      })),
    }),
    [formState, jobs, summary, timeRange, todos]
  );

  const handleField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const bumpMetric = (field, amount) => {
    setFormState((prev) => {
      const current = Math.max(Number(prev[field]) || 0, 0);
      return {
        ...prev,
        [field]: String(Math.max(current + amount, 0)),
      };
    });
  };

  const handleSelectEntry = (entry) => {
    setActiveEntryId(entry.id);
    setFormState(buildFormFromEntry(entry));
    setNotice(`Loaded ${formatEntryDate(entry.entryDate)} entry.`);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const payload = {
      entryDate: formState.entryDate || buildTodayDate(),
      plannedTasks: Number(formState.plannedTasks || 0),
      completedTasks: Number(formState.completedTasks || 0),
      deepWorkMinutes: Number(formState.deepWorkMinutes || 0),
      focusBlocks: Number(formState.focusBlocks || 0),
      blockers: formState.blockers,
      energyLevel: formState.energyLevel === "" ? null : Number(formState.energyLevel),
    };

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/api/productivity/entries"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(result, "Unable to save productivity entry"));
      }

      setActiveEntryId(result?.id ?? null);
      setFormState(buildFormFromEntry(result));
      setNotice("Productivity entry saved.");
      loadEntries({ silent: true });
    } catch (saveError) {
      setError(saveError.message || "Unable to save productivity entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTodoField = (field, value) => {
    setTodoForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTodo = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const title = todoForm.title.trim();
    if (!title) {
      setTodoError("Enter a to-do item.");
      return;
    }

    setTodoSaving(true);
    setTodoError("");

    try {
      const response = await fetch(buildApiUrl("/api/productivity/todos"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          dueAt: todoForm.dueAt || null,
          priority: todoForm.priority || null,
          notes: todoForm.notes || null,
        }),
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(result, "Unable to create to-do item"));
      }

      setTodoForm((prev) => ({ ...DEFAULT_TODO_FORM, priority: prev.priority }));
      setNotice("To-do added.");
      loadTodos({ silent: true });
    } catch (saveError) {
      setTodoError(saveError.message || "Unable to create to-do item");
    } finally {
      setTodoSaving(false);
    }
  };

  const handleToggleTodo = async (todo) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setTodoError("");

    try {
      const response = await fetch(buildApiUrl(`/api/productivity/todos/${todo.id}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isDone: !todo.isDone }),
      });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(result, "Unable to update to-do item"));
      }
      setNotice(result?.isDone ? "To-do completed." : "To-do reopened.");
      loadTodos({ silent: true });
    } catch (updateError) {
      setTodoError(updateError.message || "Unable to update to-do item");
    }
  };

  const handleDeleteTodo = async (todo) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setTodoError("");

    try {
      const response = await fetch(buildApiUrl(`/api/productivity/todos/${todo.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(result, "Unable to delete to-do item"));
      }
      setNotice("To-do removed.");
      loadTodos({ silent: true });
    } catch (deleteError) {
      setTodoError(deleteError.message || "Unable to delete to-do item");
    }
  };

  const handleJobSearchSubmit = (event) => {
    event.preventDefault();
    fetchJobs({ search: jobSearch, workType: jobWorkType });
  };

  const handleWorkTypeChange = (nextType) => {
    setJobWorkType(nextType);
    fetchJobs({ search: jobSearch, workType: nextType, silent: true });
  };

  const handleGenerateAiPlan = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError("Enter a prompt for the AI coach.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch(buildApiUrl("/api/ai/productivity-coach"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          context: aiContextPayload,
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error(getApiErrorMessage(payload, "Unable to generate AI guidance"));
      }

      setAiReply(String(payload?.reply || "").trim());
      setAiMeta({
        model: String(payload?.model || ""),
        createdAt: payload?.createdAt || new Date().toISOString(),
      });
    } catch (requestError) {
      setAiError(requestError.message || "Unable to generate AI guidance");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section className="page productivity-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Execution analytics</p>
          <h1>Productivity</h1>
          <p className="muted">
            {summary.entriesLogged || 0} logged day{summary.entriesLogged === 1 ? "" : "s"} in this
            window.
          </p>
        </div>
        <div className="header-actions productivity-page__actions">
          <div className="segmented" role="tablist" aria-label="Productivity range">
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
            className="button button-ghost"
            type="button"
            onClick={() => loadEntries({ silent: true })}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <Link className="button button-ghost" to="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading productivity tracker...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="notice is-success" role="status">
          {notice}
        </div>
      ) : null}

      <div className="productivity-page__columns">
        <div className="productivity-page__column productivity-page__column--left">
          <article className="panel productivity-overview">
            <div className="panel-header">
              <div>
                <h3>Snapshot</h3>
                <p className="muted">Window {timeRange.toUpperCase()}</p>
              </div>
              <span className="status-pill is-info">{summary.momentumLabel || "On track"}</span>
            </div>

            <div className="productivity-overview__cards">
              <div className="productivity-card">
                <span className="productivity-card__meta">
                  <TaskSquare size={14} variant="Linear" />
                  Completion
                </span>
                <div className="kpi-value">{summary.completionRate || 0}%</div>
                <span className="muted">
                  {summary.completedTasks || 0}/{summary.plannedTasks || 0}
                </span>
              </div>

              <div className="productivity-card">
                <span className="productivity-card__meta">
                  <Timer1 size={14} variant="Linear" />
                  Deep work
                </span>
                <div className="kpi-value">{summary.deepWorkMinutes || 0}m</div>
                <span className="muted">{summary.focusBlocks || 0} blocks</span>
              </div>

              <div className="productivity-card">
                <span className="productivity-card__meta">
                  <ReceiptItem size={14} variant="Linear" />
                  Focus score
                </span>
                <div className="kpi-value">{summary.focusScore || 0}</div>
                <span className="muted">{summary.streakDays || 0} day streak</span>
              </div>

              <div className="productivity-card">
                <span className="productivity-card__meta">Energy</span>
                <div className="kpi-value">{energyAverage ?? "--"}</div>
                <span className="muted">Avg 1-10</span>
              </div>
            </div>
          </article>

          <article className="panel productivity-todos">
            <div className="panel-header">
              <div>
                <h3>To-do list</h3>
                <p className="muted">{openTodoCount} open item{openTodoCount === 1 ? "" : "s"}</p>
              </div>
            </div>

            <form className="productivity-todos__composer" onSubmit={handleAddTodo}>
              <label className="form-field">
                <span>Task</span>
                <input
                  className="input"
                  type="text"
                  value={todoForm.title}
                  onChange={(event) => handleTodoField("title", event.target.value)}
                  placeholder="Add next task"
                  maxLength={160}
                />
              </label>
              <div className="productivity-todos__meta">
                <label className="form-field">
                  <span>Due</span>
                  <input
                    className="input"
                    type="date"
                    value={todoForm.dueAt}
                    onChange={(event) => handleTodoField("dueAt", event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Priority</span>
                  <select
                    className="input"
                    value={todoForm.priority}
                    onChange={(event) => handleTodoField("priority", event.target.value)}
                  >
                    {TODO_PRIORITY_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="button button-primary" type="submit" disabled={todoSaving}>
                {todoSaving ? "Adding..." : "Add to-do"}
              </button>
            </form>

            <div className="segmented productivity-todos__filters" role="tablist" aria-label="Todo status">
              {TODO_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segment ${todoStatus === option.value ? "is-active" : ""}`}
                  onClick={() => setTodoStatus(option.value)}
                  aria-pressed={todoStatus === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {todoError ? (
              <div className="notice is-error" role="alert">
                {todoError}
              </div>
            ) : null}

            {todoLoading ? (
              <div className="loading-card" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>Loading to-do list...</span>
              </div>
            ) : (
              <div className="list productivity-todos__list">
                {todos.length ? (
                  todos.map((todo) => (
                    <div
                      className={`list-row is-split productivity-todo-row ${todo.isDone ? "is-done" : ""}`}
                      key={todo.id}
                    >
                      <button
                        className="text-button productivity-todo-row__toggle"
                        type="button"
                        onClick={() => handleToggleTodo(todo)}
                        aria-label={todo.isDone ? "Mark as open" : "Mark as done"}
                      >
                        {todo.isDone ? <FiCheckCircle /> : <FiCircle />}
                      </button>
                      <div className="productivity-todo-row__content">
                        <span className="table-strong">{todo.title}</span>
                        <span className="muted">
                          {formatTodoDue(todo.dueAt)} • {todo.priority || "No priority"}
                        </span>
                      </div>
                      <span className={`status-pill is-${priorityTone(todo.priority)}`}>
                        {(todo.priority || "none").toUpperCase()}
                      </span>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => handleDeleteTodo(todo)}
                        aria-label="Delete to-do"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted">No to-dos in this view.</p>
                )}
              </div>
            )}
          </article>
        </div>

        <div className="productivity-page__column productivity-page__column--right">
          <article className="panel productivity-editor" id="entry-editor">
            <div className="panel-header">
              <div>
                <h3>Log day</h3>
                <p className="muted">Track tasks, deep work, and blockers.</p>
              </div>
              {activeEntryId ? <span className="status-pill is-success">Saved entry</span> : null}
            </div>

            <div className="productivity-editor__fields">
              <label className="form-field productivity-editor__field">
                <span>Date</span>
                <input
                  className="input"
                  type="date"
                  value={formState.entryDate}
                  onChange={(event) => handleField("entryDate", event.target.value)}
                />
              </label>
              <label className="form-field productivity-editor__field">
                <span>Planned</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={formState.plannedTasks}
                  onChange={(event) => handleField("plannedTasks", event.target.value)}
                />
              </label>
              <label className="form-field productivity-editor__field">
                <span>Done</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={formState.completedTasks}
                  onChange={(event) => handleField("completedTasks", event.target.value)}
                />
              </label>
              <label className="form-field productivity-editor__field">
                <span>Focus min</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={formState.deepWorkMinutes}
                  onChange={(event) => handleField("deepWorkMinutes", event.target.value)}
                />
              </label>
              <label className="form-field productivity-editor__field">
                <span>Blocks</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={formState.focusBlocks}
                  onChange={(event) => handleField("focusBlocks", event.target.value)}
                />
              </label>
              <label className="form-field productivity-editor__field">
                <span>Energy</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10"
                  value={formState.energyLevel}
                  onChange={(event) => handleField("energyLevel", event.target.value)}
                  placeholder="1-10"
                />
              </label>
            </div>

            <label className="form-field">
              <span>Blockers</span>
              <textarea
                className="input"
                value={formState.blockers}
                onChange={(event) => handleField("blockers", event.target.value)}
                placeholder="What is slowing execution?"
              />
            </label>

            <div className="productivity-quick-actions">
              <button
                className="button button-ghost"
                type="button"
                onClick={() => bumpMetric("deepWorkMinutes", 25)}
              >
                +25m focus
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => bumpMetric("completedTasks", 1)}
              >
                +1 task
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => bumpMetric("focusBlocks", 1)}
              >
                +1 block
              </button>
            </div>

            <div className="productivity-editor__footer">
              <span className="muted">
                Last update {entries[0]?.updatedAt ? formatDateTime(entries[0].updatedAt) : "N/A"}
              </span>
              <button
                className="button button-primary"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save entry"}
              </button>
            </div>
          </article>

          <article className="panel productivity-jobs">
            <div className="panel-header">
              <div>
                <h3>
                  <FiBriefcase /> Recommended jobs
                </h3>
                <p className="muted">Freelance, contract, and full-time roles.</p>
              </div>
            </div>

            <form className="productivity-jobs__search" onSubmit={handleJobSearchSubmit}>
              <label className="form-field">
                <span>Role keywords</span>
                <input
                  className="input"
                  type="text"
                  value={jobSearch}
                  onChange={(event) => setJobSearch(event.target.value)}
                  placeholder="react frontend, product designer, devops"
                />
              </label>
              <button className="button button-primary" type="submit" disabled={jobsLoading}>
                {jobsLoading ? "Searching..." : "Find jobs"}
              </button>
            </form>

            <div className="segmented productivity-jobs__types" role="tablist" aria-label="Job type">
              {JOB_WORK_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segment ${jobWorkType === option.value ? "is-active" : ""}`}
                  onClick={() => handleWorkTypeChange(option.value)}
                  aria-pressed={jobWorkType === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {jobsError ? (
              <div className="notice is-error" role="alert">
                {jobsError}
              </div>
            ) : null}

            {jobsMeta.warning ? <div className="notice">{jobsMeta.warning}</div> : null}

            {jobsLoading ? (
              <div className="loading-card" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>Loading recommendations...</span>
              </div>
            ) : (
              <div className="productivity-jobs__list">
                {jobs.length ? (
                  jobs.map((job) => (
                    <article className="productivity-job-card" key={job.id}>
                      <div className="productivity-job-card__meta">
                        <span className="status-pill is-info">{formatWorkType(job.workType)}</span>
                        <span className="muted">{job.source}</span>
                      </div>
                      <div className="table-strong">{job.title}</div>
                      <div className="muted">
                        {job.companyName} • {job.location}
                      </div>
                      {job.salary ? <div className="muted">{job.salary}</div> : null}
                      <div className="productivity-job-card__footer">
                        <span className="muted">
                          {job.publishedAt ? formatDateTime(job.publishedAt) : "Recent listing"}
                        </span>
                        <a className="button button-ghost" href={job.jobUrl} target="_blank" rel="noreferrer">
                          <FiExternalLink />
                          Apply
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">No roles found for this filter yet.</p>
                )}
              </div>
            )}
          </article>

          <article className="panel productivity-ai">
            <div className="panel-header">
              <div>
                <h3>AI coach</h3>
                <p className="muted">Generate a focused execution plan from your current tracker data.</p>
              </div>
              {aiMeta.model ? <span className="status-pill is-info">{aiMeta.model}</span> : null}
            </div>

            <form className="productivity-ai__form" onSubmit={handleGenerateAiPlan}>
              <label className="form-field">
                <span>Prompt</span>
                <textarea
                  className="input productivity-ai__prompt"
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  maxLength={AI_PROMPT_MAX_LENGTH}
                  placeholder="Ask for a daily plan, focus sequence, or job-application strategy."
                />
              </label>
              <div className="productivity-ai__actions">
                <button className="button button-primary" type="submit" disabled={aiLoading}>
                  {aiLoading ? "Thinking..." : "Generate plan"}
                </button>
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setAiPrompt(DEFAULT_AI_PROMPT)}
                  disabled={aiLoading}
                >
                  Reset prompt
                </button>
              </div>
            </form>

            {aiError ? (
              <div className="notice is-error" role="alert">
                {aiError}
              </div>
            ) : null}

            {aiReply ? (
              <div className="productivity-ai__response" role="status" aria-live="polite">
                <pre>{aiReply}</pre>
              </div>
            ) : (
              <p className="muted">No AI guidance yet. Generate a plan to get started.</p>
            )}

            {aiMeta.createdAt ? (
              <p className="muted">Updated {formatDateTime(aiMeta.createdAt)}</p>
            ) : null}
          </article>
        </div>
      </div>

      <article className="panel productivity-history">
        <div className="panel-header">
          <div>
            <h3>History</h3>
            <p className="muted">Tap any day to load it in the editor.</p>
          </div>
        </div>

        <div className="list">
          {entries.length ? (
            entries.map((entry) => (
              <div className="list-row is-split productivity-history__row" key={entry.id}>
                <div>
                  <div className="table-strong">{formatEntryDate(entry.entryDate)}</div>
                  <div className="muted productivity-history__metrics">
                    {entry.completedTasks}/{entry.plannedTasks} tasks • {entry.deepWorkMinutes}m • {entry.focusBlocks}
                    {" "}
                    blocks
                  </div>
                </div>
                <button className="button button-ghost" type="button" onClick={() => handleSelectEntry(entry)}>
                  Use
                </button>
              </div>
            ))
          ) : (
            <p className="muted">No entries yet in this range.</p>
          )}
        </div>
      </article>
    </section>
  );
};

export default Productivity;
