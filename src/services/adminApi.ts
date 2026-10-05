export interface RequestAdminOptions {
  token?: string | null;
  method?: string;
  body?: any;
  signal?: AbortSignal;
}

export interface UpdateUserInput {
  userId: string;
  role?: string;
  credits?: number;
}

async function requestAdmin(path: string, options: RequestAdminOptions = {}) {
  const headers: Record<string, string> = {};
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
    if (response.status >= 500) {
      throw new Error("The admin service is temporarily unavailable. Please try again shortly.");
    }
    if (response.status === 404) {
      throw new Error("The admin service is unavailable at this address.");
    }
    throw new Error("The admin service returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(data.error?.message || "Unable to complete the admin request.");
  }

  return data;
}

export async function listUsers(token: string, signal?: AbortSignal) {
  const data = await requestAdmin("/api/admin/users", { token, signal });
  return data.users ?? [];
}

export async function updateUser(token: string, { userId, role, credits }: UpdateUserInput) {
  const body: { userId: string; role?: string; credits?: number } = { userId };
  if (role !== undefined) body.role = role;
  if (credits !== undefined) body.credits = credits;

  const data = await requestAdmin("/api/admin/users", {
    method: "PATCH",
    token,
    body,
  });

  return data.user;
}
