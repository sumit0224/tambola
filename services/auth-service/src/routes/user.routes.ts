import type { FastifyInstance } from "fastify";
import { AuthService } from "../services/auth.service";
import { AppError } from "../common/errors";
import { UserRepository } from "@tambola/db";

export async function userRoutes(app: FastifyInstance) {
  const authService = new AuthService();
  const userRepository = new UserRepository();

  app.get("/users/me", async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new AppError(401, "UNAUTHORIZED");
    }

    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : authorization.trim();
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED");
    }

    const claims = authService.verifyAccessToken(token);
    const user = await userRepository.findById(claims.sub);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND");
    }

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email
    };
  });
}
