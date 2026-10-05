import { TeamValidator, Teams } from "@pkmn/sim";
import { COMPETITIVE_FORMATS } from "../../src/services/competitiveFormats";
import type { TeamValidationResult } from "../../src/services/teamValidation";

const MAX_TEAM_TEXT_LENGTH = 12_000;

export class TeamValidationRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TeamValidationRequestError";
    this.status = status;
  }
}

export function validateTeamRequest(body: unknown): TeamValidationResult {
  if (typeof body === "string") {
    if (body.length > MAX_TEAM_TEXT_LENGTH + 1_000) {
      throw new TeamValidationRequestError("The team validation request is too large.", 413);
    }
    try {
      body = JSON.parse(body);
    } catch {
      throw new TeamValidationRequestError("The request body contains invalid JSON.");
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TeamValidationRequestError("Send a team and a competitive format.");
  }
  const { format: formatId, team: text } = body as Record<string, unknown>;
  const format = COMPETITIVE_FORMATS.find(({ id }) => id === formatId);
  if (!format) {
    throw new TeamValidationRequestError("Choose a supported competitive format.");
  }
  if (typeof text !== "string") {
    throw new TeamValidationRequestError("The team must be Pokémon Showdown export text.");
  }
  if (text.length > MAX_TEAM_TEXT_LENGTH) {
    throw new TeamValidationRequestError("The team export is too large.", 413);
  }
  if (text.trimStart().startsWith("[") || text.includes("|")) {
    throw new TeamValidationRequestError("Send human-readable Pokémon Showdown export text.");
  }

  let team;
  try {
    team = Teams.import(text);
  } catch {
    throw new TeamValidationRequestError("The team export could not be read.");
  }
  if (!team || !Array.isArray(team) || team.length === 0) {
    throw new TeamValidationRequestError("Add at least one Pokémon before validating your team.");
  }
  if (team.length > 6) {
    throw new TeamValidationRequestError("A team can contain up to six Pokémon.");
  }
  // Bound parsed sets before entering the engine, including unusually long movelists.
  if (team.some((set) =>
    !set || typeof set !== "object" || typeof set.species !== "string" ||
    set.species.length > 100 ||
    (set.moves !== undefined && (
      !Array.isArray(set.moves) || set.moves.length > 24 ||
      set.moves.some((move) => typeof move !== "string" || move.length > 100)
    ))
  )) {
    throw new TeamValidationRequestError("The team export contains an invalid Pokémon set.");
  }
  // An unfinished set has no movelist in @pkmn/sets. Let the validator explain it.
  for (const set of team) set.moves ??= [];

  // Showdown's validator mutates its parsed sets; the user's team stays untouched.
  const problems = new TeamValidator(format.statsId).validateTeam(team) ?? [];
  return {
    valid: problems.length === 0,
    format: format.id,
    showdownFormat: format.statsId,
    problems,
  };
}
