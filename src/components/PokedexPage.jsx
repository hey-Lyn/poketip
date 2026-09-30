import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Globe2, Search } from "lucide-react";
import "./PokedexPage.css";
import "./PokemonShared.css";
import {
  getPokemonDescription,
  getPokemonPage,
  searchPokemon,
} from "../services/pokeApi";
import { MAX_TEAM_SIZE } from "../services/teamStorage";
import PokemonCard from "./PokemonCard";
import PokemonStats from "./PokemonStats";

const PAGE_SIZE = 20;
const REGIONS = [
  { value: "all", label: "All regions", firstId: 1, lastId: Infinity },
  { value: "kanto", label: "Kanto", firstId: 1, lastId: 151 },
  { value: "johto", label: "Johto", firstId: 152, lastId: 251 },
  { value: "hoenn", label: "Hoenn", firstId: 252, lastId: 386 },
  { value: "sinnoh", label: "Sinnoh", firstId: 387, lastId: 493 },
  { value: "unova", label: "Unova", firstId: 494, lastId: 649 },
  { value: "kalos", label: "Kalos", firstId: 650, lastId: 721 },
  { value: "alola", label: "Alola", firstId: 722, lastId: 809 },
  { value: "galar", label: "Galar", firstId: 810, lastId: 905 },
  { value: "paldea", label: "Paldea", firstId: 906, lastId: 1025 },
];

function PokedexPage({ team = [], onAddToTeam = () => {} }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const regionParam = searchParams.get("region") ?? "all";
  const selectedRegion = REGIONS.some(({ value }) => value === regionParam)
    ? regionParam
    : "all";
  const activeSearch = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const currentPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;
  const [pokemon, setPokemon] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [totalPokemon, setTotalPokemon] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [description, setDescription] = useState("");
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(activeSearch);
  const currentRegion = REGIONS.find(({ value }) => value === selectedRegion);
  const selectedPokemonIsOnTeam = selectedPokemon
    ? team.some((member) => member?.id === selectedPokemon.id)
    : false;
  const teamIsFull = team.filter(Boolean).length >= MAX_TEAM_SIZE;

  useEffect(() => {
    const timer = setTimeout(() => {
      const normalizedQuery = searchQuery.trim().toLowerCase().replace(/^#/, "");
      if (normalizedQuery === activeSearch) return;

      setSelectedPokemon(null);
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.delete("page");

        if (normalizedQuery) nextParams.set("search", normalizedQuery);
        else nextParams.delete("search");

        return nextParams;
      }, { replace: true });
    }, 350);

    return () => clearTimeout(timer);
  }, [activeSearch, searchQuery, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPokemon() {
      try {
        setLoading(true);
        setError("");

        if (activeSearch) {
          const data = await searchPokemon(
            activeSearch,
            PAGE_SIZE,
            controller.signal,
            currentRegion.firstId,
            currentRegion.lastId,
          );

          setPokemon(data.pokemon);
          setTotalPokemon(data.count);

          if (data.count === 0) {
            setError("No Pokémon was found with that name or number.");
          }
        } else {
          const regionCount = Number.isFinite(currentRegion.lastId)
            ? currentRegion.lastId - currentRegion.firstId + 1
            : Infinity;
          const requestLimit = Math.min(PAGE_SIZE, regionCount - offset);
          const data = await getPokemonPage(
            requestLimit,
            currentRegion.firstId - 1 + offset,
            controller.signal,
          );

          setPokemon(data.pokemon);
          setTotalPokemon(Number.isFinite(regionCount) ? regionCount : data.count);
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(activeSearch
            ? "No Pokémon was found with that name or number."
            : "Unable to load the Pokédex.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPokemon();

    return () => controller.abort();
  }, [activeSearch, currentRegion, offset, reloadKey]);

  useEffect(() => {
    if (!selectedPokemon) return;

    const controller = new AbortController();

    async function loadDescription() {
      try {
        setDescriptionLoading(true);
        setDescription("");
        const text = await getPokemonDescription(
          selectedPokemon.id,
          controller.signal,
        );
        setDescription(text);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setDescription("Description unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setDescriptionLoading(false);
      }
    }

    loadDescription();
    return () => controller.abort();
  }, [selectedPokemon]);

  function changePage(nextOffset) {
    setSelectedPokemon(null);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      const nextPage = nextOffset / PAGE_SIZE + 1;

      if (nextPage === 1) nextParams.delete("page");
      else nextParams.set("page", String(nextPage));

      return nextParams;
    });
  }

  function changeRegion(event) {
    const nextRegion = event.target.value;
    setSelectedPokemon(null);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete("page");

      if (nextRegion === "all") nextParams.delete("region");
      else nextParams.set("region", nextRegion);

      return nextParams;
    });
  }

  return (
    <main className="content pokedexPage">
      <section className="pokedexDevice">
        <div className="pokedexDeviceScreen">
          <section className="pokedexCatalog" aria-label="Pokédex catalog">
            <header className="pokedexCatalogHeader">
              <div className="pokedexTitle">
                <Globe2 aria-hidden="true" />
                <h1>Pokédex</h1>
              </div>
              <label className="regionSelect">
                <span>Region</span>
                <select value={selectedRegion} onChange={changeRegion}>
                  {REGIONS.map((region) => (
                    <option value={region.value} key={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </label>
            </header>

            <div className="pokemonSearch" role="search">
              <Search aria-hidden="true" />
              <label className="visuallyHidden" htmlFor="pokemon-search">
                Search by name or Pokédex number
              </label>
              <input
                id="pokemon-search"
                type="search"
                value={searchQuery}
                placeholder="Search Pokémon"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="pokemonCatalogViewport">
              {loading && <p className="pokedexStatus">Loading Pokémon...</p>}

              {error && (
                <div className="pokedexStatus pokedexError" role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && (
                <div className="pokemonGrid">
                  {pokemon.map((currentPokemon) => (
                    <PokemonCard
                      key={currentPokemon.id}
                      pokemon={currentPokemon}
                      isSelected={selectedPokemon?.id === currentPokemon.id}
                      onSelect={setSelectedPokemon}
                    />
                  ))}
                </div>
              )}
            </div>

            {!loading && !error && !activeSearch && (
              <nav className="pokedexPagination" aria-label="Pokédex pages">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </button>
                <span>
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, totalPokemon)} of {totalPokemon}
                </span>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= totalPokemon}
                  onClick={() => changePage(offset + PAGE_SIZE)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>

          <aside className="pokemonDataPanel" aria-live="polite">
            {selectedPokemon ? (
              <div className="pokemonSelection">
                <header className="pokemonSelectionHeader">
                  <span className="pokemonNumber">
                    #{String(selectedPokemon.id).padStart(3, "0")}
                  </span>
                  <h2>{selectedPokemon.name}</h2>
                </header>

                <div className="pokemonSelectionBody">
                  <div className="pokemonDisplayStage">
                    <div className="pokemonSelectionTypeBadges">
                      {selectedPokemon.types.map((type) => (
                        <span className={`pokemonType pokemonType--${type}`} key={type}>
                          {type}
                        </span>
                      ))}
                    </div>
                    <img
                      className="pokemonSelectionImage"
                      src={selectedPokemon.artwork}
                      alt={selectedPokemon.name}
                    />
                  </div>

                  <p className="pokemonDescription">
                    {descriptionLoading ? "Loading description..." : description}
                  </p>
                  <dl className="pokemonMeasurements">
                    <div><dt>Height</dt><dd>{selectedPokemon.height} m</dd></div>
                    <div><dt>Weight</dt><dd>{selectedPokemon.weight} kg</dd></div>
                  </dl>
                  <PokemonStats stats={selectedPokemon.stats} headingLevel="h3" />
                </div>

                <footer className="pokemonSelectionActions">
                  <Link
                    className="pokemonDetailsLink"
                    to={`/pokemon/${selectedPokemon.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                  >
                    View full page
                  </Link>
                  <button
                    className="addToTeamButton"
                    type="button"
                    disabled={selectedPokemonIsOnTeam || teamIsFull}
                    onClick={() => onAddToTeam(selectedPokemon)}
                  >
                    {selectedPokemonIsOnTeam
                      ? "Added to team"
                      : teamIsFull ? "Team is full" : "Add to team"}
                  </button>
                  <button type="button" onClick={() => setSelectedPokemon(null)}>
                    Close
                  </button>
                </footer>
              </div>
            ) : (
              <div className="pokemonSelectionEmpty">
                <span className="emptyPokedexBall" aria-hidden="true" />
                <h2>Choose a Pokémon</h2>
                <p>Select an entry from the catalog to view its data.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

export default PokedexPage;
