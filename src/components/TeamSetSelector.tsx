import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch } from "react";
import { Check, CircleDot, Package, Search, Sparkles, Swords, X } from "lucide-react";
import { choiceId, getItemChoices, getMoveChoices } from "../services/teamSetChoices";
import type { PokemonMove } from "../services/pokeApi";
import type { TeamMember } from "../types";
import "./TeamSetSelector.css";

export default function TeamSetSelector({ kind, item, moves, learnedMoves, preferredItems, slot = 0, onUpdate, onClose }: {
  kind: "item" | "moves"; item: string; moves: string[]; learnedMoves: PokemonMove[];
  preferredItems: string[]; slot?: number;
  onUpdate: Dispatch<Partial<TeamMember>>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [allMoves, setAllMoves] = useState(false);
  const [limit, setLimit] = useState(80);
  const [draft, setDraft] = useState(() => {
    const seen = new Set<string>();
    return Array.from({ length: 4 }, (_, index) => {
      const name = moves[index] ?? "";
      const id = choiceId(name);
      if (!id || seen.has(id)) return "";
      seen.add(id);
      return name;
    });
  });
  const selected = draft.filter(Boolean);
  const items = useMemo(() => getItemChoices(), []);
  const moveChoices = useMemo(() => getMoveChoices(learnedMoves, allMoves), [learnedMoves, allMoves]);
  const matches = (choice: { name: string; description: string }) => !query.trim() ||
    choiceId(choice.name).includes(choiceId(query)) || choice.description.toLowerCase().includes(query.toLowerCase().trim());
  const preferred = new Set(preferredItems.map(choiceId));
  const itemChoices = items.filter(matches).sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)));
  const filteredMoves = moveChoices.filter(matches);

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    searchInput.current?.focus();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);

  function toggleMove(name: string) {
    setDraft((current) => {
      const existing = current.findIndex((move) => choiceId(move) === choiceId(name));
      const next = [...current];
      if (existing >= 0) next[existing] = "";
      else {
        const available = !current[slot] ? slot : current.findIndex((move) => !move);
        if (available < 0) return current;
        next[available] = name;
      }
      return next;
    });
  }

  let previousGroup = "";
  return <dialog ref={dialog} className="teamSetSelector" aria-labelledby="team-selector-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="teamSelectorShell">
      <header className="teamSelectorHeader">
        <div><span>Set editor</span><h2 id="team-selector-title">{kind === "item" ? "Select item" : "Select moves"}
          {kind === "moves" && <small>{selected.length}/4</small>}</h2></div>
        <button type="button" className="teamSelectorClose" aria-label="Close selector" onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      <div className="teamSelectorSearch"><Search aria-hidden="true" />
        <input ref={searchInput} type="search" autoFocus aria-label={kind === "item" ? "Search items" : "Search moves"}
          placeholder={kind === "item" ? "Search items or effects…" : "Search moves or effects…"}
          value={query} onChange={(event) => { setQuery(event.target.value); setLimit(80); }} />
      </div>
      {kind === "moves" && <div className="teamSelectorSelection" aria-label="Selected moves">
        {selected.map((move) => <button type="button" key={choiceId(move)} onClick={() => toggleMove(move)} aria-label={`Remove ${move}`}>
          {move.replaceAll("-", " ")}<X aria-hidden="true" /></button>)}
        <p role="status">{selected.length === 4 ? "Four moves selected. Remove one to choose another." : "Choose up to four moves. Apply when you’re ready."}</p>
      </div>}
      <div className="teamSelectorResults">
        {kind === "item" ? <>
          {!query && <button type="button" className="teamSelectorRow teamSelectorNoItem" aria-pressed={!item}
            onClick={() => { onUpdate({ item: "" }); onClose(); }}><Package aria-hidden="true" /><span><strong>No held item</strong><small>Remove the current item.</small></span>{!item && <Check aria-hidden="true" />}</button>}
          {itemChoices.slice(0, limit).map((choice, index) => <div key={choice.id}>
            {(index === 0 || preferred.has(choice.id) !== preferred.has(itemChoices[index - 1].id)) &&
              <h3 className="teamSelectorGroup">{preferred.has(choice.id) ? "Popular for this Pokémon" : "Items"}</h3>}
            <button type="button" className="teamSelectorRow" aria-pressed={choiceId(item) === choice.id}
              onClick={() => { onUpdate({ item: choice.name }); onClose(); }}>
              <span className="teamSelectorItemIcon"><Package aria-hidden="true" />
                <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${choice.name.toLowerCase().replaceAll(" ", "-")}.png`} alt="" loading="lazy"
                  onLoad={(event) => { event.currentTarget.previousElementSibling?.setAttribute("hidden", ""); }}
                  onError={(event) => { event.currentTarget.hidden = true; }} />
              </span>
              <span><strong>{choice.name}</strong><small>{choice.description}</small></span>
              {choiceId(item) === choice.id && <Check aria-hidden="true" />}
            </button>
          </div>)}
        </> : filteredMoves.slice(0, limit).map((move) => {
          const heading = previousGroup !== move.group;
          previousGroup = move.group;
          const chosen = draft.some((name) => choiceId(name) === move.id);
          const Category = move.category === "Physical" ? Swords : move.category === "Special" ? Sparkles : CircleDot;
          return <div key={move.id}>
            {heading && <h3 className="teamSelectorGroup">{move.group}</h3>}
            <button type="button" className="teamSelectorRow teamSelectorMove" aria-pressed={chosen}
              disabled={!chosen && selected.length === 4} onClick={() => toggleMove(move.name)}>
              <span className={`pokemonType pokemonType--${move.type}`}>{move.type}</span>
              <Category role="img" aria-label={move.category} />
              <span className="teamSelectorMoveName"><strong>{move.name}{move.level !== null && <em>Lv. {move.level}</em>}</strong><small>{move.description}</small></span>
              <span className="teamSelectorMoveStats"><span>Power <b>{move.power || "—"}</b></span><span>Acc. <b>{move.accuracy === "Always" ? "—" : move.accuracy}</b></span><span><b>{move.pp}</b> PP</span></span>
              {chosen && <Check className="teamSelectorCheck" aria-hidden="true" />}
            </button>
          </div>;
        })}
        {(kind === "item" ? itemChoices.length : filteredMoves.length) === 0 && <p className="teamSelectorEmpty">No {kind === "item" ? "items" : "moves"} found. {kind === "moves" && !allMoves ? "Try browsing all moves." : "Try a different search."}</p>}
        {(kind === "item" ? itemChoices.length : filteredMoves.length) > limit && <button type="button" className="teamSelectorMore" onClick={() => setLimit(limit + 80)}>Show more results</button>}
      </div>
      <footer className="teamSelectorFooter">
        {kind === "moves" ? <>
          <button type="button" onClick={() => { setAllMoves(!allMoves); setLimit(80); }}>{allMoves ? "Show learned moves" : "Show all moves"}</button>
          <p>Availability varies by format. Check legality with team validation.</p>
          <div><button type="button" onClick={onClose}>Cancel</button><button type="button" className="teamSelectorApply"
            onClick={() => { onUpdate({ moves: draft }); onClose(); }}>Apply moves</button></div>
        </> : <p>Select an item to equip it immediately.</p>}
      </footer>
    </div>
  </dialog>;
}
