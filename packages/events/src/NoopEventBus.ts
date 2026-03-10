import type { AnyBackboneEvent, KafkaTopic } from "@tambola/types";

export class NoopEventBus {
  async connectProducer(): Promise<void> {
    // no-op
  }

  async disconnectProducer(): Promise<void> {
    // no-op
  }

  async publish(_topic: KafkaTopic, _event: AnyBackboneEvent): Promise<void> {
    // no-op
  }

  async publishByType(_event: AnyBackboneEvent): Promise<void> {
    // no-op
  }

  async subscribe(_input: {
    groupId: string;
    topics: KafkaTopic[];
    handler: (input: { topic: KafkaTopic; partition: number; offset: number; event: AnyBackboneEvent }) => Promise<void> | void;
    fromBeginning?: boolean;
  }): Promise<() => Promise<void>> {
    return async () => {
      // no-op
    };
  }

  async ensureTopics(): Promise<void> {
    // no-op
  }

  async disconnectConsumers(): Promise<void> {
    // no-op
  }
}
