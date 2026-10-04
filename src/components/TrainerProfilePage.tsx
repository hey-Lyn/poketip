import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { getTrainerProfile } from "../services/trainers";
import type { TrainerProfile } from "../services/trainers";
import TrainerCard from "./TrainerCard";
import "./TrainersPage.css";

function TrainerProfileView({ username, userId }: { username: string; userId: string }) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    profile: TrainerProfile | null;
    error: string;
  }>({ attempt: -1, profile: null, error: "" });
  const loading = result.attempt !== retry;

  useEffect(() => {
    let active = true;
    getTrainerProfile(username)
      .then((profile) => {
        if (active) setResult({ attempt: retry, profile, error: "" });
      })
      .catch((error) => {
        if (active) setResult({ attempt: retry, profile: null, error: error.message });
      });
    return () => { active = false; };
  }, [username, retry]);

  return (
    <main className="content trainersPage">
      <div className="trainersShell trainerProfileShell">
        <Link className="trainerBackLink" to="/trainers"><ArrowLeft aria-hidden="true" /> Back to trainers</Link>
        {loading ? <p className="trainerPanel" role="status">Loading trainer...</p> : result.error ? (
          <div className="trainerPanel">
            <p role="alert">{result.error}</p>
            <button className="trainerAction" onClick={() => setRetry((value) => value + 1)}>Try again</button>
          </div>
        ) : result.profile ? (
          <TrainerCard profile={result.profile} detailed isSelf={result.profile.id === userId} />
        ) : (
          <div className="trainerPanel">
            <h1>Trainer not found</h1>
            <p>This profile doesn't exist or isn't shared with other trainers.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TrainerProfilePage() {
  const { username = "" } = useParams();
  const { user, loading } = useAuth();
  if (loading) return <main className="content trainersPage"><p role="status">Loading account...</p></main>;
  if (!user) {
    return (
      <main className="content trainersPage">
        <div className="trainerPanel trainersShell">
          <h1>Trainer profile</h1>
          <p>Sign in to view this trainer's profile.</p>
          <Link className="trainerAction" to="/profile">Sign in</Link>
        </div>
      </main>
    );
  }
  return <TrainerProfileView key={`${user.id}:${username}`} username={username} userId={user.id} />;
}
