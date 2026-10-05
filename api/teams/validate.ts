import { TeamValidationRequestError, validateTeamRequest } from "../_lib/showdownValidation";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are allowed." },
    });
  }
  try {
    return response.status(200).json(validateTeamRequest(request.body));
  } catch (error) {
    if (error instanceof TeamValidationRequestError) {
      return response.status(error.status).json({
        error: { code: "INVALID_TEAM_REQUEST", message: error.message },
      });
    }
    console.error("Pokémon Showdown team validation failed:", error);
    return response.status(503).json({
      error: {
        code: "TEAM_VALIDATION_UNAVAILABLE",
        message: "Team validation is temporarily unavailable. Please try again.",
      },
    });
  }
}
