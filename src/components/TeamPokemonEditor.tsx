import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChartColumn, SlidersHorizontal, Sparkles, Swords, X } from "lucide-react";
import type { CSSProperties, KeyboardEvent } from "react";
import { isErrorNamed } from "../services/errors";
import { getPokemonById, getPokemonSpeciesDetails } from "../services/pokeApi";
import type { PokemonDetails, PokemonSpeciesDetails } from "../services/pokeApi";
import { getCompetitiveStats } from "../services/showdownData";
import { getMoveChoices } from "../services/teamSetChoices";
import { pokeApiStatsToBlock } from "../services/statCalculator";
import FinalStats from "./FinalStats";
import "./TeamPokemonEditor.css";

const TeamSetSelector = lazy(() => import("./TeamSetSelector"));

const NATURES = [
  "Adamant", "Bashful", "Bold", "Brave", "Calm", "Careful", "Docile",
  "Gentle", "Hardy", "Hasty", "Impish", "Jolly", "Lax", "Lonely",
  "Mild", "Modest", "Naive", "Naughty", "Quiet", "Quirky", "Rash",
  "Relaxed", "Sassy", "Serious", "Timid",
];
const TERA_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting",
  "poison", "ground", "flying", "psychic", "bug", "rock", "ghost",
  "dragon", "dark", "steel", "fairy",
];
const EV_FIELDS = [
  ["hp", "HP"], ["attack", "Atk"], ["defense", "Def"],
  ["specialAttack", "SpA"], ["specialDefense", "SpD"], ["speed", "Spe"],
];

const EDITOR_TABS = [
  { id: "set", label: "Set", hint: "Identity & equipment", icon: SlidersHorizontal },
  { id: "moves", label: "Moves & EVs", hint: "Moves & training", icon: Swords },
  { id: "analysis", label: "Analysis", hint: "Competitive insights", icon: ChartColumn },
];

function formatLabel(value = "") {
  return value.replaceAll("-", " ");
}

function toSlug(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TeamPokemonEditor({ pokemon, slotIndex, format, onClose, onUpdate }) {
  const title = useRef<HTMLHeadingElement>(null);
  const selectorTrigger = useRef<HTMLButtonElement>(null);
  const [details, setDetails] = useState<PokemonDetails | null>(null);
  const [species, setSpecies] = useState<PokemonSpeciesDetails | null>(null);
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof getCompetitiveStats>>>(null);
  const [loading, setLoading] = useState(true);
  const [formChanging, setFormChanging] = useState(false);
  const [formError, setFormError] = useState("");
  const [activeTab, setActiveTab] = useState("set");
  const [selector, setSelector] = useState<{ kind: "item" | "moves"; slot?: number } | null>(null);

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    if (window.innerWidth <= 820) title.current?.scrollIntoView({ block: "start" });
  }, [pokemon.id]);

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? EDITOR_TABS.length - 1
      : (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + EDITOR_TABS.length) % EDITOR_TABS.length;
    setActiveTab(EDITOR_TABS[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadEditorData() {
      try {
        setLoading(true);
        const [detailResult, statsResult] = await Promise.allSettled([
          getPokemonById(pokemon.id, controller.signal),
          getCompetitiveStats(pokemon.name, format),
        ]);
        if (controller.signal.aborted) return;

        const pokemonDetails = detailResult.status === "fulfilled"
          ? detailResult.value
          : null;
        let speciesDetails: PokemonSpeciesDetails | null = null;

        if (pokemonDetails) {
          try {
            speciesDetails = await getPokemonSpeciesDetails(
              pokemonDetails.speciesName ?? pokemon.speciesName ?? pokemon.name,
              controller.signal,
            );
          } catch (error) {
            if (isErrorNamed(error, "AbortError")) return;
          }
        }
        if (controller.signal.aborted) return;

        setDetails(pokemonDetails);
        setSpecies(speciesDetails);
        setSuggestions(statsResult.status === "fulfilled" ? statsResult.value : null);
      } catch (error) {
        if (!isErrorNamed(error, "AbortError")) {
          setDetails(null);
          setSuggestions(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadEditorData();
    return () => controller.abort();
  }, [format, pokemon.id, pokemon.name, pokemon.speciesName]);

  const evTotal = Object.values(pokemon.evs ?? {})
    .reduce<number>((total, value) => total + (Number(value) || 0), 0);
  const moveTypes = useMemo(() => new Map(getMoveChoices(details?.moves ?? [], false).map(({ id, type }) => [id, type])), [details?.moves]);
  const baseStats = details?.stats ? pokeApiStatsToBlock(details.stats) : null;
  const isShedinja =
    (details?.speciesName ?? pokemon.speciesName ?? "").toLowerCase() ===
    "shedinja";

  function updateEv(stat, value) {
    const otherEvs = evTotal - (Number(pokemon.evs?.[stat]) || 0);
    const numericValue = Math.min(252, Math.max(0, 510 - otherEvs), Math.max(0, Number(value) || 0));
    onUpdate({ evs: { ...pokemon.evs, [stat]: numericValue } });
  }

  function updateIv(stat, value) {
    const numericValue = Math.min(31, Math.max(0, Number(value) || 0));
    onUpdate({ ivs: { ...pokemon.ivs, [stat]: numericValue } });
  }

  async function changeForm(event) {
    const formId = Number(event.target.value);
    if (!formId || formId === pokemon.id) return;

    try {
      setFormChanging(true);
      setFormError("");
      const form = await getPokemonById(formId, undefined);
      const abilityExists = form.abilities.some(({ name }) => name === pokemon.ability);
      onUpdate({
        id: form.id,
        name: form.name,
        sprite: form.sprite,
        types: form.types,
        speciesName: form.speciesName,
        ability: abilityExists ? pokemon.ability : form.abilities[0]?.name ?? "",
        teraType: pokemon.teraType || form.types[0] || "",
      });
    } catch {
      setFormError("Unable to change this Pokémon form.");
    } finally {
      setFormChanging(false);
    }
  }

  function applyPopularSetup() {
    const spread = suggestions?.spreads[0];
    onUpdate({
      item: suggestions?.items[0]?.name ?? pokemon.item,
      ability: toSlug(suggestions?.abilities[0]?.name) || pokemon.ability,
      nature: spread?.nature ?? suggestions?.natures[0]?.name ?? pokemon.nature,
      teraType: toSlug(suggestions?.teraTypes[0]?.name) || pokemon.teraType,
      evs: spread?.evs ?? pokemon.evs,
      moves: Array.from(
        { length: 4 },
        (_, index) => suggestions?.moves[index]?.name ?? pokemon.moves?.[index] ?? "",
      ),
    });
  }

  return (
    <section className="teamPokemonEditor" aria-label={`Edit ${pokemon.name}`}>
      <header>
        <div>
          <span>Slot {slotIndex + 1}</span>
          <h2 ref={title} tabIndex={-1}>{formatLabel(pokemon.name)}</h2>
          <p className="teamEditorSaveNote">Changes save automatically</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Pokémon editor">
          <X />
        </button>
      </header>

      {loading && <p className="teamEditorStatus">Loading set data...</p>}

      {!loading && (
        <>
          <div className="teamEditorLayout">
            <div className="teamEditorTabs" role="tablist" aria-label="Pokémon set sections" aria-orientation="vertical">
              {EDITOR_TABS.map(({ id: tab, label, hint, icon: Icon }, index) => (
                <button type="button" role="tab" id={`team-editor-${tab}-tab-${slotIndex}`}
                  aria-controls={`team-editor-${tab}-panel-${slotIndex}`}
                  aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1}
                  className={activeTab === tab ? "isActive" : ""}
                  onClick={() => setActiveTab(tab)} onKeyDown={(event) => navigateTabs(event, index)} key={tab}>
                  <span className="teamEditorTabIcon" aria-hidden="true">
                    <Icon />
                    <Icon className="teamEditorTabIconAccent" />
                  </span>
                  <span>{label}<small aria-hidden="true">{hint}</small></span>
                </button>
              ))}
            </div>
            <div className="teamEditorContent">

              {activeTab === "set" && (
                <div
                  className="teamEditorTabPanel"
                  id={`team-editor-set-panel-${slotIndex}`}
                  role="tabpanel"
                  tabIndex={0}
                  aria-labelledby={`team-editor-set-tab-${slotIndex}`}
                >
                  <div className="teamEditorPreset">
                    <div><h3>Set essentials</h3><p>Choose the details that define this Pokémon’s role.</p></div>
                    {suggestions && (
                      <button className="applyPopularSet" type="button" onClick={applyPopularSetup}>
                        <Sparkles aria-hidden="true" /> Apply popular setup
                      </button>
                    )}
                  </div>

                  <div className="teamEditorFields">
                    <label>
                      Form
                      <select
                        value={pokemon.id}
                        disabled={formChanging || !species?.varieties.length}
                        onChange={changeForm}
                      >
                        {(species?.varieties ?? [{ id: pokemon.id, name: pokemon.name }])
                          .map((variety) => (
                            <option value={variety.id} key={variety.id}>
                              {formatLabel(variety.name)}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      Level
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pokemon.level ?? 100}
                        onChange={(event) => onUpdate({
                          level: Math.min(100, Math.max(1, Number(event.target.value) || 1)),
                        })}
                      />
                    </label>

                    <label>
                      Gender
                      <select
                        value={species?.genderRate === -1 ? "genderless" : pokemon.gender ?? ""}
                        onChange={(event) => onUpdate({ gender: event.target.value })}
                      >
                        <option value="">Unspecified</option>
                        {species?.genderRate === -1 ? (
                          <option value="genderless">Genderless</option>
                        ) : (
                          <>
                            {species?.genderRate !== 8 && <option value="male">Male</option>}
                            {species?.genderRate !== 0 && <option value="female">Female</option>}
                          </>
                        )}
                      </select>
                    </label>

                    <div className="teamEditorSelectorField">
                      <span>Item</span>
                      <button type="button" className="teamEditorChoice" aria-label="Item" aria-haspopup="dialog"
                        onClick={(event) => { selectorTrigger.current = event.currentTarget; setSelector({ kind: "item" }); }}>
                        {pokemon.item && <img className="teamEditorItemIcon" alt="" loading="lazy"
                          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${pokemon.item.toLowerCase().replaceAll(" ", "-")}.png`}
                          onError={(event) => { event.currentTarget.hidden = true; }} />}
                        <span>{formatLabel(pokemon.item) || "Choose an item"}</span><ChevronDown aria-hidden="true" />
                      </button>
                    </div>

                    <label>
                      Ability
                      <select
                        value={pokemon.ability ?? ""}
                        onChange={(event) => onUpdate({ ability: event.target.value })}
                      >
                        <option value="">Choose ability</option>
                        {details?.abilities.map(({ name }) => (
                          <option value={name} key={name}>{formatLabel(name)}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Nature
                      <select
                        value={pokemon.nature ?? ""}
                        onChange={(event) => onUpdate({ nature: event.target.value })}
                      >
                        <option value="">Choose nature</option>
                        {NATURES.map((nature) => <option value={nature} key={nature}>{nature}</option>)}
                      </select>
                    </label>

                    <label>
                      Tera Type
                      <select
                        value={pokemon.teraType ?? ""}
                        onChange={(event) => onUpdate({ teraType: event.target.value })}
                      >
                        {TERA_TYPES.map((type) => (
                          <option value={type} key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {formError && <p className="teamEditorFieldError" role="alert">{formError}</p>}
                </div>
              )}

              {activeTab === "moves" && (
                <div
                  className="teamEditorTabPanel"
                  id={`team-editor-moves-panel-${slotIndex}`}
                  role="tabpanel"
                  tabIndex={0}
                  aria-labelledby={`team-editor-moves-tab-${slotIndex}`}
                >
                  <div className="teamEditorPanelIntro">
                    <h3>Moves & training</h3>
                    <p>Build a moveset and balance the stats for your strategy.</p>
                  </div>
                  <div className="teamTrainingLayout">
                    <fieldset className="teamEvEditor">
                      <legend>EVs & IVs</legend>
                      <p className={`teamEvBudget${evTotal > 510 ? " isInvalid" : ""}`}>Total: {evTotal}/510 <small>({Math.max(0, 510 - evTotal)} Remaining)</small></p>
                      <div className="teamEvHead" aria-hidden="true"><span></span><span>EVs</span><span></span><span>IVs</span></div>
                      {EV_FIELDS.map(([stat, label]) => (
                        <div className="teamEvRow" key={stat}>
                          <span className="teamEvStat">{label}</span>
                          <input aria-label={`${label} EVs`} type="number" min="0"
                            max="252"
                            value={pokemon.evs?.[stat] ?? 0} onChange={(event) => updateEv(stat, event.target.value)} />
                          <input aria-label={`${label} EV slider`} className="teamEvSlider" type="range" min="0" max="252" step="1"
                            value={pokemon.evs?.[stat] ?? 0}
                            style={{ "--ev-progress": `${((Number(pokemon.evs?.[stat]) || 0) / 252) * 100}%` } as CSSProperties}
                            onChange={(event) => updateEv(stat, event.target.value)} />
                          <div className="teamIvControl">
                            <input aria-label={`${label} IVs`} type="number" min="0" max="31"
                              value={pokemon.ivs?.[stat] ?? 31} onChange={(event) => updateIv(stat, event.target.value)} />
                            <input aria-label={`${label} IV slider`} className="teamIvSlider" type="range" min="0" max="31" step="1"
                              value={pokemon.ivs?.[stat] ?? 31}
                              style={{ "--iv-progress": `${((Number(pokemon.ivs?.[stat] ?? 31)) / 31) * 100}%` } as CSSProperties}
                              onChange={(event) => updateIv(stat, event.target.value)} />
                          </div>
                        </div>
                      ))}
                    </fieldset>

                    {baseStats ? (
                      <FinalStats
                        variant="radar"
                        baseStats={baseStats}
                        ivs={pokemon.ivs}
                        evs={pokemon.evs}
                        nature={pokemon.nature}
                        level={pokemon.level ?? 100}
                        isShedinja={isShedinja}
                      />
                    ) : (
                      <div className="teamEditorAnalysisEmpty teamTrainingStatsEmpty">
                        <h3>Final stats unavailable</h3>
                        <p>Unable to load this Pokémon’s base stats. Reopen the editor to try again.</p>
                      </div>
                    )}

                    <fieldset className="teamMoveEditor">
                      <legend>Moves</legend>
                      {Array.from({ length: 4 }, (_, index) => (
                        <div className="teamEditorSelectorField" key={`move-${index + 1}`}>
                          <span>Move {index + 1}</span>
                          <button type="button" className="teamEditorChoice" aria-label={`Move ${index + 1}`} aria-haspopup="dialog"
                            onClick={(event) => { selectorTrigger.current = event.currentTarget; setSelector({ kind: "moves", slot: index }); }}>
                            <span>{formatLabel(pokemon.moves?.[index]) || "Choose a move"}</span>
                            {pokemon.moves?.[index] && moveTypes.has(pokemon.moves[index].toLowerCase().replace(/[^a-z0-9]+/g, "")) && (() => {
                              const type = moveTypes.get(pokemon.moves[index].toLowerCase().replace(/[^a-z0-9]+/g, ""));
                              return <span className={`pokemonType pokemonType--${type}`}>{type}</span>;
                            })()}
                            <ChevronDown aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </fieldset>
                  </div>
                </div>
              )}

              {activeTab === "analysis" && (
                <div
                  className="teamEditorTabPanel teamEditorAnalysis"
                  id={`team-editor-analysis-panel-${slotIndex}`}
                  role="tabpanel"
                  tabIndex={0}
                  aria-labelledby={`team-editor-analysis-tab-${slotIndex}`}
                >
                  {suggestions ? (
                    <>
                      <div className="teamEditorRecommendationHeader">
                        <div>
                          <span>Competitive recommendation</span>
                          <h3>Popular setup</h3>
                        </div>
                        <button
                          className="applyPopularSet"
                          type="button"
                          onClick={applyPopularSetup}
                        >
                          Apply popular setup
                        </button>
                      </div>
                      <dl className="teamEditorRecommendations">
                        <div><dt>Item</dt><dd>{suggestions.items[0]?.name ?? "No data"}</dd></div>
                        <div><dt>Ability</dt><dd>{suggestions.abilities[0]?.name ?? "No data"}</dd></div>
                        <div>
                          <dt>Nature</dt>
                          <dd>{suggestions.spreads[0]?.nature ?? suggestions.natures[0]?.name ?? "No data"}</dd>
                        </div>
                        <div><dt>Tera Type</dt><dd>{suggestions.teraTypes[0]?.name ?? "No data"}</dd></div>
                      </dl>
                      <section className="teamEditorRecommendedMoves">
                        <h3>Recommended moves</h3>
                        <ul>
                          {suggestions.moves.slice(0, 4).map(({ name }) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      </section>
                    </>
                  ) : (
                    <div className="teamEditorAnalysisEmpty">
                      <h3>No competitive sample available</h3>
                      <p>You can still create this set manually in the other tabs.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {selector && <Suspense fallback={<p className="teamEditorStatus" role="status">Loading selector…</p>}>
        <TeamSetSelector kind={selector.kind} slot={selector.slot} item={pokemon.item ?? ""}
          moves={pokemon.moves ?? []} learnedMoves={details?.moves ?? []}
          preferredItems={suggestions?.items.map(({ name }) => name) ?? []}
          onUpdate={onUpdate} onClose={() => {
            setSelector(null);
            requestAnimationFrame(() => selectorTrigger.current?.focus({ preventScroll: true }));
          }} />
      </Suspense>}
    </section>
  );
}

export default TeamPokemonEditor;
