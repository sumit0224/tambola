export type ArchitectureFeatureFlags = {
  useDurableBackbone: boolean;
  useRedisRoomState: boolean;
  useKafkaEvents: boolean;
  useNewAuth: boolean;
  useSocketGatewayV2: boolean;
  useGameOrchestrator: boolean;
  enableFraudEnforcement: boolean;
};

export function getArchitectureFeatureFlags(
  source: Record<string, string | undefined> = process.env
): ArchitectureFeatureFlags {
  const bool = (value: string | undefined, fallback: boolean) => {
    if (value === undefined) {
      return fallback;
    }

    return value === "1" || value.toLowerCase() === "true";
  };

  return {
    useDurableBackbone: bool(source.FF_DURABLE_BACKBONE, false),
    useRedisRoomState: bool(source.FF_REDIS_ROOM_STATE, false),
    useKafkaEvents: bool(source.FF_KAFKA_EVENTS, false),
    useNewAuth: bool(source.FF_NEW_AUTH, false),
    useSocketGatewayV2: bool(source.FF_SOCKET_GATEWAY_V2, false),
    useGameOrchestrator: bool(source.FF_GAME_ORCHESTRATOR, false),
    enableFraudEnforcement: bool(source.FF_FRAUD_ENFORCEMENT, false)
  };
}
