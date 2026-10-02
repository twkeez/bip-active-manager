/**
 * Who gets a Business Profile refresh: reputation (ORM) clients only.
 *
 * Each refresh asks Google Places for the listing with its reviews, the
 * priciest Places tier (~2.5¢ a call). Refreshing all 216 listed clients
 * nightly cost ~$5.40 a day from Sept 21, 2026; 187 of them do not pay for
 * reputation work. Tom (2026-10-02): keep the 29 ORM clients nightly, stop
 * everyone else completely, manual refreshes included.
 */
export function isReputationClient(orm: string | null | undefined): boolean {
  const value = (orm ?? "").trim().toLowerCase();
  return value !== "" && value !== "n" && value !== "no" && value !== "none";
}

export const NOT_REPUTATION_CLIENT_MESSAGE =
  "Business Profile refresh is limited to reputation (ORM) clients, to control Google Places costs. This client does not have ORM, so no refresh was run.";

export class NotReputationClientError extends Error {
  constructor() {
    super(NOT_REPUTATION_CLIENT_MESSAGE);
    this.name = "NotReputationClientError";
  }
}
