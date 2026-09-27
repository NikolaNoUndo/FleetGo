import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * App-wide link without automatic prefetching. Every page here is rendered on the
 * server per request, so Next.js' default "prefetch every visible link" turned one
 * page view into ~35 extra server calls (measured) while the click still fetched
 * the page again. Pass prefetch explicitly to opt back in for a single link.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
