import { useMemo, useState } from "react";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { useAiConversation } from "../hooks/useAiConversation";
import { applyTeamAiActions } from "../services/teamAiActions";
import { errorMessage } from "../services/errors";
import poketipAvatar from "../assets/poketip-ai-avatar.png";
import ChatMarkdown from "./ChatMarkdown";

function createTeamContext(team, format, moveTypes, campaign) {
  return {
    kind: "team",
    mode: campaign ? "campaign" : "competitive",
    format,
    campaign: campaign ?? undefined,
    moveTypes,
    members: Array.from({ length: 6 }, (_, index) => {
      const member = team[index];
      if (!member) return null;

      return {
        id: member.id,
        level: member.level ?? 100,
        item: member.item ?? "",
        ability: member.ability ?? "",
        nature: member.nature ?? "",
        teraType: member.teraType ?? "",
        gender: member.gender ?? "",
        evs: member.evs,
        ivs: member.ivs,
        moves: member.moves ?? [],
      };
    }),
  };
}

function cloneTeam(team) {
  return team.map((member) => member
    ? {
        ...member,
        evs: { ...member.evs },
        ivs: { ...member.ivs },
        moves: [...member.moves],
      }
    : null);
}

interface TeamAiAssistantProps {
  team: any;
  format: any;
  moveTypes?: any[];
  campaign?: any;
  onApplyTeam?: any;
}

function TeamAiAssistant({ team, format, moveTypes = [], campaign = null, onApplyTeam = () => {} }: TeamAiAssistantProps) {
  const [question, setQuestion] = useState("");
  const [undoTeam, setUndoTeam] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const context = useMemo(
    () => createTeamContext(team, format, moveTypes, campaign),
    [team, format, moveTypes, campaign],
  );
  const { messages, loading, error, billing, ask, clear } = useAiConversation(context, {
    storageKey: "team-builder",
  });
  const memberCount = team.filter(Boolean).length;
  const suggestions = campaign ? [
    `Is this team ready for ${campaign.milestoneLabel}?`,
    "Which current team members are most useful for the next important battle?",
    "What level range and moves should I prepare before this objective?",
  ] : [
    "Identify the team's biggest weaknesses and defensive gaps.",
    "Review the current sets and suggest the three most important improvements.",
    "Which common threats in this format put the most pressure on this team?",
    "What role or Pokémon archetype best fits the empty slots?",
  ];

  async function submitQuestion(event) {
    event.preventDefault();
    const submittedQuestion = question;
    setQuestion("");
    setEditStatus("");
    await ask(submittedQuestion);
  }

  async function submitTeamEdit() {
    const submittedQuestion = question;
    setQuestion("");
    setEditStatus("");
    const result = await ask(submittedQuestion, { mode: "team-edit" });
    if (!result || !result.actions?.length) {
      if (result) setEditStatus("No team changes were applied.");
      return;
    }

    try {
      const nextTeam = applyTeamAiActions(team, result.actions);
      setUndoTeam(cloneTeam(team));
      onApplyTeam(nextTeam);
      setEditStatus(
        `${result.actions.length} team change${result.actions.length === 1 ? "" : "s"} applied.`,
      );
    } catch (actionError) {
      setEditStatus(errorMessage(actionError, "Unable to apply this team change."));
    }
  }

  function undoLastEdit() {
    if (!undoTeam) return;
    onApplyTeam(cloneTeam(undoTeam));
    setUndoTeam(null);
    setEditStatus("The last AI team edit was undone.");
  }

  function clearConversation() {
    clear();
    setQuestion("");
    setEditStatus("");
  }

  return (
    <section className="teamAiAssistant" aria-labelledby="team-ai-title">
      <header className="teamAiHeader">
        <div>
          <span className="teamAiEyebrow">
            <img src={poketipAvatar} alt="" />
            <Sparkles aria-hidden="true" /> Pokétip AI
          </span>
          <h3 id="team-ai-title">{campaign ? "Campaign guide" : "Team advisor"}</h3>
          <p>
            {campaign
              ? `Using ${campaign.gameLabel} data for ${campaign.milestoneLabel}.`
              : "Ask for analysis, or explicitly use Apply changes to let the AI edit validated team fields."}
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clearConversation}>
            <RotateCcw aria-hidden="true" /> Clear
          </button>
        )}
      </header>

      {messages.length === 0 && (
        <div className="teamAiSuggestions" aria-label="Suggested team questions">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              disabled={!memberCount || loading}
              onClick={() => ask(suggestion)}
              key={suggestion}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="teamAiConversation">
          {messages.map((message, index) => (
            <article
              className={`teamAiMessage teamAiMessage--${message.role}`}
              key={`${message.role}-${index}`}
              aria-live={
                index === messages.length - 1 && message.role === "assistant"
                  ? "polite"
                  : undefined
              }
            >
              <span>{message.role === "user" ? "You" : "Pokétip AI"}</span>
              <ChatMarkdown>{message.content}</ChatMarkdown>
              {message.actions?.length > 0 && (
                <small className="teamAiAppliedLabel">
                  {message.actions.length} validated change{message.actions.length === 1 ? "" : "s"}
                </small>
              )}
              {message.sources?.length > 0 && (
                <details>
                  <summary>{message.sources.length} verified data sources</summary>
                  <ul>
                    {message.sources.map((source, sourceIndex) => (
                      <li key={source}>
                        <a href={source} target="_blank" rel="noreferrer">
                          Source {sourceIndex + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
          {loading && <p className="teamAiStatus" role="status">Checking the current team...</p>}
        </div>
      )}

      {!memberCount && <p className="teamAiStatus">Add at least one Pokémon to request an analysis.</p>}
      {billing?.source === "credits" && (
        <p className="teamAiBilling" role="status">
          Using AI credits · {billing.creditsRemaining} left
        </p>
      )}
      {error && <p className="teamAiError" role="alert">{error}</p>}
      {editStatus && <p className="teamAiEditStatus" role="status">{editStatus}</p>}
      {undoTeam && (
        <button className="teamAiUndo" type="button" onClick={undoLastEdit}>
          <RotateCcw aria-hidden="true" /> Undo AI changes
        </button>
      )}

      <form className="teamAiForm" onSubmit={submitQuestion}>
        <label htmlFor="team-ai-question">Ask about this team</label>
        <div>
          <textarea
            id="team-ai-question"
            value={question}
            rows={2}
            maxLength={4000}
            disabled={loading}
            placeholder="Ask for analysis, or explicitly describe changes to apply..."
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div className="teamAiFormActions">
            <button type="submit" disabled={!memberCount || loading || !question.trim()}>
              <Send aria-hidden="true" /> Ask
            </button>
            <button
              type="button"
              className="teamAiApply"
              disabled={loading || !question.trim()}
              onClick={submitTeamEdit}
            >
              <Sparkles aria-hidden="true" /> Apply changes
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export default TeamAiAssistant;
