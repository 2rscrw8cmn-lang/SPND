# SimpleFIN Bridge — Owner Setup and Developer Integration

## What SimpleFIN does

SimpleFIN Bridge is the read-only connection layer between SPND and household financial institutions. It is not a bank login form inside SPND. The user authorizes a connection through SimpleFIN, then SPND receives a revocable access credential for transaction data.

Current SimpleFIN Bridge pricing is $15/year or $1.50/month, for up to 25 institutions and 25 apps. Verify coverage for every required institution before relying on it.

## Zack's initial account setup

1. Go to [SimpleFIN Bridge](https://bridge.simplefin.org/) and create/sign into the household account.
2. Subscribe, then add each desired financial institution and select the appropriate accounts.
3. Confirm balances and transactions appear in SimpleFIN.
4. In SimpleFIN, create a new connection for **SPND** and generate a one-time Setup Token.
5. In SPND, sign in as Zack, open **Settings → Connections → SimpleFIN**, and paste the token once.
6. SPND claims the token server-side, starts the first sync, and shows account selection.
7. Mark each imported account as included in cash flow, included in net worth only, or excluded.

Never send a Setup Token in email, chat, GitHub, screenshots, issue text, or a `.env` file.

## Required implementation flow

1. Authenticated client submits the Setup Token over HTTPS to `POST /api/connections/simplefin/claim`.
2. Server validates household membership and token format.
3. Server base64-decodes the token to its claim URL and sends an empty `POST` to claim it.
4. Server receives the one-time access URL, encrypts it immediately, and saves it to `financial_connections`.
5. Server requests `{access-url}/accounts?version=2`, using only server-side code.
6. Normalize and upsert data; write structured `sync_runs` records.
7. On disconnect, delete encrypted access material and mark the connection disconnected.

## Rate limits and sync rules

- SimpleFIN is intended to provide daily transaction updates.
- Expect no more than 24 requests/day per access token; start with one scheduled sync per day.
- `/accounts` requests are limited to 90 days per date range.
- Initial import should paginate historical periods in 90-day windows, throttled conservatively.
- Surface the provider's structured `errlist` to the user in a friendly connection-status screen.

## Provider references

- [SimpleFIN Bridge](https://bridge.simplefin.org/)
- [SimpleFIN developer guide](https://beta-bridge.simplefin.org/info/developers)
- [SimpleFIN protocol](https://www.simplefin.org/protocol-v1.html)

## Test plan

- Use the published demo token only in local development.
- Test valid claim, invalid token, expired/claimed token, sync error, partial account error, and disconnect.
- Verify no route response, browser storage, analytics event, or log contains an access URL.
