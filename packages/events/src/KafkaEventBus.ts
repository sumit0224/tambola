import { Kafka, logLevel, type Consumer, type ConsumerRunConfig, type Producer } from "kafkajs";
import {
  claimEventsTopic,
  gameEventsTopic,
  kafkaTopics,
  roomEventsTopic,
  type AnyBackboneEvent,
  type BackboneEventType,
  type KafkaTopic
} from "@tambola/types";
import { assertBackboneEvent } from "./schema";

export type BackboneEventHandler = (input: {
  topic: KafkaTopic;
  partition: number;
  offset: number;
  event: AnyBackboneEvent;
}) => Promise<void> | void;

export type KafkaEventBusOptions = {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
    username: string;
    password: string;
  };
};

function mapEventTypeToTopic(eventType: BackboneEventType): KafkaTopic {
  switch (eventType) {
    case "ROOM_CREATED":
    case "PLAYER_JOINED":
      return roomEventsTopic;
    case "GAME_STARTED":
    case "NUMBER_CALLED":
    case "GAME_ENDED":
      return gameEventsTopic;
    case "CLAIM_ACCEPTED":
      return claimEventsTopic;
    default:
      return gameEventsTopic;
  }
}

export class KafkaEventBus {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(private readonly options: KafkaEventBusOptions) {
    this.kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
      ssl: options.ssl,
      sasl: options.sasl,
      logLevel: logLevel.INFO
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true
    });
  }

  async connectProducer(): Promise<void> {
    await this.producer.connect();
  }

  async disconnectProducer(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(topic: KafkaTopic, event: AnyBackboneEvent): Promise<void> {
    const validated = assertBackboneEvent(event);

    await this.producer.send({
      topic,
      acks: -1,
      messages: [
        {
          key: validated.roomId,
          value: JSON.stringify(validated),
          headers: {
            eventType: Buffer.from(validated.type),
            roomId: Buffer.from(validated.roomId)
          }
        }
      ]
    });
  }

  async publishByType(event: AnyBackboneEvent): Promise<void> {
    await this.publish(mapEventTypeToTopic(event.type), event);
  }

  async subscribe(input: {
    groupId: string;
    topics: KafkaTopic[];
    handler: BackboneEventHandler;
    fromBeginning?: boolean;
    runConfig?: Omit<ConsumerRunConfig, "eachMessage">;
  }): Promise<() => Promise<void>> {
    const consumer = this.kafka.consumer({ groupId: input.groupId });
    this.consumers.push(consumer);

    await consumer.connect();

    for (const topic of input.topics) {
      await consumer.subscribe({ topic, fromBeginning: input.fromBeginning ?? false });
    }

    await consumer.run({
      ...input.runConfig,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          return;
        }

        const parsed = JSON.parse(message.value.toString("utf-8")) as AnyBackboneEvent;
        const validated = assertBackboneEvent(parsed);
        const offset = Number(message.offset);

        await input.handler({
          topic: topic as KafkaTopic,
          partition,
          offset: Number.isFinite(offset) ? offset : validated.offset,
          event: validated
        });
      }
    });

    return async () => {
      await consumer.disconnect();
      const index = this.consumers.indexOf(consumer);
      if (index >= 0) {
        this.consumers.splice(index, 1);
      }
    };
  }

  async ensureTopics(): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const admin = this.kafka.admin();
    await admin.connect();

    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        { topic: kafkaTopics.roomEvents, numPartitions: 24, replicationFactor: 1 },
        { topic: kafkaTopics.gameEvents, numPartitions: 24, replicationFactor: 1 },
        { topic: kafkaTopics.claimEvents, numPartitions: 24, replicationFactor: 1 },
        { topic: kafkaTopics.fraudEvents, numPartitions: 24, replicationFactor: 1 }
      ]
    });

    await admin.disconnect();
  }

  async disconnectConsumers(): Promise<void> {
    await Promise.all(
      this.consumers.map(async (consumer) => {
        try {
          await consumer.disconnect();
        } catch {
          // no-op
        }
      })
    );

    this.consumers.length = 0;
  }
}
