const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_TOTAL_LENGTH = 12_000;
const ALLOWED_HISTORY_ROLES = new Set(["user", "assistant"]);
const MAX_POKEMON_ID = 20_000;
const TEAM_FORMATS = new Set([
  "gen9-singles",
  "gen9-doubles",
  "national-dex",
  "anything-goes",
  "gen9-ubers",
  "gen9-monotype",
]);
const TEAM_STATS = [
  "hp", "attack", "defense", "specialAttack", "specialDefense", "speed",
];
const POKEMON_TYPES = new Set([
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
]);
const AI_MODES = new Set(["chat", "team-edit"]);
const CAMPAIGN_GAMES = new Set(["emerald", "firered"]);

export interface NormalizedTeamMember {
  slot: number;
  id: number;
  level: number;
  item: string;
  ability: string;
  nature: string;
  teraType: string;
  gender: string;
  moves: string[];
  evs: Record<string, number>;
  ivs: Record<string, number>;
}

export interface NormalizedCampaign {
  gameId: string;
  milestoneId: string;
}

export interface NormalizedTeamContext {
  kind: "team";
  mode: "campaign" | "competitive";
  format: string;
  campaign: NormalizedCampaign | null;
  moveTypes: string[];
  members: (NormalizedTeamMember | null)[];
}

export interface NormalizedPokemonContext {
  kind: "pokemon";
  pokemonId: number;
}

export type NormalizedContext = NormalizedTeamContext | NormalizedPokemonContext;

export interface NormalizedHistoryMessage {
  role: string;
  content: string;
}

export interface NormalizedAiRequest {
  messages: NormalizedHistoryMessage[];
  context: NormalizedContext | null;
  mode: string;
}

export class AiRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "INVALID_REQUEST", status = 400) {
    super(message);
    this.name = "AiRequestError";
    this.code = code;
    this.status = status;
  }
}

function normalizeMessage(message: any, index: number): NormalizedHistoryMessage {
  if (!message || typeof message !== "object") {
    throw new AiRequestError(`History message ${index + 1} is invalid.`);
  }

  const role = message.role;
  const content = typeof message.content === "string"
    ? message.content.trim()
    : "";

  if (!ALLOWED_HISTORY_ROLES.has(role)) {
    throw new AiRequestError(`History message ${index + 1} has an invalid role.`);
  }

  if (!content || content.length > MAX_MESSAGE_LENGTH) {
    throw new AiRequestError(
      `History message ${index + 1} must contain between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
    );
  }

  return { role, content };
}

function normalizeShortText(value, field, maxLength = 80) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new AiRequestError(`${field} is invalid.`, "INVALID_TEAM_CONTEXT");
  }
  return value.trim();
}

function normalizeStats(values, field, maximum) {
  const source = values && typeof values === "object" && !Array.isArray(values)
    ? values
    : {};

  return Object.fromEntries(TEAM_STATS.map((stat) => {
    const value = source[stat] ?? (field === "IVs" ? 31 : 0);
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
      throw new AiRequestError(`${field} contain an invalid value.`, "INVALID_TEAM_CONTEXT");
    }
    return [stat, value];
  }));
}

function normalizeTeamMember(member: any, index: number): NormalizedTeamMember | null {
  if (member == null) return null;
  if (!member || typeof member !== "object" || Array.isArray(member)) {
    throw new AiRequestError(`Team slot ${index + 1} is invalid.`, "INVALID_TEAM_CONTEXT");
  }
  if (!Number.isInteger(member.id) || member.id < 1 || member.id > MAX_POKEMON_ID) {
    throw new AiRequestError(`Team slot ${index + 1} has an invalid Pokémon ID.`, "INVALID_TEAM_CONTEXT");
  }
  const moves = member.moves ?? [];
  if (!Array.isArray(moves) || moves.length > 4) {
    throw new AiRequestError(`Team slot ${index + 1} has invalid moves.`, "INVALID_TEAM_CONTEXT");
  }
  const level = member.level ?? 100;
  if (!Number.isInteger(level) || level < 1 || level > 100) {
    throw new AiRequestError(`Team slot ${index + 1} has an invalid level.`, "INVALID_TEAM_CONTEXT");
  }

  const evs = normalizeStats(member.evs, "EVs", 252);
  if (Object.values(evs).reduce((total, value) => total + value, 0) > 510) {
    throw new AiRequestError(`Team slot ${index + 1} exceeds 510 EVs.`, "INVALID_TEAM_CONTEXT");
  }

  return {
    slot: index + 1,
    id: member.id,
    level,
    item: normalizeShortText(member.item, "Item"),
    ability: normalizeShortText(member.ability, "Ability"),
    nature: normalizeShortText(member.nature, "Nature"),
    teraType: normalizeShortText(member.teraType, "Tera Type", 20),
    gender: normalizeShortText(member.gender, "Gender", 12),
    moves: moves.map((move) => normalizeShortText(move, "Move")),
    evs,
    ivs: normalizeStats(member.ivs, "IVs", 31),
  };
}

function normalizeTeamContext(context: any): NormalizedTeamContext {
  const isCampaign = context.mode === "campaign";
  if (!isCampaign && !TEAM_FORMATS.has(context.format)) {
    throw new AiRequestError("The selected team format is invalid.", "INVALID_TEAM_CONTEXT");
  }
  if (!Array.isArray(context.members) || context.members.length > 6) {
    throw new AiRequestError("A team context may contain at most six slots.", "INVALID_TEAM_CONTEXT");
  }
  const moveTypes = context.moveTypes ?? [];
  if (!Array.isArray(moveTypes) || moveTypes.length > 24) {
    throw new AiRequestError("Team move types are invalid.", "INVALID_TEAM_CONTEXT");
  }

  return {
    kind: "team",
    mode: isCampaign ? "campaign" : "competitive",
    format: isCampaign ? (context.campaign?.gameId || "emerald") : context.format,
    campaign: isCampaign ? {
      gameId: CAMPAIGN_GAMES.has(context.campaign?.gameId)
        ? context.campaign.gameId
        : "emerald",
      milestoneId: typeof context.campaign?.milestoneId === "string"
        ? context.campaign.milestoneId.slice(0, 80)
        : "before-roxanne",
    } : null,
    moveTypes: [...new Set(moveTypes.filter((type) => POKEMON_TYPES.has(type)))],
    members: Array.from(
      { length: 6 },
      (_, index) => normalizeTeamMember(context.members[index], index),
    ),
  };
}

function normalizeContext(context: any): NormalizedContext | null {
  if (context == null) return null;

  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new AiRequestError("Context must be an object.");
  }

  if (context.kind === "team") return normalizeTeamContext(context);

  if (context.kind !== "pokemon") {
    throw new AiRequestError(
      "This context type is not supported.",
      "INVALID_CONTEXT_KIND",
    );
  }

  if (
    !Number.isInteger(context.pokemonId) ||
    context.pokemonId < 1 ||
    context.pokemonId > MAX_POKEMON_ID
  ) {
    throw new AiRequestError(
      "Context must contain a valid Pokémon ID.",
      "INVALID_POKEMON_ID",
    );
  }

  return { kind: "pokemon", pokemonId: context.pokemonId };
}

export function validateAiRequest(body: any): NormalizedAiRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AiRequestError("The request body must be a JSON object.");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new AiRequestError(
      `Message must contain between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
    );
  }

  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > MAX_HISTORY_MESSAGES) {
    throw new AiRequestError(
      `History must contain at most ${MAX_HISTORY_MESSAGES} messages.`,
    );
  }

  const messages = [
    ...history.map(normalizeMessage),
    { role: "user", content: message },
  ];
  const totalLength = messages.reduce(
    (total, currentMessage) => total + currentMessage.content.length,
    0,
  );

  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new AiRequestError(
      `The conversation may contain at most ${MAX_TOTAL_LENGTH} characters.`,
    );
  }

  const mode = body.mode ?? "chat";
  if (!AI_MODES.has(mode)) {
    throw new AiRequestError("This AI mode is not supported.", "INVALID_AI_MODE");
  }
  const context = normalizeContext(body.context);
  if (mode === "team-edit" && context?.kind !== "team") {
    throw new AiRequestError(
      "Team editing requires a valid team context.",
      "INVALID_AI_MODE",
    );
  }

  return { messages, context, mode };
}
