const endpoint = process.argv[2] || "http://127.0.0.1:3000/api/ai/chat";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Using the verified data, summarize Pikachu's typing, strongest base stat, weaknesses, and immunity in two short sentences.",
      history: [],
      context: { kind: "pokemon", pokemonId: 25 },
    }),
    signal: controller.signal,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Request failed with ${response.status}.`);
  }

  console.log(`Answer: ${data.answer}`);
  console.log(`Model: ${data.model}`);
  console.log(`Tokens: ${data.usage?.totalTokens ?? "unavailable"}`);
  console.log(`Sources: ${data.sources?.length ?? 0}`);
} catch (error) {
  if (error?.name === "AbortError") {
    console.error("The local AI endpoint did not respond within 30 seconds.");
  } else {
    console.error(`AI test failed: ${error.message}`);
  }
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
