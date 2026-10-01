import { useMemo } from "react";
import type { StatBlock } from "../types";
import {
  calculateFinalStats,
  getNatureMultiplier,
  STAT_KEYS,
  STAT_LABELS,
  sumStats,
} from "../services/statCalculator";
import "./PokemonShared.css";

interface FinalStatsProps {
  baseStats: Partial<StatBlock> | null | undefined;
  ivs?: Partial<StatBlock> | null;
  evs?: Partial<StatBlock> | null;
  nature?: string | null;
  level?: number;
  isShedinja?: boolean;
}

function FinalStats({
  baseStats,
  ivs,
  evs,
  nature,
  level = 100,
  isShedinja = false,
}: FinalStatsProps) {
  const finalStats = useMemo(
    () => calculateFinalStats({ baseStats, ivs, evs, nature, level, isShedinja }),
    [baseStats, ivs, evs, nature, level, isShedinja],
  );
  const baseTotal = useMemo(() => sumStats(baseStats), [baseStats]);
  const finalTotal = useMemo(() => sumStats(finalStats), [finalStats]);

  return (
    <section className="finalStats" aria-label="Final stats">
      <div className="finalStatsHeader">
        <h3>Final stats</h3>
        <span>Lv. {level}</span>
      </div>

      <dl className="finalStatsList">
        {STAT_KEYS.map((stat) => {
          const multiplier = getNatureMultiplier(nature, stat);

          return (
            <div className="finalStatsRow" key={stat}>
              <dt>{STAT_LABELS[stat]}</dt>
              <dd className="finalStatsBase">{baseStats?.[stat] ?? 0}</dd>
              <dd className="finalStatsValue">{finalStats[stat]}</dd>
              <dd className="finalStatsNature">
                {multiplier > 1 && (
                  <span className="isRaised" aria-label="raised by nature">+</span>
                )}
                {multiplier < 1 && (
                  <span className="isLowered" aria-label="lowered by nature">−</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="finalStatsTotal">
        BST <strong className="finalStatsBase">{baseTotal}</strong> →{" "}
        <strong className="finalStatsValue">{finalTotal}</strong>
      </p>
      <p className="finalStatsNote">
        Base stats at level {level} with this set&apos;s IVs, EVs and nature.
        Excludes in-battle modifiers.
      </p>
    </section>
  );
}

export default FinalStats;
