import type { CSSProperties, ElementType } from "react";
import "./PokemonShared.css";

function getStatColor(value: number) {
  const strength = Math.min(value / 180, 1);
  const colors = strength < 0.5
    ? [[250, 140, 170], [190, 142, 224]]
    : [[190, 142, 224], [118, 219, 241]];
  const progress = strength < 0.5 ? strength * 2 : (strength - 0.5) * 2;
  const [start, end] = colors;
  const channel = (index: number) => Math.round(
    start[index] + (end[index] - start[index]) * progress,
  );

  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

interface PokemonStatsProps {
  stats: { name: string; value: number }[];
  headingLevel?: "h2" | "h3" | "h4";
}

function PokemonStats({ stats, headingLevel = "h2" }: PokemonStatsProps) {
  const Heading = headingLevel as ElementType;

  return (
    <section className="pokemonStats">
      <Heading>Base stats</Heading>
      {stats.map((stat) => (
        <div className="pokemonStat" key={stat.name}>
          <div className="pokemonStatLabel">
            <span>{stat.name.replaceAll("-", " ")}</span>
            <strong>{stat.value}</strong>
          </div>
          <div className="pokemonStatTrack">
            <span
              style={{
                width: `${Math.min(stat.value / 2.55, 100)}%`,
                "--stat-color": getStatColor(stat.value),
              } as CSSProperties}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

export default PokemonStats;
