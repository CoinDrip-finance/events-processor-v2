import { AbiRegistry, Address, ResultsParser } from "@multiversx/sdk-core/out";
import { TransactionEvent, TransactionEventTopic } from "@multiversx/sdk-network-providers/out";
import BigNumber from "bignumber.js";

import coinDripAbi from "./abi.json";

export interface Event {
  identifier: string;
  address: string;
  topics: string[];
  data: string;
  txHash: string;
}

interface BaseDecodedEvent {
  hash: string;
}

interface CreateStreamEventSegment {
  amount: BigNumber;
  exponent: BigNumber;
  duration: BigNumber;
}

export interface CreateStreamEvent extends BaseDecodedEvent {
  sender: Address;
  recipient: Address;
  stream_token_identifier: string;
  stream_token_nonce: BigNumber;
  payment_token: string;
  payment_nonce: BigNumber;
  deposit: BigNumber;
  deposit_with_fees: BigNumber;
  start_time: BigNumber;
  end_time: BigNumber;
  can_cancel: boolean;
  cliff: BigNumber;
  segments: CreateStreamEventSegment[];
  hash: string;
}

export interface ClaimStreamEvent extends BaseDecodedEvent {
  stream_id: BigNumber;
  amount: BigNumber;
  recipient: Address;
}

export interface CancelStreamEvent extends BaseDecodedEvent {
  stream_id: BigNumber;
  canceled_by: Address;
  claimed_amount: BigNumber;
}

export interface FinishedStreamEvent extends BaseDecodedEvent {
  stream_id: BigNumber;
}

export class EventsParser {
  protected resultParser = new ResultsParser();
  abiRegistry: AbiRegistry;
  scAddress: string;

  constructor(scAddress: string) {
    this.abiRegistry = AbiRegistry.create(coinDripAbi);
    this.scAddress = scAddress;
  }

  getEventName(event: Event) {
    const eventName = Buffer.from(event.topics[0], "base64").toString("utf-8");
    return eventName;
  }

  parseEvents(events: Event[]) {
    const parsedEvents = events
      .filter((event) => {
        const eventName = this.getEventName(event);
        return this.scAddress === event.address && this.abiRegistry.events.find((e) => e.identifier === eventName);
      })
      .map((event) => {
        const eventName = this.getEventName(event);

        const eventDefinition = this.abiRegistry.getEvent(eventName);

        const txEvent = new TransactionEvent({
          identifier: event.identifier,
          topics: event.topics.map((topic) => new TransactionEventTopic(topic)),
        });

        return {
          hash: event.txHash,
          eventName,
          decoded: this.resultParser.parseEvent(txEvent, eventDefinition),
        };
      });

    return parsedEvents;
  }
}
