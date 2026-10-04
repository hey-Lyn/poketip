import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { MAX_GAME_LENGTH, MAX_TRAINER_TITLE_LENGTH } from "../services/trainerCustomization";
import type { TrainerCustomization } from "../services/trainerCustomization";
import { loadTeam } from "../services/teamStorage";
import { searchPokemon } from "../services/pokeApi";
import type { PokemonLite } from "../types";

function CardColorPicker({ field, label, value, onChange, disabled }) {
  const hex = value[field];
  return <div className="profileColorPicker"><label><span>{label}</span><input type="color" aria-label={label} value={hex} disabled={disabled} onChange={(event) => onChange((previous) => ({ ...previous, [field]: event.target.value }))} /></label>
    <div className="profileRgbChannels">{["R", "G", "B"].map((channel, index) => <label key={channel}><span>{channel}</span><input type="number" min="0" max="255" step="1" aria-label={`${label} ${channel}`} disabled={disabled} value={parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)} onChange={(event) => {
      if (event.target.value === "") return;
      const number = Math.max(0, Math.min(255, Math.round(Number(event.target.value))));
      if (!Number.isFinite(number)) return;
      onChange((previous) => { const old = previous[field]; return { ...previous, [field]: old.slice(0, 1 + index * 2) + number.toString(16).padStart(2, "0") + old.slice(3 + index * 2) }; });
    }} /></label>)}</div>
    <small>{hex.toUpperCase()}</small>
  </div>;
}

export default function ProfileCustomization({ value, onChange, colorsEnabled = true }: {
  value: TrainerCustomization;
  onChange: Dispatch<SetStateAction<TrainerCustomization>>;
  colorsEnabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchPokemon(query.trim().toLowerCase(), 6, controller.signal);
        if (active) { setResults(data.pokemon); if (!data.pokemon.length) setStatus("No Pokémon found. Try another name or number."); }
      } catch (error) {
        if (active && error.name !== "AbortError") setStatus("Unable to search Pokémon. Please try again.");
      } finally { if (active) setSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <fieldset className="profileCustomization">
      <legend className="profileSectionTitle">Make it yours</legend>
      <div className="profileCustomFields">
        <label>Trainer title<input value={value.trainer_title} maxLength={MAX_TRAINER_TITLE_LENGTH} placeholder="e.g. Water-type specialist" onChange={(event) => onChange((previous) => ({ ...previous, trainer_title: event.target.value }))} /></label>
        <label>Favorite game<input value={value.favorite_game} maxLength={MAX_GAME_LENGTH} list="favorite-games" placeholder="e.g. Pokémon Emerald" onChange={(event) => onChange((previous) => ({ ...previous, favorite_game: event.target.value }))} /></label>
        <datalist id="favorite-games">{["Pokémon Red", "Pokémon Crystal", "Pokémon Emerald", "Pokémon Platinum", "Pokémon Black 2", "Pokémon X", "Pokémon Sun", "Pokémon Sword", "Pokémon Legends: Arceus", "Pokémon Scarlet"].map((game) => <option key={game} value={game} />)}</datalist>
      </div>
      <div className="profileCustomGroup"><span className="profileSectionTitle">Card colors</span>
        <div className="profileColorOptions">{([
          ["card_frame_color", "Card frame"], ["card_background_start", "Background color 1"], ["card_background_end", "Background color 2"],
        ] as const).map(([field, label]) => <CardColorPicker key={field} field={field} label={label} value={value} onChange={onChange} disabled={!colorsEnabled} />)}</div>
        <p className="profileCustomHint">The two background colors blend into a gradient. Changes appear in the preview.</p>
        {!colorsEnabled && <p className="profileCustomHint" role="status">Custom card colors are waiting for their database setup.</p>}
      </div>
      <div className="profileCustomGroup"><span className="profileSectionTitle">Featured team · {value.featured_team.length}/6</span>
        <p className="profileCustomHint">Choose the Pokémon shown on your profile. Changes here won't change your battle team.</p>
        <ol className="profileTeamSlots">{value.featured_team.map((member, index) => <li key={`${member.id}-${index}`}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${member.id}.png`} alt="" /><span>{member.name}</span><button type="button" aria-label={`Remove ${member.name} from featured team`} onClick={() => onChange((previous) => ({ ...previous, featured_team: previous.featured_team.filter((_, slot) => slot !== index) }))}>×</button></li>)}</ol>
        <button type="button" className="trainerAction" onClick={() => {
          const team = loadTeam().filter(Boolean).map(({ id, name }) => ({ id, name }));
          if (!team.length) { setStatus("Add Pokémon in Team Builder first."); return; }
          onChange((previous) => ({ ...previous, featured_team: team })); setStatus("Team copied. Save your profile to keep it.");
        }}>Copy from Team Builder</button>
        {value.featured_team.length < 6 && <label className="profileTeamSearch">Add a Pokémon<input value={query} placeholder="Search Pokémon by name or number" onChange={(event) => { setQuery(event.target.value); setResults([]); setSearching(false); setStatus(""); }} /></label>}
        {searching && <p className="profileCustomHint" role="status">Searching Pokémon...</p>}
        {query.trim().length >= 2 && !searching && value.featured_team.length < 6 && <ul className="profileFavoriteResults">{results.map((pokemon) => <li key={pokemon.id}><button type="button" aria-label={`Add ${pokemon.name} to featured team`} onClick={() => { onChange((previous) => ({ ...previous, featured_team: [...previous.featured_team, { id: pokemon.id, name: pokemon.name }].slice(0, 6) })); setQuery(""); setResults([]); }}><img src={pokemon.sprite} alt="" /><span>{pokemon.name}</span><small>Add</small></button></li>)}</ul>}
      </div>
      {status && <p className="profileStatus" role="status">{status}</p>}
    </fieldset>
  );
}
