// sandboxClient.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

let cachedToken = null;
let tokenExpiresAt = 0; // ms timestamp

export async function getSandboxToken() {
  const now = Date.now();

  // Reuse token if still valid (give 30s buffer)
  if (cachedToken && now < tokenExpiresAt - 30000) {
    return cachedToken;
  }

  const res = await axios.post(
    process.env.SANDBOX_AUTH_URL || "https://api.sandbox.co.in/authenticate",
    null,
    {
      headers: {
        "x-api-key": process.env.SANDBOX_API_KEY,
        "x-api-secret": process.env.SANDBOX_API_SECRET,
      },
    }
  );

  const data = res.data;
  const accessToken = data?.data?.access_token;

  if (!accessToken) {
    throw new Error("Could not get Sandbox access_token");
  }

  // They don’t give explicit expiry in this payload, so either:
  // - decode JWT & read exp, or
  // - just keep it for a fixed duration (e.g. 10 mins) and refresh regularly.
  // For simplicity, we’ll assume 10 minutes:
  tokenExpiresAt = now + 10 * 60 * 1000;
  cachedToken = accessToken;

  return accessToken;
}
