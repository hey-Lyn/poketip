import { useMemo, useState } from "react";
import { createTeamMember } from "../services/teamStorage";
import { getPokemonById } from "../services/pokeApi";
import { exportShowdownTeam, importShowdownTeam } from "../services/showdownTeam";

function toSlug(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TeamTransfer({ team, onImportTeam }) {
  const exportedTeam = useMemo(() => exportShowdownTeam(team), [team]);
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);

  async function importTeam() {
    const sets = importShowdownTeam(importText);
    if (!sets.length) {
      setStatus("Paste a valid Pokémon Showdown team first.");
      return;
    }

    try {
      setImporting(true);
      setStatus("");
      const importedTeam = await Promise.all(sets.map(async (set) => {
        const pokemon = await getPokemonById(set.species);
        return createTeamMember(pokemon, {
          ...set,
          ability: toSlug(set.ability),
          teraType: toSlug(set.teraType) || pokemon.types[0],
        });
      }));
      onImportTeam(importedTeam);
      setStatus(`Imported ${importedTeam.length} Pokémon.`);
    } catch {
      setStatus("One or more Pokémon could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <details className="teamTransfer">
      <summary>Import / export</summary>
      <div className="teamTransferGrid">
        <label>
          Export to Pokémon Showdown
          <textarea
            readOnly
            value={exportedTeam}
            placeholder="Add Pokémon to export your team."
          />
        </label>
        <div className="teamTransferImport">
          <label>
            Import from Pokémon Showdown
            <textarea
              value={importText}
              placeholder="Paste a Pokémon Showdown team here."
              onChange={(event) => setImportText(event.target.value)}
            />
          </label>
          <button type="button" disabled={importing} onClick={importTeam}>
            {importing ? "Importing..." : "Import team"}
          </button>
        </div>
      </div>
      {status && <p role="status">{status}</p>}
    </details>
  );
}

export default TeamTransfer;
