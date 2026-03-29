import { jwtVerify } from "jose";
import { getApiBaseUrl, getJwksForBaseUrl } from "./jwks";

export async function verifyOperatorAccessToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getJwksForBaseUrl(getApiBaseUrl()), {
      algorithms: ["EdDSA"],
    });
    return payload.role === "admin";
  } catch {
    return false;
  }
}
