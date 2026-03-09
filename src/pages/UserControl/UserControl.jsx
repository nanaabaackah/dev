import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff, FiMail, FiSave, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../../api-url";
import { getApiErrorMessage, readJsonResponse } from "../../utils/http";
import "./UserControl.css";

const DEFAULT_CREATE_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  roleId: "",
  status: "ACTIVE",
};
const PASSWORD_POLICY_HELP =
  "At least 14 characters, with uppercase, lowercase, number, and special character (no spaces).";

const readStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const UserControl = () => {
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredUser(), []);
  const isAdmin = storedUser?.role?.name === "Admin";
  const currentUserId = Number(storedUser?.id || 0);

  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [moduleKeys, setModuleKeys] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [userDrafts, setUserDrafts] = useState({});
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const createFormHasPassword = Boolean(String(createForm.password || "").trim());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [createNotice, setCreateNotice] = useState("");
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [savingUserId, setSavingUserId] = useState(null);
  const [resendingInvitationUserId, setResendingInvitationUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createPasswordVisible, setCreatePasswordVisible] = useState(false);
  const [userPasswordVisibility, setUserPasswordVisibility] = useState({});
  const [savedUserPasswords, setSavedUserPasswords] = useState({});
  const [savedCreatedPassword, setSavedCreatedPassword] = useState("");

  const buildDraftsFromPayload = useCallback((nextRoles, nextUsers) => {
    const nextRoleDrafts = {};
    nextRoles.forEach((role) => {
      nextRoleDrafts[role.id] = {
        description: String(role.description || ""),
        modulesInput: Array.isArray(role.modules) ? role.modules.join(", ") : "",
      };
    });

    const nextUserDrafts = {};
    nextUsers.forEach((user) => {
      nextUserDrafts[user.id] = {
        firstName: String(user.firstName || ""),
        lastName: String(user.lastName || ""),
        email: String(user.email || ""),
        roleId: String(user?.role?.id || ""),
        status: String(user.status || "ACTIVE"),
        password: "",
      };
    });

    setRoleDrafts(nextRoleDrafts);
    setUserDrafts(nextUserDrafts);
  }, []);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      setNotice("");

      try {
        const usersResponse = await fetch(buildApiUrl("/api/access/users"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const usersPayload = await readJsonResponse(usersResponse);

        const rolesResponse = await fetch(buildApiUrl("/api/access/roles"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rolesPayload = await readJsonResponse(rolesResponse);

        if (!rolesResponse.ok || !usersResponse.ok) {
          if (rolesResponse.status === 401 || usersResponse.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          const rolesMessage = getApiErrorMessage(rolesPayload, "Unable to load role access");
          const usersMessage = getApiErrorMessage(usersPayload, "Unable to load user access");
          throw new Error(`${rolesMessage}. ${usersMessage}`);
        }

        const nextRoles = Array.isArray(rolesPayload?.roles) ? rolesPayload.roles : [];
        const nextUsers = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
        const nextUserIdSet = new Set(nextUsers.map((user) => String(user.id)));

        setRoles(nextRoles);
        setUsers(nextUsers);
        setModuleKeys(Array.isArray(rolesPayload?.modules) ? rolesPayload.modules : []);
        buildDraftsFromPayload(nextRoles, nextUsers);
        setSavedUserPasswords((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([userId]) => nextUserIdSet.has(String(userId)))
          )
        );
        setUserPasswordVisibility((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([userId]) => nextUserIdSet.has(String(userId)))
          )
        );

        if (!createForm.roleId && nextRoles.length) {
          setCreateForm((prev) => ({ ...prev, roleId: String(nextRoles[0].id) }));
        }
      } catch (requestError) {
        setError(requestError.message || "Unable to load user control data");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [buildDraftsFromPayload, createForm.roleId, navigate]
  );

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, loadData]);

  const handleRoleDraft = (roleId, key, value) => {
    setRoleDrafts((prev) => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] || {}),
        [key]: value,
      },
    }));
  };

  const handleUserDraft = (userId, key, value) => {
    setUserDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [key]: value,
      },
    }));
  };

  const toggleCreatePasswordVisibility = () => {
    setCreatePasswordVisible((prev) => !prev);
  };

  const toggleUserPasswordVisibility = (userId) => {
    setUserPasswordVisibility((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const copyPassword = async (value, successMessage) => {
    const password = String(value || "");
    if (!password) {
      setError("No saved password to copy.");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(password);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = password;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setError("");
      setNotice(successMessage);
    } catch {
      setError("Unable to copy password. Copy it manually.");
    }
  };

  const saveRole = async (role) => {
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    const draft = roleDrafts[role.id] || {};
    const modules = String(draft.modulesInput || "")
      .split(/[\s,]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    setSavingRoleId(role.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(buildApiUrl(`/api/access/roles/${role.id}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: draft.description,
          modules,
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to save role access"));
      }
      setNotice(`Role access updated for ${role.name}.`);
      await loadData({ silent: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to save role access");
    } finally {
      setSavingRoleId(null);
    }
  };

  const saveUser = async (user) => {
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    const draft = userDrafts[user.id] || {};
    const payload = {
      firstName: draft.firstName,
      lastName: draft.lastName,
      email: draft.email,
      status: draft.status,
      roleId: Number(draft.roleId),
    };

    const password = String(draft.password || "").trim();
    if (password) {
      payload.password = password;
    }

    setSavingUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(buildApiUrl(`/api/access/users/${user.id}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responsePayload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(responsePayload, "Unable to update user"));
      }
      if (password) {
        setSavedUserPasswords((prev) => ({
          ...prev,
          [user.id]: password,
        }));
        setNotice(`User updated. Saved password ready to copy for ${user.email}.`);
      } else {
        setSavedUserPasswords((prev) => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
        setNotice(`User updated for ${user.email}.`);
      }
      await loadData({ silent: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to update user");
    } finally {
      setSavingUserId(null);
    }
  };

  const createUser = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    setCreateError("");
    setCreateNotice("");
    setError("");
    setNotice("");
    setIsCreating(true);

    try {
      const createdPassword = String(createForm.password || "");
      const response = await fetch(buildApiUrl("/api/access/users"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...createForm,
          roleId: Number(createForm.roleId),
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to create user"));
      }

      const invitationRecipient =
        payload && typeof payload === "object" && typeof payload.invitationRecipient === "string"
          ? payload.invitationRecipient
          : "";
      const tenantProfileCreated =
        payload && typeof payload === "object" && payload.tenantProfileCreated === true;
      const tenantProfileAlreadyExists =
        payload && typeof payload === "object" && payload.tenantProfileAlreadyExists === true;
      const createdStatus =
        payload && typeof payload === "object" && typeof payload?.user?.status === "string"
          ? payload.user.status
          : "";
      const tenantProfileMessage = tenantProfileCreated
        ? " Tenant profile added to Rent."
        : tenantProfileAlreadyExists
          ? " Tenant profile already existed in Rent."
          : "";
      setCreateNotice(
        createdStatus === "PENDING"
          ? invitationRecipient
            ? `User created with PENDING status until password setup is completed. Invitation email sent to ${invitationRecipient}.${tenantProfileMessage}`
            : `User created with PENDING status until password setup is completed.${tenantProfileMessage}`
          : invitationRecipient
            ? `User created. Invitation email sent to ${invitationRecipient}.${tenantProfileMessage}`
            : `User created.${tenantProfileMessage}`
      );
      setSavedCreatedPassword(createdPassword);
      setCreateForm((prev) => ({
        ...DEFAULT_CREATE_FORM,
        roleId: prev.roleId,
      }));
      setCreatePasswordVisible(false);
      await loadData({ silent: true });
    } catch (requestError) {
      setCreateError(requestError.message || "Unable to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const removeUser = async (user) => {
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    const userLabel = String(user.fullName || "").trim() || user.email;
    const confirmed = window.confirm(
      `Remove ${userLabel}? This permanently deletes the user account. This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(buildApiUrl(`/api/access/users/${user.id}`), {
        method: "DELETE",
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
        throw new Error(getApiErrorMessage(payload, "Unable to remove user"));
      }

      const deletedUserEmail =
        payload && typeof payload === "object" && typeof payload.deletedUserEmail === "string"
          ? payload.deletedUserEmail
          : user.email;
      const successMessage = `${deletedUserEmail} removed.`;

      setSavedUserPasswords((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      setUserPasswordVisibility((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      await loadData({ silent: true });
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message || "Unable to remove user");
    } finally {
      setDeletingUserId(null);
    }
  };

  const resendInvitation = async (user) => {
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }

    setResendingInvitationUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(buildApiUrl(`/api/access/users/${user.id}/resend-invitation`), {
        method: "POST",
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
        throw new Error(getApiErrorMessage(payload, "Unable to resend setup link"));
      }

      const invitationRecipient =
        payload && typeof payload === "object" && typeof payload.invitationRecipient === "string"
          ? payload.invitationRecipient
          : user.email;
      setNotice(`Setup link resent to ${invitationRecipient}.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to resend setup link");
    } finally {
      setResendingInvitationUserId(null);
    }
  };

  if (!isAdmin) {
    return (
      <section className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Access</p>
            <h1>User Control</h1>
            <p className="muted">Admin access is required.</p>
          </div>
        </header>
        <div className="notice is-error" role="alert">
          You do not have permission to manage users and access controls.
        </div>
      </section>
    );
  }

  return (
    <section className="page user-control-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>User Control</h1>
          <p className="muted">Manage user accounts, role assignments, and module-level access.</p>
        </div>
        <div className="header-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => loadData({ silent: true })}
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="panel loading-card" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading user control data...</span>
        </div>
      ) : null}

      {error ? (
        <div className="notice is-error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? <div className="notice is-success">{notice}</div> : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Role access</h3>
            <p className="muted">Supported modules: {moduleKeys.join(", ")}</p>
          </div>
        </div>

        <div className="user-control-table-wrap">
          <table className="user-control-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Users</th>
                <th>Modules</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const draft = roleDrafts[role.id] || {};
                const isAdminRole = role.name === "Admin";
                return (
                  <tr key={role.id}>
                    <td data-label="Role">{role.name}</td>
                    <td data-label="Users">{role.userCount ?? 0}</td>
                    <td data-label="Modules">
                      <input
                        className="input"
                        value={draft.modulesInput || ""}
                        onChange={(event) =>
                          handleRoleDraft(role.id, "modulesInput", event.target.value)
                        }
                        placeholder={isAdminRole ? "Full access" : "dashboard, rent"}
                        disabled={isAdminRole}
                      />
                    </td>
                    <td data-label="Description">
                      <input
                        className="input"
                        value={draft.description || ""}
                        onChange={(event) =>
                          handleRoleDraft(role.id, "description", event.target.value)
                        }
                      />
                    </td>
                    <td className="user-control-action-cell" data-label="Action">
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => saveRole(role)}
                        disabled={savingRoleId === role.id}
                      >
                        {savingRoleId === role.id ? "Saving..." : "Save role"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>User accounts</h3>
            <p className="muted">Edit role, status, reset passwords, resend links, and remove accounts when needed.</p>
          </div>
        </div>

        <div className="user-control-table-wrap">
          <table className="user-control-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>New password</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const draft = userDrafts[user.id] || {};
                const isCurrentUser = Number(user.id) === currentUserId;
                const isSuspendedUser = user.status === "SUSPENDED";
                return (
                  <tr key={user.id}>
                    <td data-label="Name">
                      <div className="user-control-name-grid">
                        <input
                          className="input"
                          value={draft.firstName || ""}
                          onChange={(event) =>
                            handleUserDraft(user.id, "firstName", event.target.value)
                          }
                          placeholder="First"
                        />
                        <input
                          className="input"
                          value={draft.lastName || ""}
                          onChange={(event) =>
                            handleUserDraft(user.id, "lastName", event.target.value)
                          }
                          placeholder="Last"
                        />
                      </div>
                    </td>
                    <td data-label="Email">
                      <input
                        className="input"
                        type="email"
                        value={draft.email || ""}
                        onChange={(event) => handleUserDraft(user.id, "email", event.target.value)}
                      />
                    </td>
                    <td data-label="Role">
                      <select
                        className="input"
                        value={draft.roleId || ""}
                        onChange={(event) => handleUserDraft(user.id, "roleId", event.target.value)}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Status">
                      <select
                        className="input"
                        value={draft.status || "ACTIVE"}
                        onChange={(event) => handleUserDraft(user.id, "status", event.target.value)}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="PENDING">PENDING</option>
                      </select>
                    </td>
                    <td data-label="New password">
                      <div className="user-control-password-cell">
                        <div className="password-input-inline">
                          <input
                            className="input"
                            type={userPasswordVisibility[user.id] ? "text" : "password"}
                            name={`user-reset-password-${user.id}`}
                            autoComplete="new-password"
                            value={draft.password || ""}
                            onChange={(event) =>
                              handleUserDraft(user.id, "password", event.target.value)
                            }
                            placeholder="Leave empty (strong password)"
                          />
                          <button
                            className="password-input-inline__toggle"
                            type="button"
                            onClick={() => toggleUserPasswordVisibility(user.id)}
                            aria-label={
                              userPasswordVisibility[user.id]
                                ? "Hide user password"
                                : "Show user password"
                            }
                          >
                            {userPasswordVisibility[user.id] ? (
                              <FiEyeOff aria-hidden="true" />
                            ) : (
                              <FiEye aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        {savedUserPasswords[user.id] ? (
                          <button
                            className="button button-ghost user-control-inline-button"
                            type="button"
                            onClick={() =>
                              copyPassword(
                                savedUserPasswords[user.id],
                                `Saved password copied for ${user.email}.`
                              )
                            }
                          >
                            Copy saved
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="user-control-action-cell" data-label="Action">
                      <div className="user-control-action-stack">
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => saveUser(user)}
                          disabled={
                            savingUserId === user.id ||
                            deletingUserId === user.id ||
                            resendingInvitationUserId === user.id
                          }
                          aria-label={
                            savingUserId === user.id ? `Saving ${user.email}` : `Save ${user.email}`
                          }
                          title={savingUserId === user.id ? "Saving..." : "Save user"}
                        >
                          {savingUserId === user.id ? (
                            <span className="spinner" aria-hidden="true" />
                          ) : (
                            <FiSave aria-hidden="true" />
                          )}
                        </button>
                        <button
                          className="icon-button user-control-resend-button"
                          type="button"
                          onClick={() => resendInvitation(user)}
                          disabled={
                            resendingInvitationUserId === user.id ||
                            savingUserId === user.id ||
                            deletingUserId === user.id ||
                            isSuspendedUser
                          }
                          aria-label={
                            isSuspendedUser
                              ? `${user.email} is suspended and cannot receive a setup link`
                              : resendingInvitationUserId === user.id
                                ? `Resending setup link to ${user.email}`
                                : `Resend setup link to ${user.email}`
                          }
                          title={
                            isSuspendedUser
                              ? "Activate the user before resending the setup link"
                              : resendingInvitationUserId === user.id
                                ? "Resending..."
                                : "Resend setup link"
                          }
                        >
                          {resendingInvitationUserId === user.id ? (
                            <span className="spinner" aria-hidden="true" />
                          ) : (
                            <FiMail aria-hidden="true" />
                          )}
                        </button>
                        <button
                          className="icon-button user-control-remove-button"
                          type="button"
                          onClick={() => removeUser(user)}
                          disabled={
                            deletingUserId === user.id ||
                            savingUserId === user.id ||
                            resendingInvitationUserId === user.id ||
                            isCurrentUser
                          }
                          aria-label={
                            isCurrentUser
                              ? "Current account cannot be removed"
                              : deletingUserId === user.id
                                ? `Removing ${user.email}`
                                : `Remove ${user.email}`
                          }
                          title={
                            isCurrentUser
                              ? "Current account cannot be removed"
                              : deletingUserId === user.id
                                ? "Removing..."
                                : "Remove user"
                          }
                        >
                          {deletingUserId === user.id ? (
                            <span className="spinner" aria-hidden="true" />
                          ) : (
                            <FiTrash2 aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Create user</h3>
            <p className="muted">Add a new account and assign initial access.</p>
          </div>
        </div>

        {createError ? (
          <div className="notice is-error" role="alert">
            {createError}
          </div>
        ) : null}
        {createNotice ? <div className="notice is-success">{createNotice}</div> : null}

        <form className="stack" onSubmit={createUser}>
          <div className="user-control-create-grid">
            <label className="form-field">
              <span>First name</span>
              <input
                className="input"
                value={createForm.firstName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span>Last name</span>
              <input
                className="input"
                value={createForm.lastName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, lastName: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <div className="password-input-inline">
                <input
                  className="input"
                  type={createPasswordVisible ? "text" : "password"}
                  name="create-user-password"
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="Optional: leave blank to use invitation setup"
                />
                <button
                  className="password-input-inline__toggle"
                  type="button"
                  onClick={toggleCreatePasswordVisibility}
                  aria-label={createPasswordVisible ? "Hide password" : "Show password"}
                >
                  {createPasswordVisible ? (
                    <FiEyeOff aria-hidden="true" />
                  ) : (
                    <FiEye aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>
            <label className="form-field">
              <span>Role</span>
              <select
                className="input"
                value={createForm.roleId}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, roleId: event.target.value }))
                }
                required
              >
                <option value="" disabled>
                  Select role
                </option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Status</span>
              <select
                className="input"
                value={createFormHasPassword ? createForm.status : "PENDING"}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, status: event.target.value }))
                }
                disabled={!createFormHasPassword}
              >
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </label>
          </div>
          <p className="muted">{PASSWORD_POLICY_HELP}</p>
          <p className="muted">
            If password is blank, the user will set it from the invitation email and remain
            PENDING until setup is completed.
          </p>
          <div className="header-actions">
            <button className="button button-primary" type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create user"}
            </button>
            {savedCreatedPassword ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={() =>
                  copyPassword(savedCreatedPassword, "Saved password copied for the new user.")
                }
              >
                Copy saved password
              </button>
            ) : null}
          </div>
        </form>
      </article>
    </section>
  );
};

export default UserControl;
