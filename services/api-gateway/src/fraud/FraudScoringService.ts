import { ClaimRepository } from "@tambola/db";

export type FraudSignals = {
  roomId: string;
  userId: string;
  claimId?: string;
  claimLatencyMs: number;
  invalidClaimRatio: number;
  multiDeviceAnomaly: number;
  ipChurn: number;
};

export class FraudScoringService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async evaluateClaim(signals: FraudSignals): Promise<{ score: number; action: string | null }> {
    const score = this.computeRiskScore(signals);
    const severity = score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

    await this.claimRepository.createFraudEvent({
      roomId: signals.roomId,
      userId: signals.userId,
      claimId: signals.claimId,
      eventType: "CLAIM_EVALUATED",
      severity,
      score,
      payload: {
        claimLatencyMs: signals.claimLatencyMs,
        invalidClaimRatio: signals.invalidClaimRatio,
        multiDeviceAnomaly: signals.multiDeviceAnomaly,
        ipChurn: signals.ipChurn
      }
    });

    await this.claimRepository.createRiskScore({
      roomId: signals.roomId,
      userId: signals.userId,
      score,
      modelVersion: "fraud-v1",
      reasons: {
        claimLatencyMs: signals.claimLatencyMs,
        invalidClaimRatio: signals.invalidClaimRatio,
        multiDeviceAnomaly: signals.multiDeviceAnomaly,
        ipChurn: signals.ipChurn
      }
    });

    const action = this.selectAction(score);
    if (action) {
      await this.claimRepository.createEnforcementAction({
        roomId: signals.roomId,
        userId: signals.userId,
        actionType: action,
        reason: `Automatic enforcement due to risk score ${score}`,
        expiresAt: action === "TEMP_SUSPENSION" ? new Date(Date.now() + 30 * 60_000) : undefined
      });
    }

    return {
      score,
      action
    };
  }

  private computeRiskScore(signals: FraudSignals): number {
    const latencyFactor = signals.claimLatencyMs < 700 ? 35 : signals.claimLatencyMs < 1500 ? 20 : 5;
    const invalidFactor = Math.min(25, Math.round(signals.invalidClaimRatio * 25));
    const multiDeviceFactor = Math.min(20, Math.round(signals.multiDeviceAnomaly * 20));
    const ipChurnFactor = Math.min(20, Math.round(signals.ipChurn * 20));

    return Math.min(100, latencyFactor + invalidFactor + multiDeviceFactor + ipChurnFactor);
  }

  private selectAction(score: number): string | null {
    if (score >= 85) {
      return "TEMP_SUSPENSION";
    }

    if (score >= 65) {
      return "CLAIM_COOLDOWN";
    }

    if (score >= 50) {
      return "MANUAL_REVIEW";
    }

    return null;
  }
}
