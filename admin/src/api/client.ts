import type { Flag } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
export const listFlags = async (): Promise<Flag[]> => {
  const response = await fetch(`${BASE_URL}/flags`);

  if (!response.ok) {
    throw new Error(`Failed to load flags (HTTP ${response.status})`);
  }
  return response.json();
};

export const createFlag = async (
  input: { key: string; description: string },
  actor: string,
) => {
  const response = await fetch(`${BASE_URL}/flags`, {
    method: "POST",
    headers: { "Content-Type": "Application/json", "X-Actor-Id": actor },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      body.error.message ?? `Failed to create flag (HTTP ${response.status})`,
    );
  }
  return body;
};

export const setEnabled = async (
  key: string,
  environment: string,
  enabled: boolean,
  actor: string,
) => {
  const response = await fetch(
    `${BASE_URL}/flags/${encodeURIComponent(key)}/environments/${encodeURIComponent(environment)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "Application/json", "X-Actor-Id": actor },
      body: JSON.stringify({ enabled }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      body.error.message ?? `Failed to update flag (HTTP ${response.status})`,
    );
  }
  return body;
};
