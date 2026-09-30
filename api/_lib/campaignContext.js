import {
  getCampaignEncounters,
  getCampaignGame,
  getCampaignMilestone,
} from "../../src/services/campaignData.js";

export function getCampaignGroundingContext(campaign) {
  const game = getCampaignGame(campaign.gameId);
  const milestone = getCampaignMilestone(game.id, campaign.milestoneId);
  const encounters = getCampaignEncounters(game.id, milestone.id);

  return {
    kind: "campaign",
    source: "Pokétip curated campaign data",
    game,
    milestone,
    encounters,
    note: "Trainer parties, progression milestones, and wild encounter availability are curated for this game. Encounter methods are limited to tall grass and Rock Smash; fishing, Surf, and gift/trade encounters are not included yet.",
  };
}
