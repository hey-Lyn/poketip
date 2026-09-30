import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({ sendAiMessage: vi.fn() }));
vi.mock("../services/aiApi", () => aiMocks);

import TeamAiAssistant from "./TeamAiAssistant";

const pikachu = {
  id: 25,
  name: "pikachu",
  sprite: "pikachu.png",
  types: ["electric"],
  level: 50,
  item: "light-ball",
  ability: "static",
  nature: "timid",
  teraType: "fairy",
  moves: ["thunderbolt", "", "", ""],
};

describe("TeamAiAssistant", () => {
  beforeEach(() => aiMocks.sendAiMessage.mockReset());

  it("sends the six team slots and selected format for grounded analysis", async () => {
    const user = userEvent.setup();
    aiMocks.sendAiMessage.mockResolvedValue({
      answer: "The team has a shared Ground weakness.",
      sources: ["https://pokeapi.co/api/v2/pokemon/25"],
    });

    render(
      <TeamAiAssistant
        team={[pikachu, null, null, null, null, null]}
        format="gen9-singles"
        moveTypes={["electric"]}
      />,
    );
    await user.click(screen.getByRole("button", {
      name: "Identify the team's biggest weaknesses and defensive gaps.",
    }));

    expect(await screen.findByText(/shared Ground weakness/)).toBeInTheDocument();
    expect(aiMocks.sendAiMessage).toHaveBeenCalledWith(
      "Identify the team's biggest weaknesses and defensive gaps.",
      expect.objectContaining({
        context: expect.objectContaining({
          kind: "team",
          format: "gen9-singles",
          moveTypes: ["electric"],
          members: expect.arrayContaining([
            expect.objectContaining({ id: 25, ability: "static" }),
          ]),
        }),
        history: [],
      }),
    );
    const sentContext = aiMocks.sendAiMessage.mock.calls[0][1].context;
    expect(sentContext.members).toHaveLength(6);
    expect(sentContext.members[0]).not.toHaveProperty("types");
    expect(screen.getByRole("link", { name: "Source 1" })).toBeInTheDocument();
  });

  it("requires at least one team member", () => {
    render(
      <TeamAiAssistant team={Array(6).fill(null)} format="gen9-singles" />,
    );

    expect(screen.getByLabelText("Ask about this team")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
    expect(screen.getByText(/add at least one Pokémon/iu)).toBeInTheDocument();
  });

  it("applies only an explicitly submitted AI team edit and supports undo", async () => {
    const user = userEvent.setup();
    const onApplyTeam = vi.fn();
    aiMocks.sendAiMessage.mockResolvedValue({
      answer: "Pikachu now uses a Timid nature.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: {
          id: 25,
          name: "pikachu",
          speciesName: "pikachu",
          sprite: "pikachu.png",
          types: ["electric"],
          abilities: [{ name: "static" }],
        },
        changes: { nature: "Timid" },
      }],
      sources: [],
    });

    render(
      <TeamAiAssistant
        team={[pikachu, null, null, null, null, null]}
        format="gen9-singles"
        moveTypes={["electric"]}
        onApplyTeam={onApplyTeam}
      />,
    );
    await user.type(
      screen.getByLabelText("Ask about this team"),
      "Change Pikachu to a Timid nature",
    );
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(aiMocks.sendAiMessage).toHaveBeenCalledWith(
      "Change Pikachu to a Timid nature",
      expect.objectContaining({ mode: "team-edit" }),
    );
    expect(onApplyTeam).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 25, nature: "Timid" }),
    ]));
    expect(await screen.findByText("1 team change applied.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo AI changes" }));
    expect(onApplyTeam).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 25, nature: "timid" }),
    ]));
  });

  it("keeps the conversation when the component remounts", async () => {
    const user = userEvent.setup();
    aiMocks.sendAiMessage.mockResolvedValue({
      answer: "The team is balanced.",
      sources: [],
    });

    const teamProps = {
      team: [pikachu, null, null, null, null, null],
      format: "gen9-singles",
      moveTypes: ["electric"],
    };
    const { unmount } = render(<TeamAiAssistant {...teamProps} />);
    await user.click(screen.getByRole("button", {
      name: "Identify the team's biggest weaknesses and defensive gaps.",
    }));
    await screen.findByText("The team is balanced.");

    unmount();

    render(<TeamAiAssistant {...teamProps} />);

    expect(screen.getByText("The team is balanced.")).toBeInTheDocument();
  });
});
