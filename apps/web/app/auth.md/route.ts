const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const markdown = `# Artifacts auth.md

Artifacts supports auth.md agent registration as an additive agent-authentication layer. Human sign-in remains handled by Better Auth at the normal web login page.

## Endpoints

- Registration: \`${appUrl}/agent/identity\`
- Anonymous claim request: \`${appUrl}/agent/identity/claim\`
- Human claim page: \`${appUrl}/agent/claim\`
- OAuth token endpoint: \`${appUrl}/oauth2/token\`
- OAuth revocation endpoint: \`${appUrl}/oauth2/revoke\`
- Protected resource metadata: \`${appUrl}/.well-known/oauth-protected-resource\`
- Authorization server metadata: \`${appUrl}/.well-known/oauth-authorization-server\`
- MCP endpoint: \`${appUrl}/mcp\`

## Supported First-Release Flows

### service_auth

\`POST /agent/identity\` with:

\`\`\`json
{ "type": "service_auth", "login_hint": "user@example.com", "scopes": ["artifacts:read"] }
\`\`\`

The response includes a low-risk \`claim_token\`, a \`user_code\`, and a verification URL. The agent receives no access credential until the signed-in user confirms the claim.

### anonymous

\`POST /agent/identity\` with:

\`\`\`json
{ "type": "anonymous", "scopes": ["artifacts:read"] }
\`\`\`

The response includes an unclaimed identity assertion and a \`claim_token\`. Anonymous pre-claim access is intentionally short-lived and limited to \`artifacts:read\`.

To start claiming an anonymous registration, call \`POST /agent/identity/claim\` with the \`claim_token\` and \`login_hint\`. The human claim page then requires the matching Better Auth account.

## Token Grants

- \`urn:ietf:params:oauth:grant-type:jwt-bearer\` exchanges an anonymous pre-claim identity assertion for a short-lived bearer token.
- \`urn:agent-artifacts:params:oauth:grant-type:claim_token\` exchanges a completed claim token for a post-claim bearer token.

Access tokens are bearer tokens. No refresh tokens are issued. Re-run the registration or claim exchange when a token expires.

## Scopes

- \`artifacts:read\`
- \`artifacts:create\`
- \`artifacts:update\`
- \`artifacts:delete\`
- \`artifacts:share\`
- \`artifacts:access:read\`
- \`artifacts:access:write\`
- \`agents:manage\`

Anonymous pre-claim credentials are constrained to \`artifacts:read\` unless server configuration narrows them further.

## Revocation

Revoke an access token with \`POST /oauth2/revoke\` and a \`token\` parameter. Revocation is idempotent. When an anonymous registration is claimed, all pre-claim access tokens for that registration are revoked and the agent must exchange the completed claim token for a fresh post-claim token.

## Errors

OAuth-style errors use JSON fields \`error\` and \`error_description\`. Common values include \`auth_md_disabled\`, \`invalid_grant\`, \`authorization_pending\`, \`invalid_claim_token\`, and \`login_hint_mismatch\`.
`;

export function GET() {
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
