import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Layers3,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import "./PokemonShared.css";
import "./TeamBuilderPage.css";
import { MAX_TEAM_SIZE } from "../services/teamStorage";
import { getMoveType, searchPokemon } from "../services/pokeApi";
import { COMPETITIVE_FORMATS } from "../services/showdownData";
import {
  CAMPAIGN_GAMES,
  getCampaignGame,
  getCampaignMilestones,
} from "../services/campaignData";
import {
  POKEMON_TYPES,
  analyzeOffensiveCoverage,
  analyzeTeamDefense,
} from "../services/teamAnalysis";
import TeamPokemonEditor from "./TeamPokemonEditor";
import TeamAiAssistant from "./TeamAiAssistant";
import TeamTransfer from "./TeamTransfer";

function TeamBuilderPage({
  team,
  format,
  onFormatChange,
  onImportTeam,
  onMovePokemon,
  onRemovePokemon,
  onSetPokemon,
  onUpdatePokemon,
}) {
  const slots = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => team[index]);
  const [activeSlot, setActiveSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [editingSlot, setEditingSlot] = useState(null);
  const [showTeamAnalysis, setShowTeamAnalysis] = useState(true);
  const [builderMode, setBuilderMode] = useState("competitive");
  const [campaignGameId, setCampaignGameId] = useState("emerald");
  const [campaignMilestoneId, setCampaignMilestoneId] = useState("before-roxanne");
  const [moveTypeState, setMoveTypeState] = useState({
    key: "",
    types: [],
  });
  const teamMembers = slots.filter(Boolean);
  const configuredSets = teamMembers.filter((member) =>
    member.item && member.ability && member.nature &&
    member.moves?.filter(Boolean).length === 4,
  ).length;
  const teamTypes = [...new Set(teamMembers.flatMap((member) => member.types))];
  const selectedSlot = activeSlot ?? editingSlot;
  const focusedSlot = selectedSlot ?? slots.findIndex(Boolean);
  const focusedPokemon = focusedSlot >= 0 ? slots[focusedSlot] : null;
  const selectedMoves = useMemo(() => [...new Set(
    team
      .filter(Boolean)
      .flatMap((member) => member.moves ?? [])
      .filter(Boolean),
  )].sort(), [team]);
  const selectedMoveKey = selectedMoves.join("|");
  const defensiveAnalysis = analyzeTeamDefense(teamMembers);
  const currentMoveTypes = moveTypeState.key === selectedMoveKey
    ? moveTypeState.types
    : [];
  const offensiveAnalysis = analyzeOffensiveCoverage(currentMoveTypes);
  const campaignGame = getCampaignGame(campaignGameId);
  const campaignMilestones = getCampaignMilestones(campaignGame.id);
  const campaignMilestone = campaignMilestones.find(({ id }) => id === campaignMilestoneId)
    ?? campaignMilestones[0];
  const campaign = builderMode === "campaign" ? {
    gameId: campaignGame.id,
    gameLabel: campaignGame.label,
    milestoneId: campaignMilestone.id,
    milestoneLabel: campaignMilestone.label,
  } : null;
  const coverageIsLoading = selectedMoves.length > 0 &&
    moveTypeState.key !== selectedMoveKey;
  useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase().replace(/^#/, "");
    if (activeSlot === null || !normalizedQuery) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError("");
        const data = await searchPokemon(
          normalizedQuery,
          8,
          controller.signal,
        );
        setSearchResults(data.pokemon);
        if (!data.pokemon.length) setSearchError("No Pokémon was found.");
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setSearchError("Unable to search for Pokémon.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeSlot, searchQuery]);

  useEffect(() => {
    if (!selectedMoves.length) return undefined;

    const controller = new AbortController();

    Promise.allSettled(
      selectedMoves.map((move) => getMoveType(move, controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return;

      setMoveTypeState({
        key: selectedMoveKey,
        types: results
          .filter((result) =>
            result.status === "fulfilled" &&
            POKEMON_TYPES.includes(result.value),
          )
          .map((result) => result.value),
      });
    });

    return () => controller.abort();
  }, [selectedMoveKey, selectedMoves]);

  function openPokemonSearch(slotIndex) {
    setShowTeamAnalysis(false);
    setEditingSlot(null);
    setActiveSlot(slotIndex);
    setSearchQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError("");
  }

  function closePokemonSearch() {
    setActiveSlot(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError("");
  }

  function selectPokemon(pokemon) {
    const selectedSlot = activeSlot;
    onSetPokemon(selectedSlot, pokemon);
    closePokemonSearch();
    setShowTeamAnalysis(false);
    setEditingSlot(selectedSlot);
  }

  function openPokemonEditor(slotIndex) {
    closePokemonSearch();
    setShowTeamAnalysis(false);
    setEditingSlot(slotIndex);
  }

  function openTeamAnalysis() {
    closePokemonSearch();
    setEditingSlot(null);
    setShowTeamAnalysis(true);
  }

  function removePokemon(slotIndex) {
    if (editingSlot === slotIndex) setEditingSlot(null);
    onRemovePokemon(slotIndex);
  }

  const teamAnalysisSections = (
    <>
      <div className="teamAnalysisHeader">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span>Live overview</span>
          <h2>Team status</h2>
        </div>
      </div>
      <div className="teamAnalysisMetrics">
        <div><span>Members</span><strong>{teamMembers.length}/6</strong></div>
        <div><span>Complete sets</span><strong>{configuredSets}/6</strong></div>
        <div><span>Types</span><strong>{teamTypes.length}</strong></div>
        <div>
          <span>Moves</span>
          <strong>{teamMembers.reduce(
            (total, member) => total + (member.moves?.filter(Boolean).length ?? 0),
            0,
          )}/24</strong>
        </div>
      </div>
      <section className="teamTypeCoverage">
        <h3>Team types</h3>
        {teamTypes.length ? (
          <div className="pokemonTypes">
            {teamTypes.map((type) => (
              <span className={`pokemonType pokemonType--${type}`} key={type}>
                {type}
              </span>
            ))}
          </div>
        ) : (
          <p>No type data yet.</p>
        )}
      </section>
      <section className="teamMatchupAnalysis">
        <div className="teamAnalysisSectionTitle">
          <h3>Shared weaknesses</h3>
          <span>{defensiveAnalysis.sharedWeaknesses.length}</span>
        </div>
        {defensiveAnalysis.sharedWeaknesses.length ? (
          <ul>
            {defensiveAnalysis.sharedWeaknesses.map((matchup) => (
              <li key={matchup.type}>
                <span className={`pokemonType pokemonType--${matchup.type}`}>
                  {matchup.type}
                </span>
                <strong>
                  {matchup.weakCount} weak · up to ×{matchup.highestMultiplier}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {teamMembers.length < 2
              ? "Add at least two members to compare weaknesses."
              : "No weakness is shared by multiple members."}
          </p>
        )}
      </section>
      <section className="teamMatchupAnalysis">
        <div className="teamAnalysisSectionTitle">
          <h3>Defensive answers</h3>
          <span>{defensiveAnalysis.resistances.length}</span>
        </div>
        {defensiveAnalysis.resistances.length ? (
          <ul>
            {defensiveAnalysis.resistances.map((matchup) => (
              <li key={matchup.type}>
                <span className={`pokemonType pokemonType--${matchup.type}`}>
                  {matchup.type}
                </span>
                <strong>
                  {matchup.resistCount + matchup.immuneCount} resist
                  {matchup.immuneCount ? ` · ${matchup.immuneCount} immune` : ""}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No type has two defensive answers yet.</p>
        )}
      </section>
      <section className="teamOffensiveCoverage">
        <div className="teamAnalysisSectionTitle">
          <h3>Offensive coverage</h3>
          <span>{offensiveAnalysis.coveredTypes.length}/18</span>
        </div>
        {coverageIsLoading ? (
          <p>Analyzing move types...</p>
        ) : offensiveAnalysis.coveredTypes.length ? (
          <>
            <div className="teamCoverageTypes">
              {offensiveAnalysis.coveredTypes.map((type) => (
                <span className={`pokemonType pokemonType--${type}`} key={type}>
                  {type}
                </span>
              ))}
            </div>
            <small>
              Super-effective coverage from {offensiveAnalysis.moveTypes.length}
              {" "}selected move type{offensiveAnalysis.moveTypes.length === 1 ? "" : "s"}.
            </small>
          </>
        ) : (
          <p>Add moves to calculate offensive coverage.</p>
        )}
      </section>
    </>
  );

  return (
    <main className="content teamBuilderPage">
      <section className="teamBuilderConsole">
        <header className="teamBuilderHeader">
          <div className="teamBuilderTitle">
            <span>Battle terminal</span>
            <h1>Team Builder</h1>
          </div>
          <div className="teamModeControls">
            <div className="teamModeSwitch" role="group" aria-label="Builder mode">
              <button
                type="button"
                className={builderMode === "competitive" ? "isActive" : ""}
                onClick={() => setBuilderMode("competitive")}
              >Competitive</button>
              <button
                type="button"
                className={builderMode === "campaign" ? "isActive" : ""}
                onClick={() => setBuilderMode("campaign")}
              >Main games</button>
            </div>
            {builderMode === "competitive" ? (
              <label>
                Format
                <select value={format} onChange={(event) => onFormatChange(event.target.value)}>
                  {COMPETITIVE_FORMATS.map((competitiveFormat) => (
                    <option value={competitiveFormat.id} key={competitiveFormat.id}>
                      {competitiveFormat.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Game
                  <select value={campaignGameId} onChange={(event) => {
                    const nextGame = event.target.value;
                    setCampaignGameId(nextGame);
                    setCampaignMilestoneId(getCampaignMilestones(nextGame)[0]?.id ?? "");
                  }}>
                    {CAMPAIGN_GAMES.map((game) => <option value={game.id} key={game.id}>{game.label}</option>)}
                  </select>
                </label>
                <label>
                  Progress
                  <select value={campaignMilestone.id} onChange={(event) => setCampaignMilestoneId(event.target.value)}>
                    {campaignMilestones.map((milestone) => <option value={milestone.id} key={milestone.id}>{milestone.label}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
        </header>

        <aside className="teamPokemonInspector" aria-label="Selected Pokémon">
          {focusedPokemon ? (
            <>
              <header>
                <span>Lv. {focusedPokemon.level ?? 100}</span>
                <strong>
                  {focusedPokemon.name}
                  {focusedPokemon.gender === "male" && " ♂"}
                  {focusedPokemon.gender === "female" && " ♀"}
                </strong>
              </header>
              <div className="teamInspectorStage">
                <span aria-hidden="true" />
                <img src={focusedPokemon.sprite} alt={focusedPokemon.name} />
              </div>
              <div className="pokemonTypes">
                {focusedPokemon.types.map((type) => (
                  <span className={`pokemonType pokemonType--${type}`} key={type}>
                    {type}
                  </span>
                ))}
              </div>
              <dl className="teamInspectorData">
                <div><dt>Held item</dt><dd>{focusedPokemon.item || "None"}</dd></div>
                <div><dt>Ability</dt><dd>{focusedPokemon.ability || "Not selected"}</dd></div>
                <div><dt>Nature</dt><dd>{focusedPokemon.nature || "Not selected"}</dd></div>
                <div><dt>Tera Type</dt><dd>{focusedPokemon.teraType || "Not selected"}</dd></div>
              </dl>
            </>
          ) : (
            <div className="teamInspectorEmpty">
              <span className="emptyPokeball" aria-hidden="true" />
              <strong>No Pokémon selected</strong>
              <p>Choose an empty party slot to begin.</p>
            </div>
          )}
        </aside>

        <section className="teamRoster" aria-labelledby="team-roster-title">
          <div className="teamSectionHeading">
            <div>
              <span>Current team</span>
              <h2 id="team-roster-title">Party</h2>
            </div>
            <strong>{teamMembers.length}/{MAX_TEAM_SIZE}</strong>
          </div>

          <div className="teamSlots" aria-label="Team slots">
            {slots.map((pokemon, index) => pokemon ? (
              <article
                className={`teamSlot teamSlot--filled ${selectedSlot === index ? "isActive" : ""}`}
                key={pokemon.id}
              >
                <span className="teamSlotNumber">Slot {index + 1}</span>
                <img src={pokemon.sprite} alt={pokemon.name} />
                <div className="teamSlotIdentity">
                  <h2>{pokemon.name}</h2>
                  <div className="pokemonTypes">
                    {pokemon.types.map((type) => (
                      <span className={`pokemonType pokemonType--${type}`} key={type}>
                        {type}
                      </span>
                    ))}
                  </div>
                  <p className="teamSlotItem">
                    Lv. {pokemon.level ?? 100}
                    {pokemon.gender === "male" && " · ♂"}
                    {pokemon.gender === "female" && " · ♀"}
                    {` · ${pokemon.item || "No item selected"}`}
                  </p>
                </div>
                {pokemon.moves?.some(Boolean) ? (
                  <ul className="teamSlotMoves">
                    {pokemon.moves.filter(Boolean).map((move) => (
                      <li key={move}>{move}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="teamSlotNoMoves">No moves selected</p>
                )}
                <div className="teamSlotActions">
                  <button
                    type="button"
                    onClick={() => openPokemonEditor(index)}
                    aria-label={`Edit ${pokemon.name}`}
                  >
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMovePokemon(index, -1)}
                    aria-label={`Move ${pokemon.name} left`}
                  >
                    <ArrowLeft />
                  </button>
                  <button
                    type="button"
                    disabled={index === MAX_TEAM_SIZE - 1}
                    onClick={() => onMovePokemon(index, 1)}
                    aria-label={`Move ${pokemon.name} right`}
                  >
                    <ArrowRight />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePokemon(index)}
                    aria-label={`Remove ${pokemon.name}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            ) : (
              <article
                className={`teamSlot teamSlot--empty ${selectedSlot === index ? "isActive" : ""}`}
                key={`empty-${index + 1}`}
              >
                <span className="teamSlotNumber">Slot {index + 1}</span>
                <span className="emptyPokeball" aria-hidden="true" />
                <div>
                  <h2>Empty slot</h2>
                  <p>Ready for a new partner.</p>
                </div>
                <button type="button" onClick={() => openPokemonSearch(index)}>
                  Add Pokémon
                </button>
              </article>
            ))}
          </div>
          <button className="teamAnalyzeButton" type="button" onClick={openTeamAnalysis}>
            <ShieldCheck aria-hidden="true" />
            Analyze
          </button>
        </section>

        <div className="teamBuilderWorkspace">
          {!showTeamAnalysis && (
            <section className="teamWorkbench" aria-label="Set editor">
            {activeSlot !== null && (
              <section className="teamPokemonPicker" aria-label="Pokémon search">
                <div className="teamPokemonPickerHeader">
                  <div>
                    <span>Slot {activeSlot + 1}</span>
                    <h2>Choose a Pokémon</h2>
                  </div>
                  <button
                    type="button"
                    onClick={closePokemonSearch}
                    aria-label="Close Pokémon search"
                  >
                    <X />
                  </button>
                </div>
                <div className="teamPokemonSearchField">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    autoFocus
                    aria-label="Search Pokémon"
                    value={searchQuery}
                    placeholder="Pikachu, 25 or #025"
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchResults([]);
                      if (!event.target.value.trim()) setSearchLoading(false);
                    }}
                  />
                </div>
                {searchLoading && <p className="teamSearchStatus">Searching...</p>}
                {searchError && (
                  <p className="teamSearchStatus" role="alert">{searchError}</p>
                )}
                {!searchLoading && searchResults.length > 0 && (
                  <div className="teamSearchResults">
                    {searchResults.map((pokemon) => {
                      const alreadyAdded = slots.some(
                        (member) => member?.id === pokemon.id,
                      );

                      return (
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => selectPokemon(pokemon)}
                          aria-label={alreadyAdded
                            ? `${pokemon.name} is already on the team`
                            : `Add ${pokemon.name} to slot ${activeSlot + 1}`}
                          key={pokemon.id}
                        >
                          <img src={pokemon.sprite} alt="" />
                          <span>{pokemon.name}</span>
                          <small>{alreadyAdded ? "Already added" : `#${pokemon.id}`}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {editingSlot !== null && slots[editingSlot] && (
              <TeamPokemonEditor
                key={slots[editingSlot].id}
                pokemon={slots[editingSlot]}
                slotIndex={editingSlot}
                format={format}
                onClose={openTeamAnalysis}
                onUpdate={(settings) => onUpdatePokemon(editingSlot, settings)}
              />
            )}

            {activeSlot === null && editingSlot === null && (
              <div className="teamWorkbenchEmpty">
                <span className="workbenchScreenIcon" aria-hidden="true">
                  <Layers3 />
                </span>
                <h2>Select a team slot</h2>
                <p>Add a Pokémon or edit an existing set to begin.</p>
              </div>
            )}
            </section>
          )}

          <aside
            className={`teamAnalysis ${showTeamAnalysis ? "" : "isCollapsed"}`}
            aria-label="Team overview"
            inert={showTeamAnalysis ? undefined : true}
          >
            {teamAnalysisSections}
            <TeamAiAssistant
              team={slots}
              format={format}
              moveTypes={currentMoveTypes}
              campaign={campaign}
              onApplyTeam={onImportTeam}
            />
          </aside>
        </div>

        <TeamTransfer team={slots} onImportTeam={onImportTeam} />
      </section>
    </main>
  );
}

export default TeamBuilderPage;
