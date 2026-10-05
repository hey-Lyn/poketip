import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Save, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { getAccessToken } from "../services/auth";
import { errorMessage } from "../services/errors";
import { listUsers, updateUser } from "../services/adminApi";
import type { AdminUser } from "../services/adminApi";
import "./AdminPage.css";

function AdminPage() {
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user);
  const isAdmin = profile?.role === "admin";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: string; credits: string }>>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadUsers = useCallback(() => getAccessToken().then((token) => {
    if (!token) return null;

    setLoadingUsers(true);
    return listUsers(token, undefined)
      .then((data) => {
        setUsers(data);
        setDrafts(Object.fromEntries(data.map((entry) => [
          entry.id,
          { role: entry.role, credits: String(entry.credits) },
        ])));
        setError("");
        return data;
      })
      .catch((requestError) => {
        setError(errorMessage(requestError, "Unable to load users."));
        return null;
      })
      .finally(() => setLoadingUsers(false));
  }), []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  function setDraft(id, changes) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...changes },
    }));
  }

  async function saveUser(id) {
    setStatus("");
    setError("");
    const draft = drafts[id];

    try {
      const token = await getAccessToken();
      await updateUser(token, {
        userId: id,
        role: draft.role,
        credits: Number(draft.credits),
      });
      setUsers((current) => current.map((entry) => (
        entry.id === id
          ? { ...entry, role: draft.role, credits: Number(draft.credits) }
          : entry
      )));
      setStatus("Account updated.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to update this account."));
    }
  }

  if (loading || (profileLoading && !profile)) {
    return (
      <main className="content adminPage">
        <div className="adminPanel">
          <p className="adminStatus">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="content adminPage">
        <div className="adminPanel">
          <ShieldCheck aria-hidden="true" />
          <h1>Admin</h1>
          <p>Sign in with an admin account to manage users.</p>
          <Link to="/profile">Go to profile</Link>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="content adminPage">
        <div className="adminPanel">
          <ShieldCheck aria-hidden="true" />
          <h1>Admins only</h1>
          <p>This account does not have admin access.</p>
          <Link to="/">Back to Pokédex</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="content adminPage">
      <section className="adminConsole">
        <header className="adminHeader">
          <ShieldCheck aria-hidden="true" />
          <div>
            <span>Control room</span>
            <h1>Accounts</h1>
          </div>
          <strong>{users.length}</strong>
        </header>

        {error && <p className="adminError" role="alert">{error}</p>}
        {status && <p className="adminStatus" role="status">{status}</p>}
        {loadingUsers && <p className="adminStatus">Loading accounts...</p>}

        <ul className="adminList">
          {users.map((entry) => {
            const draft = drafts[entry.id]
              ?? { role: entry.role, credits: String(entry.credits) };

            return (
              <li className="adminRow" key={entry.id}>
                <div className="adminRowIdentity">
                  <UserRound aria-hidden="true" />
                  <div>
                    <strong>{entry.display_name || entry.email}</strong>
                    <small>{entry.email}</small>
                  </div>
                </div>
                <label className="adminField">
                  Role
                  <select
                    value={draft.role}
                    onChange={(event) => setDraft(entry.id, { role: event.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="adminField">
                  Credits
                  <input
                    type="number"
                    min="0"
                    value={draft.credits}
                    onChange={(event) => setDraft(entry.id, { credits: event.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="adminSave"
                  onClick={() => saveUser(entry.id)}
                >
                  <Save aria-hidden="true" /> Save
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

export default AdminPage;
