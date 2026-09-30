import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
  sendAiMessage: vi.fn(),
}));

vi.mock("../services/aiApi", () => aiMocks);

import PokemonAiAssistant from "./PokemonAiAssistant";

describe("PokemonAiAssistant", () => {
  beforeEach(() => {
    aiMocks.sendAiMessage.mockReset();
  });

  it("asks grounded questions and keeps a short conversation", async () => {
    const user = userEvent.setup();
    aiMocks.sendAiMessage
      .mockResolvedValueOnce({
        answer: "Pikachu is weak to Ground-type attacks.",
        sources: ["https://pokeapi.co/api/v2/type/electric"],
      })
      .mockResolvedValueOnce({
        answer: "Its Electric typing resists Electric, Flying, and Steel.",
        sources: [],
      });

    render(<PokemonAiAssistant pokemonId={25} pokemonName="pikachu" />);

    await user.click(
      screen.getByRole("button", {
        name: "Analyze pikachu's defensive matchups.",
      }),
    );

    expect(await screen.findByText(/weak to Ground-type/)).toBeInTheDocument();
    expect(aiMocks.sendAiMessage).toHaveBeenNthCalledWith(
      1,
      "Analyze pikachu's defensive matchups.",
      expect.objectContaining({
        history: [],
        context: { kind: "pokemon", pokemonId: 25 },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.getByRole("link", { name: "Source 1" }))
      .toHaveAttribute("href", "https://pokeapi.co/api/v2/type/electric");

    await user.type(screen.getByLabelText("Your question"), "What does it resist?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText(/resists Electric, Flying, and Steel/))
      .toBeInTheDocument();
    expect(aiMocks.sendAiMessage).toHaveBeenNthCalledWith(
      2,
      "What does it resist?",
      expect.objectContaining({
        history: [
          {
            role: "user",
            content: "Analyze pikachu's defensive matchups.",
          },
          {
            role: "assistant",
            content: "Pikachu is weak to Ground-type attacks.",
          },
        ],
        context: { kind: "pokemon", pokemonId: 25 },
      }),
    );
  });

  it("shows safe service errors and can clear the conversation", async () => {
    const user = userEvent.setup();
    aiMocks.sendAiMessage.mockRejectedValueOnce(
      new Error("The AI service is temporarily unavailable."),
    );

    render(<PokemonAiAssistant pokemonId={25} pokemonName="pikachu" />);

    await user.type(screen.getByLabelText("Your question"), "Help me");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI service is temporarily unavailable.",
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Answers are grounded in verified PokéAPI data for this Pokémon."))
      .toBeInTheDocument();
  });
});
