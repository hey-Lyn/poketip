// statsId is also the official Pokémon Showdown format identifier.
export const COMPETITIVE_FORMATS = [
  { id: "gen9-singles", label: "Gen 9 Singles (OU)", tierField: "tier", statsId: "gen9ou" },
  { id: "gen9-doubles", label: "Gen 9 Doubles (OU)", tierField: "doublesTier", statsId: "gen9doublesou" },
  { id: "national-dex", label: "National Dex Singles (OU)", tierField: "natDexTier", statsId: "gen9nationaldex" },
  { id: "anything-goes", label: "Gen 9 Anything Goes", tierField: "tier", statsId: "gen9anythinggoes" },
  { id: "gen9-ubers", label: "Gen 9 Ubers", tierField: "tier", statsId: "gen9ubers" },
  { id: "gen9-monotype", label: "Gen 9 Monotype", tierField: "tier", statsId: "gen9monotype" },
];

export const DEFAULT_COMPETITIVE_FORMAT = COMPETITIVE_FORMATS[0].id;

export function getCompetitiveFormat(formatId: string) {
  return COMPETITIVE_FORMATS.find(({ id }) => id === formatId) ?? COMPETITIVE_FORMATS[0];
}
