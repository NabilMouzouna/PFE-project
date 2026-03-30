import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/jwks";

export const dynamic = "force-dynamic";

/** Proxies operators to live Swagger on `apps/api` (separate from marketing `/docs`). */
export default function ApiReferencePage() {
  redirect(`${getApiBaseUrl()}/docs`);
}
