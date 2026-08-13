/**
 * The name a CLIENT should see.
 *
 * `account_name` is the internal identifier and often carries a group prefix
 * ("RPVH - MarketPlace Veterinary Hospital"), which reads wrong in a caption or
 * anything else a practice's followers will read. `public_name` overrides it
 * when set; a null or blank value falls back to `account_name` so behaviour is
 * unchanged for clients that never set one.
 *
 * Use this for anything client-facing — generated copy, exports, briefs.
 * Internal UI (client list, workspace headers, pickers) keeps `account_name`,
 * because that's what the team searches by.
 */
export function getClientDisplayName(
  client: { public_name?: string | null; account_name: string | null },
): string {
  return client.public_name?.trim() || client.account_name || "";
}
