import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { getSupabase, signIn, signUp } from "../services/auth";
import "./AuthPage.css";

export function AuthForm() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || password.length < 8) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }

    try {
      setSubmitting(true);
      if (mode === "signin") {
        await signIn(email, password);
        navigate("/");
      } else {
        const data = await signUp(email, password);
        if (!data.session) {
          setMessage("Account created. Check your email to confirm it, then sign in.");
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="authPanel">
      <header className="authPanelHeader">
        <span>Pokétip account</span>
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p>
          {mode === "signin"
            ? "Sign in to use the AI assistant."
            : "Register to use the AI assistant."}
        </p>
      </header>

      <div className="authModeSwitch" role="group" aria-label="Account action">
        <button
          type="button"
          className={mode === "signin" ? "isActive" : ""}
          onClick={() => { setMode("signin"); setError(""); setMessage(""); }}
        >
          <LogIn aria-hidden="true" /> Sign in
        </button>
        <button
          type="button"
          className={mode === "register" ? "isActive" : ""}
          onClick={() => { setMode("register"); setError(""); setMessage(""); }}
        >
          <UserPlus aria-hidden="true" /> Register
        </button>
      </div>

      {message && <p className="authMessage" role="status">{message}</p>}
      {error && <p className="authError" role="alert">{error}</p>}

      <form className="authForm" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

function AuthPage() {
  if (!getSupabase()) {
    return (
      <main className="content authPage">
        <div className="authPanel">
          <p className="authError" role="alert">
            Authentication is not configured on this deployment yet.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="content authPage">
      <AuthForm />
    </main>
  );
}

export default AuthPage;
