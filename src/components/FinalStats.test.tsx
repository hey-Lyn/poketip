import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StatBlock } from "../types";
import FinalStats from "./FinalStats";

const baseStats: StatBlock = {
  hp: 100,
  attack: 100,
  defense: 100,
  specialAttack: 100,
  specialDefense: 100,
  speed: 100,
};

const perfectIvs: StatBlock = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

const maxEvs: StatBlock = {
  hp: 252,
  attack: 252,
  defense: 252,
  specialAttack: 252,
  specialDefense: 252,
  speed: 252,
};

describe("FinalStats", () => {
  it("renders base and final values, nature markers, and totals", () => {
    render(
      <FinalStats
        baseStats={baseStats}
        ivs={perfectIvs}
        evs={maxEvs}
        nature="Adamant"
        level={100}
      />,
    );

    expect(screen.getByRole("heading", { name: "Final stats" }))
      .toBeInTheDocument();
    expect(screen.getByText("Lv. 100")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getAllByText("299")).toHaveLength(3);
    expect(screen.getByText("328")).toBeInTheDocument();
    expect(screen.getByText("269")).toBeInTheDocument();
    expect(screen.getAllByLabelText("raised by nature")).toHaveLength(1);
    expect(screen.getAllByLabelText("lowered by nature")).toHaveLength(1);
    expect(screen.getByText("600")).toBeInTheDocument();
    expect(screen.getByText("1898")).toBeInTheDocument();
    expect(screen.getByText(/excludes in-battle modifiers/i)).toBeInTheDocument();
  });

  it("has no nature markers for a neutral nature", () => {
    render(<FinalStats baseStats={baseStats} nature="Hardy" />);

    expect(screen.queryByLabelText("raised by nature")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("lowered by nature")).not.toBeInTheDocument();
    expect(screen.getByText("341")).toBeInTheDocument();
  });

  it("shows 1 HP for Shedinja", () => {
    render(
      <FinalStats
        baseStats={baseStats}
        ivs={perfectIvs}
        evs={maxEvs}
        level={100}
        isShedinja
      />,
    );

    const hpValue = screen.getAllByText("1").find((element) =>
      element.classList.contains("finalStatsValue"),
    );
    expect(hpValue).toBeInTheDocument();
  });

  it("updates the radar after investment without changing its scale or baseline", () => {
    const { container, rerender } = render(<FinalStats baseStats={baseStats} variant="radar" />);
    const initialPoints = container.querySelector(".finalStatsChartCurrent")?.getAttribute("points");
    const baseline = container.querySelector(".finalStatsChartBaseline")?.getAttribute("points");
    const scale = screen.getByText(/Shared scale/).textContent;
    expect(initialPoints).toBe(baseline);
    expect(screen.getByRole("img", { name: /Final stats radar/ })).toBeInTheDocument();

    rerender(<FinalStats baseStats={baseStats} evs={{ attack: 252 }} variant="radar" />);
    expect(container.querySelector(".finalStatsChartCurrent")?.getAttribute("points")).not.toBe(initialPoints);
    expect(container.querySelector(".finalStatsChartBaseline")?.getAttribute("points")).toBe(baseline);
    expect(screen.getByText(/Shared scale/)).toHaveTextContent(scale!);
  });
});
