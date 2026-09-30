import { createOpenRouterCompletion } from "../_lib/openRouter.js";
import { getPokemonGroundingContext } from "../_lib/pokemonContext.js";
import { getTeamGroundingContext } from "../_lib/teamContext.js";
import {
  getCandidateGroundingContext,
  readCandidateNames,
} from "../_lib/candidateContext.js";
import {
  resolveTeamEditPlan,
  TEAM_EDIT_INSTRUCTIONS,
} from "../_lib/teamEdit.js";
import { requireUser } from "../_lib/auth.js";
import { checkIpUsageLimit, checkUsageLimit } from "../_lib/rateLimit.js";
import { getCampaignMilestone } from "../../src/services/campaignData.js";
import { AiRequestError, validateAiRequest } from "../_lib/validateAiRequest.js";

export const config = {
  maxDuration: 60,
};

const CANDIDATE_REQUEST_PATTERN = /\b(recommend|recommendation|suggest|suggestion|replace|replacement|occupy|empty slot|fill (?:the )?slot|which pok[eé]mon|what pok[eé]mon|melhor pok[eé]mon|qual pok[eé]mon|sugira|recomende|substitu[ai]|preench[ae]|slot vazio)\b/i;
const TEAM_EDIT_ADD_PATTERN = /\b(add|replace|swap|fill|catch|put|introduce|adicion[ae]|troca(?:r)?|substitui|preenche|captura(?:r)?)\b/i;
const CANDIDATE_SELECTION_INSTRUCTIONS = `The user is asking for a team recommendation.
Return ONLY one JSON object in this exact form: {"candidates":["pokemon-name"]}.
Choose zero to three Pokémon names that would be the most useful candidates to verify before the final answer.
Use PokéAPI slug names in lowercase. Do not explain your choices and do not include markdown.`;
const TEAM_EDIT_CANDIDATE_INSTRUCTIONS = `The user is asking to edit a campaign team.
Return ONLY one JSON object in this exact form: {"candidates":["pokemon-name"]}.
List the Pokémon species this edit will add or replace (zero to three names).
Use PokéAPI slug names in lowercase. Do not explain your choices and do not include markdown.`;

function shouldVerifyCandidates(messages, context, mode) {
  return mode === "chat"
    && context?.kind === "team"
    && context.mode !== "campaign"
    && CANDIDATE_REQUEST_PATTERN.test(messages.at(-1)?.content ?? "");
}

function shouldVerifyTeamEditCandidates(messages, context, mode) {
  return mode === "team-edit"
    && context?.kind === "team"
    && context.mode === "campaign"
    && TEAM_EDIT_ADD_PATTERN.test(messages.at(-1)?.content ?? "");
}

function readBody(body) {
  if (typeof body !== "string") return body;

  try {
    return JSON.parse(body);
  } catch {
    throw new AiRequestError("The request body contains invalid JSON.");
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are allowed." },
    });
  }

  try {
    const user = await requireUser(request);
    await checkIpUsageLimit(request);
    const billing = await checkUsageLimit(user.id);

    const { messages, context, mode } = validateAiRequest(readBody(request.body));
    let groundingContext = null;
    if (context?.kind === "pokemon") {
      groundingContext = await getPokemonGroundingContext(context.pokemonId);
    } else if (context?.kind === "team") {
      groundingContext = await getTeamGroundingContext(context, {
        competitiveFetchImpl: fetch,
      });
    }
    let candidateContext = null;
    const verifyRecommendationCandidates = shouldVerifyCandidates(messages, context, mode);
    const verifyTeamEditCandidates = shouldVerifyTeamEditCandidates(messages, context, mode);
    if (verifyRecommendationCandidates || verifyTeamEditCandidates) {
      const selection = await createOpenRouterCompletion({
        messages,
        groundingContext,
        taskInstructions: verifyTeamEditCandidates
          ? TEAM_EDIT_CANDIDATE_INSTRUCTIONS
          : CANDIDATE_SELECTION_INSTRUCTIONS,
        reasoningTokens: 64,
        maxCompletionTokens: 180,
        allowContinuation: false,
      });
      const candidates = readCandidateNames(selection.answer);
      const campaign = verifyTeamEditCandidates ? context.campaign : null;
      const campaignLevel = campaign
        ? getCampaignMilestone(campaign.gameId, campaign.milestoneId).recommendedLevel
        : undefined;
      candidateContext = await getCandidateGroundingContext(candidates, context.format, {
        fetchImpl: fetch,
        competitiveFetchImpl: fetch,
        teamTypes: groundingContext.members.map(({ verifiedPokemon }) => verifiedPokemon.types),
        campaign,
        level: campaignLevel ?? 100,
      });
    }
    const completeGroundingContext = candidateContext
      ? {
          ...groundingContext,
          verifiedRecommendationCandidates: candidateContext,
          sources: [...new Set([
            ...(groundingContext?.sources ?? []),
            ...candidateContext.sources,
          ])],
        }
      : groundingContext;
    const completion = await createOpenRouterCompletion({
      messages,
      groundingContext: completeGroundingContext,
      taskInstructions: mode === "team-edit" ? TEAM_EDIT_INSTRUCTIONS : null,
      reasoningTokens: mode === "team-edit" ? 128 : 256,
      maxCompletionTokens: mode === "team-edit" ? 2_500 : 4_000,
      allowContinuation: mode !== "team-edit",
    });
    if (mode === "team-edit") {
      const editPlan = await resolveTeamEditPlan(completion.answer, context);
      const answer = editPlan.adjustments.length
        ? `${editPlan.actions.length
          ? "The valid requested team changes were applied."
          : "No valid team changes were applied."}\n\nValidation adjustments:\n${editPlan.adjustments.map((adjustment) => `- ${adjustment}`).join("\n")}`
        : editPlan.message;
      return response.status(200).json({
        ...completion,
        answer,
        actions: editPlan.actions,
        sources: completeGroundingContext?.sources ?? [],
        billing,
      });
    }
    return response.status(200).json({
      ...completion,
      sources: completeGroundingContext?.sources ?? [],
      billing,
    });
  } catch (error) {
    if (!error?.code) console.error("Unexpected AI endpoint error:", error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    const code = typeof error.code === "string" ? error.code : "AI_REQUEST_FAILED";
    const message = status >= 500 && !error.code
      ? "The AI service is temporarily unavailable."
      : error.message;

    return response.status(status).json({ error: { code, message } });
  }
}
