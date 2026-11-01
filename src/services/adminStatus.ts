import type { TrainerProfile } from "./trainers";

// Only the shared-profile RPC flag counts; raw role fields are never displayed.
export function isTrainerAdmin(profile?: Partial<TrainerProfile> | null): boolean {
  return profile?.is_admin === true;
}
