import { google } from "googleapis";
import http from "node:http";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function getLoopbackConfig() {
  const host = "127.0.0.1";
  const port = Number(process.env.GOOGLE_OAUTH_LOOPBACK_PORT ?? "53682");
  const path = "/oauth2callback";
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("GOOGLE_OAUTH_LOOPBACK_PORT must be a positive integer.");
  }
  return { host, port, path, redirectUri: `http://${host}:${port}${path}` };
}

function waitForOAuthCode(host, port, path) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for OAuth callback."));
    }, 5 * 60 * 1000);

    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "", `http://${host}:${port}`);
        if (requestUrl.pathname !== path) {
          res.statusCode = 404;
          res.end("Not found.");
          return;
        }
        const error = requestUrl.searchParams.get("error");
        if (error) {
          res.statusCode = 400;
          res.end(`OAuth error: ${error}. You can close this tab.`);
          clearTimeout(timeout);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        const code = requestUrl.searchParams.get("code");
        if (!code) {
          res.statusCode = 400;
          res.end("Missing code parameter. You can close this tab.");
          return;
        }
        res.statusCode = 200;
        res.end("Authorization successful. You can close this tab and return to the terminal.");
        clearTimeout(timeout);
        server.close();
        resolve(code);
      } catch (error) {
        clearTimeout(timeout);
        server.close();
        reject(error);
      }
    });

    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    server.listen(port, host);
  });
}

async function promptForManualCode() {
  const rl = readline.createInterface({ input, output });
  const code = (await rl.question("Paste authorization code: ")).trim();
  rl.close();
  if (!code) {
    throw new Error("No authorization code provided.");
  }
  return code;
}

async function main() {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const { host, port, path, redirectUri } = getLoopbackConfig();

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const scopes = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/business.manage",
  ];
  const authUrl = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  console.log(
    "\nIf needed, add this redirect URI to your Google OAuth client first:",
  );
  console.log(redirectUri);
  console.log("\nThis flow requests these scopes:");
  for (const scope of scopes) {
    console.log(`- ${scope}`);
  }
  console.log("\nOpen this URL in your browser and sign in as tom@beyondindigo.com:");
  console.log(authUrl);
  console.log(
    `\nWaiting for callback on http://${host}:${port}${path} ... (timeout 5 minutes)\n`,
  );

  let code;
  try {
    code = await waitForOAuthCode(host, port, path);
  } catch {
    console.warn(
      "\nAutomatic callback failed. Falling back to manual code entry mode.",
    );
    console.warn(
      "In your browser address bar, copy the `code=` value from the redirect URL and paste it below.\n",
    );
    code = await promptForManualCode();
  }

  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Retry and ensure prompt=consent and access_type=offline are used.",
    );
  }

  console.log("\nAdd this to your .env.local:");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((error) => {
  console.error("Failed to generate Google OAuth refresh token.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
