import type { ParsedURL } from "expo-linking";

export type InviteParams = { slug?: string; g?: string };

// What the invite page's "Open in the app" link carries, in either of its
// forms: the Universal Link https://<host>/i/<slug>?g=<token>, or
// circles://invite?slug=<slug>&g=<token>, which a custom scheme parses with
// "invite" as the hostname and no path. Anything else is not an invite.
export function inviteParams({
  hostname,
  path,
  queryParams,
}: ParsedURL): InviteParams | undefined {
  const param = (name: string) => {
    const value = queryParams?.[name];
    return typeof value === "string" ? value : undefined;
  };
  if ((path || hostname) === "invite")
    return { slug: param("slug"), g: param("g") };
  const [first, slug, ...rest] = path?.split("/").filter(Boolean) ?? [];
  if (first === "i" && slug && rest.length === 0)
    return { slug, g: param("g") };
  return undefined;
}
