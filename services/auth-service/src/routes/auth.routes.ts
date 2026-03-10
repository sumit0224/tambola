import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService } from "../services/auth.service";

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(60),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService();

  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const deviceId = (request.headers["x-device-id"] as string | undefined) ?? "unknown-device";
    const response = await authService.register(body, {
      deviceId,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    });
    return reply.code(201).send(response);
  });

  app.post("/auth/login", async (request) => {
    const body = loginSchema.parse(request.body);
    const deviceId = (request.headers["x-device-id"] as string | undefined) ?? "unknown-device";
    return authService.login(body, { deviceId, ipAddress: request.ip });
  });

  app.post("/auth/refresh", async (request) => {
    const bodySchema = z.object({
      refreshToken: z.string().min(16)
    });

    const body = bodySchema.parse(request.body);
    return authService.refresh({ refreshToken: body.refreshToken });
  });
}
