import { getCallConfig } from "../_lib/calls.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Only GET requests are allowed." } });
  }
  return response.status(200).json({ available: getCallConfig() !== null });
}
