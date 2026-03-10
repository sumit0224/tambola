import { z } from "zod";
import { getArchitectureFeatureFlags, type ArchitectureFeatureFlags } from "@tambola/types";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().default("postgresql://postgres:postgres@localhost:5432/tambola"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("tambola-platform"),
  JWT_ISSUER: z.string().default("tambola"),
  JWT_AUDIENCE: z.string().default("tambola-clients"),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  API_GATEWAY_PORT: z.coerce.number().int().positive().default(3010),
  REALTIME_GATEWAY_PORT: z.coerce.number().int().positive().default(3020),
  ORCHESTRATOR_PORT: z.coerce.number().int().positive().default(3030),
  ROOM_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  SNAPSHOT_EVERY_EVENTS: z.coerce.number().int().positive().default(10)
});

export type EnvConfig = Omit<z.infer<typeof envSchema>, "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"> & {
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
};

export function getEnvConfig(input: Record<string, string | undefined> = process.env): EnvConfig {
  const parsed = envSchema.parse(input);
  const accessSecret = parsed.JWT_ACCESS_SECRET ?? parsed.JWT_SECRET;
  const refreshSecret = parsed.JWT_REFRESH_SECRET ?? parsed.JWT_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error("JWT secrets are required. Provide JWT_ACCESS_SECRET/JWT_REFRESH_SECRET or JWT_SECRET.");
  }

  return {
    ...parsed,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret
  };
}

export type RuntimeConfig = {
  env: EnvConfig;
  flags: ArchitectureFeatureFlags;
  kafkaBrokers: string[];
};

export function getRuntimeConfig(input: Record<string, string | undefined> = process.env): RuntimeConfig {
  const env = getEnvConfig(input);

  return {
    env,
    flags: getArchitectureFeatureFlags(input),
    kafkaBrokers: env.KAFKA_BROKERS.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  };
}
