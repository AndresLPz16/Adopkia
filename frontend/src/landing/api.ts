import { apiErrorMessage } from "../portal/shared";

export const ACCESS_TOKEN_KEY = "adopkia_access";
export const REFRESH_TOKEN_KEY = "adopkia_refresh";

export type AuthResponse = { access: string; refresh?: string; detail?: string };
export type LoginMathChallenge = { challenge_id: string; question: string };


export async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();
  let data: unknown = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = body;
    }
  }
  if (!response.ok) {
    throw new Error(apiErrorMessage(data, response.status));
  }
  return data;
}
