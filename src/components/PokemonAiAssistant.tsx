import { useState } from "react";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { useAiConversation } from "../hooks/useAiConversation";
import poketipAvatar from "../assets/poketip-ai-avatar.png";
import ChatMarkdown from "./ChatMarkdown";
import "./PokemonAiAssistant.css";

function displayName(name) {
  return name.replaceAll("-", " ");
}

function SourceList({ sources }) {
  if (!sources?.length) return null;

  return (
    <details className="pokemonAiSources">
      <summary>{sources.length} verified PokéAPI sources</summary>
      <ul>
        {sources.map((source, index) => (
          <li key={source}>
            <a href={source} target="_blank" rel="noreferrer">
              Source {index + 1}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PokemonAiAssistant({ pokemonId, pokemonName }) {
  const [question, setQuestion] = useState("");
  const { messages, loading, error, billing, ask, clear } = useAiConversation({
    kind: "pokemon",
    pokemonId,
  });
  const name = displayName(pokemonName);
  const suggestions = [
    `Summarize ${name}'s verified Pokédex data.`,
    `Analyze ${name}'s defensive matchups.`,
    `What stands out about ${name}'s base stats?`,
  ];

  function submitQuestion(event) {
    event.preventDefault();
    ask(question);
    setQuestion("");
  }

  function clearConversation() {
    clear();
    setQuestion("");
  }

  return (
    <section className="pokemonAiAssistant" aria-labelledby="pokemon-ai-title">
      <header className="pokemonAiHeader">
        <div>
          <span className="pokemonAiEyebrow">
            <img src={poketipAvatar} alt="" />
            <Sparkles size={15} /> Pokétip AI
          </span>
          <h2 id="pokemon-ai-title">Ask about {name}</h2>
          <p>Answers are grounded in verified PokéAPI data for this Pokémon.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clearConversation}>
            <RotateCcw size={15} /> Clear
          </button>
        )}
      </header>

      {messages.length === 0 && (
        <div className="pokemonAiSuggestions" aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              disabled={loading}
              onClick={() => {
                ask(suggestion);
                setQuestion("");
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="pokemonAiConversation" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`pokemonAiMessage pokemonAiMessage--${message.role}`}
              key={`${message.role}-${index}`}
            >
              <span>{message.role === "user" ? "You" : "Pokétip AI"}</span>
              <ChatMarkdown>{message.content}</ChatMarkdown>
              <SourceList sources={message.sources} />
            </article>
          ))}
          {loading && (
            <p className="pokemonAiThinking">
              <Sparkles size={15} /> Checking verified Pokémon data...
            </p>
          )}
        </div>
      )}

      {billing?.source === "credits" && (
        <p className="pokemonAiBilling" role="status">
          Using AI credits · {billing.creditsRemaining} left
        </p>
      )}
      {error && <p className="pokemonAiError" role="alert">{error}</p>}

      <form className="pokemonAiForm" onSubmit={submitQuestion}>
        <label htmlFor={`pokemon-ai-question-${pokemonId}`}>Your question</label>
        <div>
          <textarea
            id={`pokemon-ai-question-${pokemonId}`}
            value={question}
            maxLength={4000}
            rows={2}
            placeholder={`Ask something about ${name}...`}
            disabled={loading}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button type="submit" disabled={loading || !question.trim()}>
            <Send size={17} /> Ask
          </button>
        </div>
      </form>
    </section>
  );
}

export default PokemonAiAssistant;
