import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPokemonById, getPokemonSpeciesDetails } from "../services/pokeApi";
import { getCompetitiveStats } from "../services/showdownData";

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

function formatLabel(value = "") {
  return value.replaceAll("-", " ");
}

function toSlug(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TeamPokemonEditor({ pokemon, slotIndex, format, onClose, onUpdate }) {
  const [details, setDetails] = useState(null);
  const [species, setSpecies] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formChanging, setFormChanging] = useState(false);
  const [formError, setFormError] = useState("");
  const [activeTab, setActiveTab] = useState("set");

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
        let speciesDetails = null;

        if (pokemonDetails) {
          try {
            speciesDetails = await getPokemonSpeciesDetails(
              pokemonDetails.speciesName ?? pokemon.speciesName ?? pokemon.name,
              controller.signal,
            );
          } catch (error) {
            if (error.name === "AbortError") return;
          }
        }
        if (controller.signal.aborted) return;

        setDetails(pokemonDetails);
        setSpecies(speciesDetails);
        setSuggestions(statsResult.status === "fulfilled" ? statsResult.value : null);
      } catch (error) {
        if (error.name !== "AbortError") {
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
  const moveOptions = details?.moves.map(({ name }) => formatLabel(name)) ?? [];

  function updateMove(index, value) {
    const moves = Array.from(
      { length: 4 },
      (_, moveIndex) => pokemon.moves?.[moveIndex] ?? "",
    );
    moves[index] = value;
    onUpdate({ moves });
  }

  function updateEv(stat, value) {
    const numericValue = Math.min(252, Math.max(0, Number(value) || 0));
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
          <h2>{pokemon.name}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Pokémon editor">
          <X />
        </button>
      </header>

      {loading && <p className="teamEditorStatus">Loading set data...</p>}

      {!loading && (
        <>
          <div className="teamEditorTabs" role="tablist" aria-label="Pokémon set sections">
            {[
              ["set", "Set"],
              ["moves", "Moves & EVs"],
              ["analysis", "Analysis"],
            ].map(([tab, label]) => (
              <button
                type="button"
                role="tab"
                id={`team-editor-${tab}-tab-${slotIndex}`}
                aria-controls={`team-editor-${tab}-panel-${slotIndex}`}
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "isActive" : ""}
                onClick={() => setActiveTab(tab)}
                key={tab}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "set" && (
            <div
              className="teamEditorTabPanel"
              id={`team-editor-set-panel-${slotIndex}`}
              role="tabpanel"
              aria-labelledby={`team-editor-set-tab-${slotIndex}`}
            >
              {suggestions && (
                <button
                  className="applyPopularSet"
                  type="button"
                  onClick={applyPopularSetup}
                >
                  Apply popular setup
                </button>
              )}

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

                <label>
                  Item
                  <input
                    list={`item-suggestions-${slotIndex}`}
                    value={pokemon.item ?? ""}
                    onChange={(event) => onUpdate({ item: event.target.value })}
                  />
                  <datalist id={`item-suggestions-${slotIndex}`}>
                    {suggestions?.items.map(({ name }) => <option value={name} key={name} />)}
                  </datalist>
                </label>

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
              aria-labelledby={`team-editor-moves-tab-${slotIndex}`}
            >
              <fieldset className="teamEvEditor">
                <legend>
                  EVs <span className={evTotal > 510 ? "isInvalid" : ""}>{evTotal}/510</span>
                </legend>
                {EV_FIELDS.map(([stat, label]) => (
                  <label key={stat}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      max="252"
                      value={pokemon.evs?.[stat] ?? 0}
                      onChange={(event) => updateEv(stat, event.target.value)}
                    />
                  </label>
                ))}
              </fieldset>

              <fieldset className="teamIvEditor">
                <legend>IVs</legend>
                {EV_FIELDS.map(([stat, label]) => (
                  <label key={stat}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      max="31"
                      value={pokemon.ivs?.[stat] ?? 31}
                      onChange={(event) => updateIv(stat, event.target.value)}
                    />
                  </label>
                ))}
              </fieldset>

              <fieldset className="teamMoveEditor">
                <legend>Moves</legend>
                <datalist id={`move-options-${slotIndex}`}>
                  {moveOptions.map((move) => <option value={move} key={move} />)}
                </datalist>
                {Array.from({ length: 4 }, (_, index) => (
                  <label key={`move-${index + 1}`}>
                    Move {index + 1}
                    <input
                      list={`move-options-${slotIndex}`}
                      value={pokemon.moves?.[index] ?? ""}
                      onChange={(event) => updateMove(index, event.target.value)}
                    />
                  </label>
                ))}
              </fieldset>
            </div>
          )}

          {activeTab === "analysis" && (
            <div
              className="teamEditorTabPanel teamEditorAnalysis"
              id={`team-editor-analysis-panel-${slotIndex}`}
              role="tabpanel"
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
        </>
      )}
    </section>
  );
}

export default TeamPokemonEditor;
