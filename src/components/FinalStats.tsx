import { useId, useMemo } from "react";
import type { StatBlock, StatKey } from "../types";
import {
  calculateFinalStats,
  getNatureMultiplier,
  STAT_KEYS,
  STAT_LABELS,
  sumStats,
} from "../services/statCalculator";
import "./PokemonShared.css";
import "./FinalStats.css";

interface FinalStatsProps {
  baseStats: Partial<StatBlock> | null | undefined;
  ivs?: Partial<StatBlock> | null;
  evs?: Partial<StatBlock> | null;
  nature?: string | null;
  level?: number;
  isShedinja?: boolean;
  variant?: "list" | "radar";
}

// Clockwise, matching the familiar six-axis Pokémon stat display.
const RADAR_STATS: StatKey[] = ["hp", "attack", "defense", "speed", "specialDefense", "specialAttack"];
const CENTER = 180;
const RADIUS = 112;

function radarPoint(index: number, ratio: number) {
  const angle = index * Math.PI / 3 - Math.PI / 2;
  return { x: CENTER + Math.cos(angle) * RADIUS * ratio, y: CENTER + Math.sin(angle) * RADIUS * ratio };
}

function radarPolygon(stats: StatBlock, scale: number) {
  return RADAR_STATS.map((stat, index) => {
    const { x, y } = radarPoint(index, Math.min(1, Math.max(0, stats[stat] / scale)));
    return `${x},${y}`;
  }).join(" ");
}

function FinalStats({
  baseStats,
  ivs,
  evs,
  nature,
  level = 100,
  isShedinja = false,
  variant = "list",
}: FinalStatsProps) {
  const chartId = useId();
  const finalStats = useMemo(
    () => calculateFinalStats({ baseStats, ivs, evs, nature, level, isShedinja }),
    [baseStats, ivs, evs, nature, level, isShedinja],
  );
  const baseTotal = useMemo(() => sumStats(baseStats), [baseStats]);
  const finalTotal = useMemo(() => sumStats(finalStats), [finalStats]);
  const beforeTraining = useMemo(
    () => calculateFinalStats({ baseStats, ivs, nature, level, isShedinja }),
    [baseStats, ivs, nature, level, isShedinja],
  );
  // A shared scale stays fixed while EVs, IVs and nature change.
  const chartScale = useMemo(() => {
    const maximumEvs = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 252]));
    const maximumStats = calculateFinalStats({ baseStats, evs: maximumEvs, level, isShedinja });
    const ceiling = Math.max(maximumStats.hp, ...STAT_KEYS.filter((stat) => stat !== "hp").map((stat) => Math.floor(maximumStats[stat] * 1.1)));
    return Math.ceil(ceiling / 50) * 50;
  }, [baseStats, level, isShedinja]);
  const isRadar = variant === "radar";

  return (
    <section className={`finalStats${isRadar ? " finalStatsRadar" : ""}`} aria-label="Final stats">
      <div className="finalStatsHeader">
        <h3>Final stats</h3>
        <span>Lv. {level}</span>
      </div>

      {isRadar && (
        <>
          <div className="finalStatsLegend" aria-hidden="true">
            <span><i className="finalStatsLegendCurrent" />Current set</span>
            <span><i className="finalStatsLegendBaseline" />Before EVs</span>
          </div>
          <svg className="finalStatsChart" viewBox="0 0 360 360" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
            <title id={`${chartId}-title`}>Final stats radar</title>
            <desc id={`${chartId}-description`}>Current set compared with the same level, IVs and nature before EV training. All axes use a scale from 0 to {chartScale}.</desc>
            {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
              <polygon key={ratio} className={`finalStatsChartGrid${ratio === 1 ? " isOuter" : ""}`} points={RADAR_STATS.map((_, index) => { const { x, y } = radarPoint(index, ratio); return `${x},${y}`; }).join(" ")} />
            ))}
            {RADAR_STATS.map((stat, index) => {
              const { x, y } = radarPoint(index, 1);
              return <line key={stat} className="finalStatsChartAxis" x1={CENTER} y1={CENTER} x2={x} y2={y} />;
            })}
            <polygon className="finalStatsChartBaseline" points={radarPolygon(beforeTraining, chartScale)} />
            <polygon className="finalStatsChartCurrent" points={radarPolygon(finalStats, chartScale)} />
            {RADAR_STATS.map((stat, index) => {
              const point = radarPoint(index, Math.min(1, Math.max(0, finalStats[stat] / chartScale)));
              const label = radarPoint(index, 1.3);
              const multiplier = getNatureMultiplier(nature, stat);
              return (
                <g key={stat} aria-hidden="true">
                  <circle className="finalStatsChartPoint" cx={point.x} cy={point.y} r="4" />
                  <text className="finalStatsChartLabel" x={label.x} y={label.y - 4} textAnchor="middle">{STAT_LABELS[stat]}</text>
                  <text className={`finalStatsChartValue${multiplier > 1 ? " isRaised" : multiplier < 1 ? " isLowered" : ""}`} x={label.x} y={label.y + 15} textAnchor="middle">
                    {finalStats[stat]}{multiplier > 1 ? " +" : multiplier < 1 ? " −" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="finalStatsScale">Shared scale · 0–{chartScale}</p>
        </>
      )}

      <dl className={`finalStatsList${isRadar ? " finalStatsAccessibleList" : ""}`}>
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
        Stats at level {level} with this set&apos;s IVs, EVs and nature.
        Excludes in-battle modifiers.
      </p>
    </section>
  );
}

export default FinalStats;
