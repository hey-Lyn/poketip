import { createCallToken, sendCallError } from "../_lib/calls.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are allowed." } });
  }
  try { return response.status(200).json(await createCallToken(request)); }
  catch (error) { return sendCallError(response, error); }
}
