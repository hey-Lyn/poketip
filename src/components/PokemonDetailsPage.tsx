import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { isErrorNamed } from "../services/errors";
import "./PokemonDetailsPage.css";
import "./PokemonShared.css";
import {
  getPokemonById,
  getPokemonEncounters,
  getPokemonSpeciesDetails,
  getPokemonTypeEffectiveness,
} from "../services/pokeApi";
import type { PokemonDetails, PokemonEncounter, PokemonSpeciesDetails, TypeEffectiveness } from "../services/pokeApi";
import {
  COMPETITIVE_FORMATS,
  DEFAULT_COMPETITIVE_FORMAT,
  getCompetitiveFormat,
  getCompetitiveStats,
  getShowdownTier,
} from "../services/showdownData";
import PokemonStats from "./PokemonStats";
import PokemonAiAssistant from "./PokemonAiAssistant";
import TypeDefenses from "./TypeDefenses";
import FinalStats from "./FinalStats";
import { pokeApiStatsToBlock } from "../services/statCalculator";

const VERSION_GROUP_ORDER = [
  "red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire",
  "emerald", "firered-leafgreen", "diamond-pearl", "platinum",
  "heartgold-soulsilver", "black-white", "black-2-white-2", "x-y",
  "omega-ruby-alpha-sapphire", "sun-moon", "ultra-sun-ultra-moon",
  "lets-go-pikachu-lets-go-eevee", "sword-shield",
  "brilliant-diamond-and-shining-pearl", "legends-arceus",
  "scarlet-violet", "the-teal-mask", "the-indigo-disk",
];

const METHOD_LABELS = {
  "level-up": "Level up",
  machine: "TM / HM",
  egg: "Egg",
  tutor: "Tutor",
  reminder: "Move reminder",
  "form-change": "Form change",
};

const GAME_VERSION_ORDER = [
  "red", "blue", "yellow", "gold", "silver", "crystal", "ruby",
  "sapphire", "emerald", "firered", "leafgreen", "diamond", "pearl",
  "platinum", "heartgold", "soulsilver", "black", "white", "black-2",
  "white-2", "x", "y", "omega-ruby", "alpha-sapphire", "sun", "moon",
  "ultra-sun", "ultra-moon", "lets-go-pikachu", "lets-go-eevee", "sword",
  "shield", "brilliant-diamond", "shining-pearl", "legends-arceus",
  "scarlet", "violet",
];

function formatLabel(value: string) {
  return value.replaceAll("-", " ");
}

function getVersionGroups(moves: any): string[] {
  const groups = [...new Set<string>(
    moves.flatMap((move) => move.versions.map((version) => version.versionGroup)),
  )];

  return groups.sort((first, second) => {
    const firstIndex = VERSION_GROUP_ORDER.indexOf(first);
    const secondIndex = VERSION_GROUP_ORDER.indexOf(second);
    return (firstIndex === -1 ? Infinity : firstIndex) -
      (secondIndex === -1 ? Infinity : secondIndex);
  });
}

function sortVersions(versions) {
  return [...versions].sort((first, second) => {
    const firstIndex = GAME_VERSION_ORDER.indexOf(first);
    const secondIndex = GAME_VERSION_ORDER.indexOf(second);
    return (firstIndex === -1 ? Infinity : firstIndex) -
      (secondIndex === -1 ? Infinity : secondIndex);
  });
}

function splitLocationSection(location) {
  const floorMatch = location.match(/^(.*)-(b?\d+f)$/i);
  if (floorMatch) {
    return { location: floorMatch[1], section: floorMatch[2].toUpperCase() };
  }

  const roomMatch = location.match(/^(.*)-room-(\d+)$/i);
  if (roomMatch) {
    return { location: roomMatch[1], section: `Room ${roomMatch[2]}` };
  }

  return { location, section: null };
}

function compactEncounters(encounters) {
  const locations = new Map();

  encounters.forEach((encounter) => {
    const locationPart = splitLocationSection(encounter.location);
    const current = locations.get(locationPart.location) ?? {
      ...encounter,
      location: locationPart.location,
      sections: new Set(),
      methods: new Set(),
      conditions: new Set(),
    };

    if (locationPart.section) current.sections.add(locationPart.section);
    current.methods.add(encounter.method);
    encounter.conditions.forEach((condition) => current.conditions.add(condition));
    current.minLevel = Math.min(current.minLevel, encounter.minLevel);
    current.maxLevel = Math.max(current.maxLevel, encounter.maxLevel);
    current.chance = Math.max(current.chance, encounter.chance);
    locations.set(locationPart.location, current);
  });

  return [...locations.values()].map((location) => ({
    ...location,
    sections: [...location.sections],
    methods: [...location.methods],
    conditions: [...location.conditions],
  }));
}

function getSuggestedRole(pokemon) {
  const stats = Object.fromEntries(
    pokemon.stats.map(({ name, value }) => [name, value]),
  );
  const attack = stats.attack ?? 0;
  const specialAttack = stats["special-attack"] ?? 0;
  const defense = stats.defense ?? 0;
  const specialDefense = stats["special-defense"] ?? 0;
  const hp = stats.hp ?? 0;
  const speed = stats.speed ?? 0;
  const physical = attack >= specialAttack;
  const offense = physical ? "physical" : "special";

  if (hp >= 80 && Math.max(defense, specialDefense) >= 120) {
    return `${defense >= specialDefense ? "Physical" : "Special"} wall`;
  }

  if (speed >= 100 && Math.max(attack, specialAttack) >= 100) {
    return `Fast ${offense} attacker`;
  }

  if (Math.max(attack, specialAttack) >= 100) {
    return `Bulky ${offense} attacker`;
  }

  return `Flexible ${offense} attacker`;
}

function formatPercentage(value) {
  const percentage = value * 100;

  if (percentage > 0 && percentage < 0.01) return "<0.01%";
  if (percentage < 1) return `${percentage.toFixed(2)}%`;
  return `${percentage.toFixed(1)}%`;
}

function CompetitiveStatCard({ title, items, emptyMessage }) {
  return (
    <section className="competitiveStatCard">
      <h3>{title}</h3>
      {items.length ? (
        <ol>
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{formatPercentage(item.value)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p>{emptyMessage}</p>
      )}
    </section>
  );
}

function PokemonDetailsPage() {
  const { pokemonId } = useParams();
  const location = useLocation();
  const [viewParams, setViewParams] = useSearchParams();
  const backTo = location.state?.from ?? "/";
  const isCompetitiveSide = viewParams.get("view") === "competitive";
  const selectedCompetitiveFormat = getCompetitiveFormat(
    viewParams.get("format") ?? DEFAULT_COMPETITIVE_FORMAT,
  );
  const [pokemon, setPokemon] = useState<PokemonDetails | null>(null);
  const [species, setSpecies] = useState<PokemonSpeciesDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFinalStats, setShowFinalStats] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [typeDefenses, setTypeDefenses] = useState<TypeEffectiveness[]>([]);
  const [encounters, setEncounters] = useState<PokemonEncounter[]>([]);
  const [selectedEncounterVersion, setSelectedEncounterVersion] = useState("");
  const [competitiveTier, setCompetitiveTier] = useState({
    formatId: "",
    pokemonName: "",
    value: "",
  });
  type CompetitiveStatsState =
    | { key: string; status: "loading" | "empty" | "error"; data: null }
    | { key: string; status: "ready"; data: NonNullable<Awaited<ReturnType<typeof getCompetitiveStats>>> };
  const [competitiveStats, setCompetitiveStats] = useState<CompetitiveStatsState>({
    key: "",
    status: "loading",
    data: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPokemon() {
      if (!pokemonId) {
        setError("Unable to load this Pokémon.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");
        const pokemonRequest = getPokemonById(Number(pokemonId), controller.signal);
        const speciesRequest = getPokemonSpeciesDetails(
          pokemonId,
          controller.signal,
        );
        const encountersRequest = getPokemonEncounters(
          pokemonId,
          controller.signal,
        );
        const pokemonData = await pokemonRequest;
        const [speciesData, defenses, encounterData] = await Promise.all([
          speciesRequest,
          getPokemonTypeEffectiveness(pokemonData.types, controller.signal),
          encountersRequest,
        ]);
        setPokemon(pokemonData);
        setSpecies(speciesData);
        setTypeDefenses(defenses);
        setEncounters(encounterData);
        setSelectedVersion(getVersionGroups(pokemonData.moves).at(-1) ?? "");
        const encounterVersions = sortVersions(
          new Set(encounterData.map((encounter) => encounter.version)),
        );
        setSelectedEncounterVersion(encounterVersions.at(-1) ?? "");
      } catch (requestError) {
        if (!isErrorNamed(requestError, "AbortError")) {
          setError("Unable to load this Pokémon.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadPokemon();
    return () => controller.abort();
  }, [pokemonId]);

  useEffect(() => {
    if (!pokemon || !species || !isCompetitiveSide) return undefined;

    let isCurrentRequest = true;
    const formatId = selectedCompetitiveFormat.id;
    const pokemonName = species.name ?? pokemon.name;

    getShowdownTier(pokemonName, formatId)
      .then((tier) => {
        if (isCurrentRequest) {
          setCompetitiveTier({ formatId, pokemonName, value: tier });
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setCompetitiveTier({
            formatId,
            pokemonName,
            value: "Unavailable",
          });
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [isCompetitiveSide, pokemon, selectedCompetitiveFormat.id, species]);

  useEffect(() => {
    if (!pokemon || !species || !isCompetitiveSide) return undefined;

    let isCurrentRequest = true;
    const formatId = selectedCompetitiveFormat.id;
    const requestKey = `${formatId}:${pokemon.name}:${species.name}`;

    getCompetitiveStats([pokemon.name, species.name], formatId)
      .then((data) => {
        if (isCurrentRequest) {
          setCompetitiveStats(data
            ? { key: requestKey, status: "ready", data }
            : { key: requestKey, status: "empty", data: null });
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setCompetitiveStats({
            key: requestKey,
            status: "error",
            data: null,
          });
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [isCompetitiveSide, pokemon, selectedCompetitiveFormat.id, species]);

  const movesForVersion = pokemon?.moves
    .flatMap((move) => move.versions
      .filter((version) => version.versionGroup === selectedVersion)
      .map((version) => ({ name: move.name, ...version })),
    )
    .sort((first, second) => {
      if (first.method === "level-up" && second.method !== "level-up") return -1;
      if (first.method !== "level-up" && second.method === "level-up") return 1;
      if (first.method === "level-up" && second.method === "level-up") {
        return first.level - second.level || first.name.localeCompare(second.name);
      }
      return first.method.localeCompare(second.method) ||
        first.name.localeCompare(second.name);
    }) ?? [];
  const encounterVersions = sortVersions(
    new Set(encounters.map((encounter) => encounter.version)),
  );
  const encountersForVersion = compactEncounters(
    encounters.filter(
      (encounter) => encounter.version === selectedEncounterVersion,
    ),
  );
  const legalMoveCount = new Set(movesForVersion.map((move) => move.name)).size;
  const displayedCompetitiveTier =
    competitiveTier.formatId === selectedCompetitiveFormat.id &&
    competitiveTier.pokemonName === (species?.name ?? pokemon?.name) &&
    competitiveTier.value
      ? competitiveTier.value
      : "Loading...";
  const competitiveStatsKey = pokemon && species
    ? `${selectedCompetitiveFormat.id}:${pokemon.name}:${species.name}`
    : "";
  const displayedStats = competitiveStats.key === competitiveStatsKey
    ? competitiveStats
    : { key: competitiveStatsKey, status: "loading", data: null };

  function flipCard() {
    setViewParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);

      if (isCompetitiveSide) nextParams.delete("view");
      else nextParams.set("view", "competitive");

      return nextParams;
    });
  }

  function selectCompetitiveFormat(event) {
    setViewParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("format", event.target.value);
      return nextParams;
    });
  }

  return (
    <main className="content pokemonDetailsPage">
      <Link className="backLink" to={backTo}>← Back to Pokédex</Link>

      {loading && <p className="pokedexStatus">Loading Pokémon...</p>}
      {error && <p className="pokedexStatus" role="alert">{error}</p>}

      {pokemon && species && !loading && (
        <article className="pokemonProfile">
          <div className="pokemonFlipScene">
            <div className={`pokemonFlipCard ${isCompetitiveSide ? "isFlipped" : ""}`}>
              <section
                className="pokemonFlipFace pokemonFlipFront"
                aria-hidden={isCompetitiveSide}
                inert={isCompetitiveSide ? true : undefined}
              >
                <header className="pokemonDeviceHeader">
                  <div className="pokemonDeviceIdentity">
                    <span className="pokemonDeviceBall" aria-hidden="true" />
                    <h1>{pokemon.name}</h1>
                  </div>
                  <strong>#{String(pokemon.id).padStart(4, "0")}</strong>
                </header>

                <div className="pokemonDeviceBody">
                  <div className="pokemonProfileOverview">
                    <div className="pokemonDisplayChamber">
                      <span className="pokemonDisplayRing" aria-hidden="true" />
                      <img
                        src={pokemon.sprite || pokemon.artwork || undefined}
                        alt=""
                      />
                      <span className="pokemonDisplayPlatform" aria-hidden="true" />
                    </div>

                    <div className="pokemonTypeMedals" aria-label="Pokémon types">
                      {pokemon.types.map((type) => (
                        <span className={`pokemonType pokemonType--${type}`} key={type}>
                          {type}
                        </span>
                      ))}
                    </div>

                    <section className="pokemonDexEntry">
                      <div className="pokemonDexEntryHeading">
                        <span>{species.category}</span>
                        {(species.isLegendary || species.isMythical) && (
                          <strong>
                            {species.isMythical ? "Mythical" : "Legendary"}
                          </strong>
                        )}
                      </div>
                      <p className="pokemonDescription">{species.description}</p>
                    </section>

                    {pokemon.cry && (
                      <div className="pokemonCry">
                        <span>Pokémon cry</span>
                        <audio controls src={pokemon.cry}>
                          Your browser cannot play this audio.
                        </audio>
                      </div>
                    )}
                  </div>

                  <div className="pokemonDetailsData">
                    <dl className="pokemonMeasurements">
                      <div><dt>Height</dt><dd>{pokemon.height} m</dd></div>
                      <div><dt>Weight</dt><dd>{pokemon.weight} kg</dd></div>
                    </dl>

                    <section className="pokemonFacts">
                      <h2>Pokémon data</h2>
                      <dl>
                        <div><dt>Generation</dt><dd>{formatLabel(species.generation)}</dd></div>
                        <div><dt>Habitat</dt><dd>{formatLabel(species.habitat)}</dd></div>
                        <div><dt>Base experience</dt><dd>{pokemon.baseExperience ?? "Unknown"}</dd></div>
                        <div><dt>Capture rate</dt><dd>{species.captureRate}</dd></div>
                        <div><dt>Base happiness</dt><dd>{species.baseHappiness}</dd></div>
                        <div><dt>Growth rate</dt><dd>{formatLabel(species.growthRate)}</dd></div>
                        <div>
                          <dt>Egg groups</dt>
                          <dd>{species.eggGroups.map(formatLabel).join(", ")}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="pokemonAbilities">
                      <h2>Abilities</h2>
                      <ul>
                        {pokemon.abilities.map((ability) => (
                          <li key={ability.name}>
                            {formatLabel(ability.name)}
                            {ability.isHidden && <span>Hidden</span>}
                          </li>
                        ))}
                      </ul>
                    </section>

                    <PokemonStats stats={pokemon.stats} />

                    <div className="pokemonLevelPreview">
                      <button
                        type="button"
                        onClick={() => setShowFinalStats((current) => !current)}
                      >
                        {showFinalStats
                          ? "Hide level 100 preview"
                          : "Preview level 100 stats"}
                      </button>
                      {showFinalStats && (
                        <FinalStats
                          baseStats={pokeApiStatsToBlock(pokemon.stats)}
                          nature={null}
                          level={100}
                          isShedinja={pokemon.name.toLowerCase() === "shedinja"}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <button
                  className="pokemonFlipButton pokemonDeviceAction"
                  type="button"
                  onClick={flipCard}
                  aria-label="View competitive side"
                >
                  Competitive data ↻
                </button>
              </section>

              <section
                className="pokemonFlipFace pokemonFlipBack"
                aria-hidden={!isCompetitiveSide}
                inert={!isCompetitiveSide ? true : undefined}
              >
                <button className="pokemonFlipButton" type="button" onClick={flipCard}>
                  ↻ View overview
                </button>

                <div className="competitiveHeader">
                  <img src={pokemon.sprite ?? undefined} alt="" />
                  <div>
                    <span>Competitive data</span>
                    <h1>{pokemon.name}</h1>
                    <p>Pokémon Showdown tier data for the selected environment.</p>
                  </div>
                </div>

                <label className="competitiveFormat">
                  Format
                  <select
                    value={selectedCompetitiveFormat.id}
                    onChange={selectCompetitiveFormat}
                  >
                    {COMPETITIVE_FORMATS.map((format) => (
                      <option value={format.id} key={format.id}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="competitiveHighlights">
                  <div><span>Showdown tier</span><strong>{displayedCompetitiveTier}</strong></div>
                  <div>
                    <span>Usage</span>
                    <strong>
                      {displayedStats.data
                        ? formatPercentage(displayedStats.data.usage)
                        : "—"}
                    </strong>
                  </div>
                  <div><span>Game moves</span><strong>{legalMoveCount}</strong></div>
                  <div><span>Suggested role</span><strong>{getSuggestedRole(pokemon)}</strong></div>
                </div>

                {displayedStats.status === "loading" && (
                  <p className="competitiveStatsStatus">
                    Loading competitive statistics...
                  </p>
                )}
                {displayedStats.status === "error" && (
                  <p className="competitiveStatsStatus" role="alert">
                    Competitive statistics are temporarily unavailable.
                  </p>
                )}
                {displayedStats.status === "empty" && (
                  <p className="competitiveStatsStatus">
                    No qualified data is available for this Pokémon in this format.
                  </p>
                )}
                {displayedStats.status === "ready" && (
                  <>
                    <p className="competitiveSample">
                      Latest qualified Smogon sample · {displayedStats.data!.battles.toLocaleString("en-US")} battles
                    </p>
                    <div className="competitiveStatsGrid">
                      <CompetitiveStatCard
                        title="Abilities"
                        items={displayedStats.data!.abilities}
                        emptyMessage="No ability data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Popular items"
                        items={displayedStats.data!.items}
                        emptyMessage="No item data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Popular moves"
                        items={displayedStats.data!.moves}
                        emptyMessage="No move data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Popular natures"
                        items={displayedStats.data!.natures}
                        emptyMessage="No nature data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Popular EV spreads"
                        items={displayedStats.data!.spreads}
                        emptyMessage="No EV spread data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Tera Types"
                        items={displayedStats.data!.teraTypes}
                        emptyMessage="No Tera Type data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Frequent teammates"
                        items={displayedStats.data!.teammates}
                        emptyMessage="No teammate data in this sample."
                      />
                      <CompetitiveStatCard
                        title="Checks and counters"
                        items={displayedStats.data!.counters}
                        emptyMessage="No reliable counter data in this sample."
                      />
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>

          <TypeDefenses
            pokemonName={pokemon.name}
            defenses={typeDefenses}
          />

          <PokemonAiAssistant
            key={pokemon.id}
            pokemonId={pokemon.id}
            pokemonName={pokemon.name}
          />

          <section className="pokemonMoves">
            <div className="pokemonMovesHeader">
              <div>
                <h2>Moves</h2>
                <p>Moves available in the selected game version.</p>
              </div>
              <label>
                Game version
                <select
                  aria-label="Move game version"
                  value={selectedVersion}
                  onChange={(event) => setSelectedVersion(event.target.value)}
                >
                  {getVersionGroups(pokemon.moves).map((version) => (
                    <option value={version} key={version}>
                      {formatLabel(version)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pokemonMovesTableWrapper">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Move</th>
                    <th scope="col">Method</th>
                    <th scope="col">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {movesForVersion.map((move, index) => (
                    <tr key={`${move.name}-${move.method}-${move.level}-${index}`}>
                      <td>{formatLabel(move.name)}</td>
                      <td>{METHOD_LABELS[move.method] ?? formatLabel(move.method)}</td>
                      <td>{move.method === "level-up" ? move.level : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="pokemonLocations">
            <div className="pokemonLocationsHeader">
              <div>
                <h2>Locations</h2>
                <p>Wild encounter locations available for this Pokémon.</p>
              </div>
              {encounterVersions.length > 0 && (
                <label>
                  Game version
                  <select
                    aria-label="Encounter game version"
                    value={selectedEncounterVersion}
                    onChange={(event) => setSelectedEncounterVersion(event.target.value)}
                  >
                    {encounterVersions.map((version) => (
                      <option value={version} key={version}>
                        {formatLabel(version)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {encountersForVersion.length > 0 ? (
              <div className="pokemonLocationsTableWrapper">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Location</th>
                      <th scope="col">Methods</th>
                      <th scope="col">Level</th>
                      <th scope="col">Max chance</th>
                      <th scope="col">Conditions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encountersForVersion.map((encounter) => (
                      <tr key={encounter.location}>
                        <td>
                          {formatLabel(encounter.location)}
                          {encounter.sections.length > 0 && (
                            <small>{encounter.sections.join(", ")}</small>
                          )}
                        </td>
                        <td>{encounter.methods.map(formatLabel).join(", ")}</td>
                        <td>
                          {encounter.minLevel === encounter.maxLevel
                            ? encounter.minLevel
                            : `${encounter.minLevel}–${encounter.maxLevel}`}
                        </td>
                        <td>{encounter.chance}%</td>
                        <td>
                          {encounter.conditions.length > 0
                            ? encounter.conditions.map(formatLabel).join(", ")
                            : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="pokemonLocationsEmpty">
                No wild encounter data is available for this Pokémon.
              </p>
            )}
          </section>
        </article>
      )}
    </main>
  );
}

export default PokemonDetailsPage;
