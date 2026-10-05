import { useEffect, useRef, useState } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { getCompetitiveFormat } from "../services/competitiveFormats";
import { exportShowdownTeam } from "../services/showdownTeam";
import { validateShowdownTeam } from "../services/teamValidation";
import type { TeamValidationResult } from "../services/teamValidation";
import type { Team } from "../types";
import "./TeamValidation.css";

function ValidationCheck({ text, format }: { text: string; format: string }) {
  const [result, setResult] = useState<TeamValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const label = getCompetitiveFormat(format).label;

  useEffect(() => () => controller.current?.abort(), []);

  async function validate() {
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const nextResult = await validateShowdownTeam(text, format, request.signal);
      if (!request.signal.aborted) setResult(nextResult);
    } catch (caught) {
      if (!request.signal.aborted) {
        setError(caught instanceof Error ? caught.message : "Unable to validate the team. Please try again.");
      }
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return (
    <section className="teamValidation" aria-label="Pokémon Showdown validation" aria-busy={loading}>
      <div className="teamValidationHeader">
        <div>
          <h2><ShieldCheck aria-hidden="true" /> Showdown validation</h2>
          <p>Check your team against the rules for {label}.</p>
        </div>
        <button type="button" onClick={validate} disabled={loading || !text}>
          {loading ? "Validating..." : "Validate team"}
        </button>
      </div>
      {!text && <p>Add a Pokémon to validate your team.</p>}
      {loading && <p role="status">Checking your team...</p>}
      {error && <p className="teamValidationError" role="alert">{error}</p>}
      {result && (
        <div className={result.valid ? "teamValidationSuccess" : "teamValidationProblems"} role="status">
          <p>
            {result.valid ? <ShieldCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
            {result.valid
              ? `Your team is valid for ${label}.`
              : `Your team needs changes for ${label}.`}
          </p>
          {!result.valid && <ul>{result.problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

export default function TeamValidation({ team, format }: { team: Team; format: string }) {
  const text = exportShowdownTeam(team);
  // Remount on every exported-set or format change, including slot order.
  // This clears old results and cancels any request for the previous team.
  return <ValidationCheck key={JSON.stringify([format, text])} text={text} format={format} />;
}
