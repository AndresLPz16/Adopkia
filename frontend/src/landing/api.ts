import { apiErrorMessage } from "../portal/shared";

export type AuthResponse = { access: string; detail?: string };
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
