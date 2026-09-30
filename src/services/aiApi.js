export async function sendAiMessage(message, options = {}) {
  const body = {
    message,
    history: options.history ?? [],
  };
  if (options.context) body.context = options.context;
  if (options.mode) body.mode = options.mode;

  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The AI service returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to contact the AI service.");
  }

  if (typeof data.answer !== "string") {
    throw new Error("The AI service returned an invalid response.");
  }

  return data;
}
