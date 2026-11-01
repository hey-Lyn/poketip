import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, PanelLeftClose, RotateCcw, SquarePen, Wand2 } from "lucide-react";
import { useAiConversation } from "../hooks/useAiConversation";
import { applyTeamAiActions } from "../services/teamAiActions";
import { errorMessage } from "../services/errors";
import poketipAvatar from "../assets/poketip-ai-avatar.png";
import ChatMarkdown from "./ChatMarkdown";
import "./TeamAiAssistant.css";

const MAX_COMPOSER_HEIGHT = 200;

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
  onCollapse?: () => void;
}

function TeamAiAssistant({ team, format, moveTypes = [], campaign = null, onApplyTeam = () => {}, onCollapse }: TeamAiAssistantProps) {
  const [question, setQuestion] = useState("");
  const [undoTeam, setUndoTeam] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const context = useMemo(
    () => createTeamContext(team, format, moveTypes, campaign),
    [team, format, moveTypes, campaign],
  );
  const { messages, loading, error, billing, ask, clear } = useAiConversation(context, {
    storageKey: "team-builder",
  });
  const memberCount = team.filter(Boolean).length;
  const canAsk = memberCount > 0 && !loading && Boolean(question.trim());
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

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages.length, loading]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [question]);

  async function submitQuestion(event) {
    event.preventDefault();
    if (!canAsk) return;
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

  function handleComposerKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <section className="teamAiAssistant" aria-labelledby="team-ai-title">
      <header className="teamAiHeader">
        <img className="teamAiAvatar" src={poketipAvatar} alt="" />
        <div>
          <h2 id="team-ai-title">{campaign ? "Campaign guide" : "Team advisor"}</h2>
          <span>Pokétip AI</span>
        </div>
        <button
          type="button"
          onClick={clearConversation}
          disabled={!messages.length || loading}
          aria-label="New chat"
          title="New chat"
        >
          <SquarePen aria-hidden="true" />
        </button>
        {onCollapse && (
          <button
            className="teamAiCollapse"
            type="button"
            onClick={onCollapse}
            aria-label="Collapse Pokétip AI chat"
            aria-expanded={true}
            title="Collapse chat"
          >
            <PanelLeftClose aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="teamAiConversation" ref={conversationRef}>
        {messages.length === 0 ? (
          <div className="teamAiWelcome">
            <img src={poketipAvatar} alt="" />
            <h3>How can I help with your team?</h3>
            <p>
              {campaign
                ? `Using ${campaign.gameLabel} data for ${campaign.milestoneLabel}.`
                : "Ask for analysis, or use Apply changes to let the AI edit validated team fields."}
            </p>
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
          </div>
        ) : (
          messages.map((message, index) => (
            <article
              className={`teamAiMessage teamAiMessage--${message.role}`}
              key={`${message.role}-${index}`}
              aria-live={
                index === messages.length - 1 && message.role === "assistant"
                  ? "polite"
                  : undefined
              }
            >
              {message.role === "assistant" && (
                <img className="teamAiMessageAvatar" src={poketipAvatar} alt="" />
              )}
              <div className="teamAiMessageBody">
                <span className="visuallyHidden">
                  {message.role === "user" ? "You" : "Pokétip AI"}
                </span>
                <ChatMarkdown>{message.content}</ChatMarkdown>
                {message.actions?.length > 0 && (
                  <small className="teamAiAppliedLabel">
                    <Wand2 aria-hidden="true" />
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
              </div>
            </article>
          ))
        )}
        {loading && (
          <div className="teamAiThinking" role="status">
            <img className="teamAiMessageAvatar" src={poketipAvatar} alt="" />
            <span className="teamAiDots" aria-hidden="true"><i /><i /><i /></span>
            <span className="visuallyHidden">Checking the current team...</span>
          </div>
        )}
      </div>

      <div className="teamAiFooter">
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
          <label className="visuallyHidden" htmlFor="team-ai-question">Ask about this team</label>
          <textarea
            id="team-ai-question"
            ref={composerRef}
            value={question}
            rows={1}
            maxLength={4000}
            disabled={loading}
            placeholder="Message Pokétip AI..."
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleComposerKeyDown}
          />
          <div className="teamAiFormActions">
            <button
              type="button"
              className="teamAiApply"
              disabled={loading || !question.trim()}
              onClick={submitTeamEdit}
              title="Let the AI edit validated team fields"
            >
              <Wand2 aria-hidden="true" /> Apply changes
            </button>
            <button
              type="submit"
              className="teamAiSend"
              disabled={!canAsk}
              aria-label="Ask"
              title="Send (Enter)"
            >
              <ArrowUp aria-hidden="true" />
            </button>
          </div>
        </form>
        <small className="teamAiDisclaimer">
          Data is verified server-side, but AI can still make mistakes.
        </small>
      </div>
    </section>
  );
}

export default TeamAiAssistant;
