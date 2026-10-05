const EV_LABELS = {
  HP: "hp",
  Atk: "attack",
  Def: "defense",
  SpA: "specialAttack",
  SpD: "specialDefense",
  Spe: "speed",
};

const EV_EXPORT_LABELS = Object.entries(EV_LABELS)
  .map(([label, key]) => ({ label, key }));

function displayName(value) {
  return value
    .split(/[-\s]+/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function apiName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function exportShowdownTeam(team) {
  return team
    .filter(Boolean)
    .map((member) => {
      const gender = member.gender === "male"
        ? " (M)"
        : member.gender === "female" ? " (F)" : "";
      const lines = [
        `${displayName(member.name)}${gender}${member.item ? ` @ ${member.item}` : ""}`,
      ];

      if (member.ability) lines.push(`Ability: ${displayName(member.ability)}`);
      if (member.level && member.level !== 100) lines.push(`Level: ${member.level}`);
      if (member.teraType) lines.push(`Tera Type: ${displayName(member.teraType)}`);

      const evs = EV_EXPORT_LABELS
        .filter(({ key }) => Number(member.evs?.[key]) > 0)
        .map(({ label, key }) => `${member.evs[key]} ${label}`);
      if (evs.length) lines.push(`EVs: ${evs.join(" / ")}`);
      const ivs = EV_EXPORT_LABELS
        .filter(({ key }) => Number(member.ivs?.[key] ?? 31) < 31)
        .map(({ label, key }) => `${member.ivs[key]} ${label}`);
      if (ivs.length) lines.push(`IVs: ${ivs.join(" / ")}`);
      if (member.nature) lines.push(`${displayName(member.nature)} Nature`);

      member.moves?.filter(Boolean).forEach((move) => {
        lines.push(`- ${displayName(move)}`);
      });

      return lines.join("\n");
    })
    .join("\n\n");
}

function parseStats(value) {
  const stats = {};

  value.split("/").forEach((part) => {
    const match = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (!match) return;

    const canonicalLabel = Object.keys(EV_LABELS)
      .find((label) => label.toLowerCase() === match[2].toLowerCase());
    if (!canonicalLabel) return;
    stats[EV_LABELS[canonicalLabel]] = Number(match[1]);
  });

  return stats;
}

export function importShowdownTeam(text) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .slice(0, 6)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const [header = "", ...details] = lines;
      const [identity, item = ""] = header.split(/\s+@\s+/, 2);
      const genderMatch = identity.match(/\s+\(([MF])\)$/);
      const identityWithoutGender = identity.replace(/\s+\([MF]\)$/, "");
      const speciesMatch = identityWithoutGender.match(/\(([^()]+)\)$/);
      const species = speciesMatch?.[1] ?? identityWithoutGender;
      const set: { species: string; item: string; ability: string; nature: string; teraType: string; level: number; gender: string; ivs: Record<string, number>; evs: Record<string, number>; moves: string[] } = {
        species: apiName(species),
        item,
        ability: "",
        nature: "",
        teraType: "",
        level: 100,
        gender: genderMatch?.[1] === "M"
          ? "male"
          : genderMatch?.[1] === "F" ? "female" : "",
        ivs: {},
        evs: {},
        moves: [],
      };

      details.forEach((line) => {
        if (line.startsWith("Ability: ")) set.ability = line.slice(9);
        else if (line.startsWith("Level: ")) set.level = Number(line.slice(7)) || 100;
        else if (line.startsWith("Tera Type: ")) set.teraType = line.slice(11);
        else if (line.startsWith("EVs: ")) set.evs = parseStats(line.slice(5));
        else if (line.startsWith("IVs: ")) set.ivs = parseStats(line.slice(5));
        else if (line.endsWith(" Nature")) set.nature = line.slice(0, -7);
        else if (line.startsWith("- ")) set.moves.push(line.slice(2));
      });

      return set;
    })
    .filter(({ species }) => species);
}
