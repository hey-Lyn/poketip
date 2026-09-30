import "./PokemonCard.css";
import "./PokemonShared.css";

function PokemonCard({ pokemon, onSelect, isSelected = false }) {
  const formattedId = String(pokemon.id).padStart(3, "0");

  return (
    <button
      type="button"
      className={`pokemonCard ${isSelected ? "isSelected" : ""}`}
      onClick={() => onSelect(pokemon)}
      aria-label={`View details for ${pokemon.name}`}
      aria-pressed={isSelected}
    >
      <span className="pokemonNumber">#{formattedId}</span>

      <img
        className="pokemonImage"
        src={pokemon.sprite}
        alt={pokemon.name}
      />

      <h2 className="pokemonName">{pokemon.name}</h2>

      <div className="pokemonTypes">
        {pokemon.types.map((type) => (
          <span
            className={`pokemonType pokemonType--${type}`}
            key={type}
          >
            {type}
          </span>
        ))}
      </div>
    </button>
  );
}

export default PokemonCard;
