async function requestAdmin(path, options = {}) {
  const headers = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The admin service returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to complete the admin request.");
  }

  return data;
}

export async function listUsers(token, signal) {
  const data = await requestAdmin("/api/admin/users", { token, signal });
  return data.users ?? [];
}

export async function updateUser(token, { userId, role, credits }) {
  const body = { userId };
  if (role !== undefined) body.role = role;
  if (credits !== undefined) body.credits = credits;

  const data = await requestAdmin("/api/admin/users", {
    method: "PATCH",
    token,
    body,
  });

  return data.user;
}
