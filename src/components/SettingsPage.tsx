import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  KeyRound,
  LayoutPanelLeft,
  LogOut,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import { signOut, updatePassword } from "../services/auth";
import "./SettingsPage.css";

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function SettingsPage({ settings, team, user, onUpdate, onClearTeam }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const teamCount = team.filter(Boolean).length;

  function toggleSetting(key) {
    onUpdate({ [key]: !settings[key] });
  }

  function clearTeam() {
    if (!window.confirm("Remove all Pokémon from the saved team?")) return;

    onClearTeam();
    setError("");
    setStatus("Saved team cleared.");
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      team: readJson("poketip-team-v1"),
      teamFormat: localStorage.getItem("poketip-team-format-v1") ?? null,
      settings: readJson("poketip-settings-v1"),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "poketip-data.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setError("");
    setStatus("Data exported.");
  }

  async function submitPassword(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    try {
      await updatePassword(password);
      setPassword("");
      setStatus("Password updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="content settingsPage">
      <section className="settingsCard">
        <header className="settingsHeader">
          <Zap aria-hidden="true" />
          <div>
            <span>Preferences</span>
            <h1>Settings</h1>
          </div>
        </header>

        {error && <p className="settingsError" role="alert">{error}</p>}
        {status && <p className="settingsStatus" role="status">{status}</p>}

        <section className="settingsPanel">
          <div className="settingsPanelTitle">
            <LayoutPanelLeft aria-hidden="true" />
            <h2>Appearance</h2>
          </div>

          <div className="settingsTheme">
            <span className="settingsThemeLabel">Theme</span>
            <div className="settingsThemeOptions">
              {["sylveon", "umbreon"].map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={settings.theme === theme ? "isActive" : ""}
                  aria-pressed={settings.theme === theme}
                  onClick={() => onUpdate({ theme })}
                >
                  {theme === "sylveon" ? "Sylveon" : "Umbreon"}
                </button>
              ))}
            </div>
          </div>

          <label className="settingsToggle">
            <input
              type="checkbox"
              checked={settings.shiny}
              onChange={() => toggleSetting("shiny")}
            />
            <span>
              <strong>Shiny</strong>
              <small>Use the shiny color variant of the selected theme.</small>
            </span>
          </label>

          <label className="settingsToggle">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={() => toggleSetting("reduceMotion")}
            />
            <span>
              <strong>Reduce motion</strong>
              <small>Turn off animations and transitions.</small>
            </span>
          </label>
        </section>

        <section className="settingsPanel">
          <div className="settingsPanelTitle">
            <Download aria-hidden="true" />
            <h2>Team &amp; data</h2>
          </div>

          <p className="settingsHint">
            {teamCount > 0
              ? `${teamCount} Pokémon saved in your team.`
              : "No Pokémon saved in your team."}
          </p>

          <div className="settingsActions">
            <button type="button" onClick={exportData}>
              <Download aria-hidden="true" /> Export my data
            </button>
            <button type="button" className="settingsDanger" onClick={clearTeam}>
              <Trash2 aria-hidden="true" /> Clear saved team
            </button>
          </div>
        </section>

        <section className="settingsPanel">
          <div className="settingsPanelTitle">
            <UserRound aria-hidden="true" />
            <h2>Account</h2>
          </div>

          {user ? (
            <>
              <p className="settingsHint">{user.email}</p>
              <form className="settingsPassword" onSubmit={submitPassword}>
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    placeholder="At least 6 characters"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={saving}>
                  <KeyRound aria-hidden="true" /> {saving ? "Saving..." : "Change password"}
                </button>
              </form>
              <button
                type="button"
                className="settingsSignOut"
                onClick={signOut}
              >
                <LogOut aria-hidden="true" /> Sign out
              </button>
            </>
          ) : (
            <p className="settingsHint">
              Sign in to manage your account settings.{" "}
              <Link to="/profile">Go to profile</Link>
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

export default SettingsPage;
