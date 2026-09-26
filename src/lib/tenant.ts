import "server-only";
import { requireContext } from "./auth/context";

/** The company the signed-in user is currently working in. Redirects to /login when there is none. */
export async function getCompany() {
  return (await requireContext()).company;
}

export async function getCompanyId(): Promise<string> {
  return (await getCompany()).id;
}
