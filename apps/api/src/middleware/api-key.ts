import type { FastifyRequest, FastifyReply } from "fastify";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  AUTH_INTERNAL_PATHS,
  BOOTSTRAP_FIRST_OPERATOR_PATH,
  DOCS_PATH_PREFIX,
  HEALTH_PATH,
  isAdminInstanceApiKeyPath,
  TEST_EXCLUDED_API_KEY_PATHS,
  TEST_EXCLUDED_AUTH_POST_PATHS,
} from "../constants";

function isExcluded(method: string, path: string, nodeEnv: string, devSkipApiKey: boolean): boolean {
  const p = path.split("?")[0] ?? "/";
  if (method === "OPTIONS") return true; // CORS preflight; browser omits credentials
  if (method === "GET" && (p === HEALTH_PATH || p.startsWith(DOCS_PATH_PREFIX))) return true;
  if (method === "POST" && p === BOOTSTRAP_FIRST_OPERATOR_PATH) return true;
  if (isAdminInstanceApiKeyPath(method, p)) return true;

  const relaxApiKey =
    nodeEnv === "test" || (nodeEnv === "development" && devSkipApiKey);

  if (relaxApiKey && method === "POST" && TEST_EXCLUDED_AUTH_POST_PATHS.includes(p)) return true;
  if (relaxApiKey && p.startsWith(AUTH_INTERNAL_PATHS.apiPrefix)) return true;
  if (relaxApiKey && TEST_EXCLUDED_API_KEY_PATHS.some((prefix) => p.startsWith(prefix))) return true;
  return false;
}

export async function apiKeyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url?.split("?")[0] ?? "/";
  const cfg = request.server.config;
  if (isExcluded(request.method, path, cfg.NODE_ENV, cfg.devSkipApiKey)) {
    return;
  }

  const apiKeyHeader = request.headers["x-api-key"];
  if (!apiKeyHeader || typeof apiKeyHeader !== "string") {
    return reply.status(401).send({
      success: false,
      error: {
        code: API_ERROR_CODES.INVALID_API_KEY,
        message: API_ERROR_MESSAGES.INVALID_API_KEY_MISSING,
      },
    });
  }

  try {
    const result = await request.server.auth.api.verifyApiKey({
      body: { key: apiKeyHeader },
    });
    if (!result.valid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: API_ERROR_CODES.INVALID_API_KEY,
          message: API_ERROR_MESSAGES.INVALID_API_KEY,
        },
      });
    }
    if (result.key) {
      request.apiKey = result.key;
    }
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: API_ERROR_CODES.INVALID_API_KEY,
        message: API_ERROR_MESSAGES.INVALID_API_KEY,
      },
    });
  }
}
