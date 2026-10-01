import "./PokemonShared.css";
import "./TypeDefenses.css";

function formatMultiplier(value) {
  return `×${value}`;
}

function DefenseSummary({ title, defenses }) {
  return (
    <div className="defenseSummaryGroup">
      <h3>{title}</h3>
      <div>
        {defenses.length > 0 ? defenses.map(({ type, multiplier }) => (
          <span className={`pokemonType pokemonType--${type}`} key={type}>
            {type} {formatMultiplier(multiplier)}
          </span>
        )) : <span className="defenseNone">None</span>}
      </div>
    </div>
  );
}

function TypeDefenses({ pokemonName, defenses }) {
  const weaknesses = defenses.filter(({ multiplier }) => multiplier > 1);
  const resistances = defenses.filter(
    ({ multiplier }) => multiplier > 0 && multiplier < 1,
  );
  const immunities = defenses.filter(({ multiplier }) => multiplier === 0);

  return (
    <section className="typeDefenses">
      <h2>Type defenses</h2>
      <p>
        Damage received by <strong>{pokemonName}</strong> from each attacking type.
      </p>

      <div className="defenseSummary">
        <DefenseSummary title="Weaknesses" defenses={weaknesses} />
        <DefenseSummary title="Resistances" defenses={resistances} />
        <DefenseSummary title="Immunities" defenses={immunities} />
      </div>

      <div className="typeDefenseGrid">
        {defenses.map(({ type, multiplier }) => {
          const effect = multiplier > 1
            ? "weak"
            : multiplier === 0
              ? "immune"
              : multiplier < 1
                ? "resistant"
                : "neutral";

          return (
            <div className="typeDefenseItem" key={type}>
              <span
                className={`typeDefenseName pokemonType--${type}`}
                title={type}
              >
                {type.slice(0, 3).toUpperCase()}
              </span>
              <strong className={`typeDefenseMultiplier typeDefenseMultiplier--${effect}`}>
                {formatMultiplier(multiplier)}
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default TypeDefenses;
