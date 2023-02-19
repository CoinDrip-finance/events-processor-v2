import axios from 'axios';
import BigNumber from 'bignumber.js';

import { insertCancelStreamEvents, insertClaimEvents, insertCreateStreamEvents } from './supabase';

const cron = require("node-cron");

const allowedFunctions = ["createStream", "claimFromStream", "cancelStream", "claimFromStreamAfterCancel"];
const allowedEvents = ["createStream", "claimFromStream", "cancelStream"];

export enum EventStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  FINALIZED = "finalized",
}

const parseEvents = (events) => {
  const eventsToParse = events.filter((e) => allowedFunctions.includes(e.identifier));

  return eventsToParse.map((e) => {
    e.eventName = Buffer.from(e.topics[0], "base64").toString("utf-8");
    return e;
  });
};

const decodeBase64Number = (base64Str) => parseInt(Buffer.from(base64Str, "base64").toString("hex"), 16);

const decodeCreateStreamEvent = (event) => {
  const [_eventName, _streamId, _sender, _recipient, _payment_token, _payment_nonce, _deposit, _start_time, _end_time] =
    event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    id: decodeBase64Number(_streamId),
    sender: Buffer.from(_sender, "base64").toString("hex"),
    recipient: Buffer.from(_recipient, "base64").toString("hex"),
    payment_token: Buffer.from(_payment_token, "base64").toString("utf-8"),
    deposit: BigNumber(Buffer.from(_deposit, "base64").toString("hex"), 16).toString(),
    start_time: new Date(decodeBase64Number(_start_time) * 1000),
    end_time: new Date(decodeBase64Number(_end_time) * 1000),
  };
};
const decodeClaimFromStreamEvent = (event) => {
  const [_eventName, _streamId, _amount, _finalized] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
    amount: BigNumber(Buffer.from(_amount, "base64").toString("hex"), 16).toString(),
    finalized: _finalized ? Buffer.from(_finalized, "base64").toString("hex") === "01" : false,
  };
};
const decodeCancelStreamEvent = (event) => {
  const [_eventName, _streamId, _canceledBy, _claimedAmount] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
    canceledBy: Buffer.from(_canceledBy, "base64").toString("hex"),
    claimedAmount: BigNumber(Buffer.from(_claimedAmount || "0", "base64").toString("hex"), 16).toString(),
  };
};

const decodeMethods = {
  createStream: decodeCreateStreamEvent,
  claimFromStream: decodeClaimFromStreamEvent,
  cancelStream: decodeCancelStreamEvent,
};

let lastScanTimestamp = null;

const getLastTransactionsWithLogs = async () => {
  const url = lastScanTimestamp
    ? `${process.env.API_URL}/transactions?receiver=${process.env.SC_ADDRESS}&status=success&withLogs=true&order=desc&after=${lastScanTimestamp}`
    : `${process.env.API_URL}/transactions?receiver=${process.env.SC_ADDRESS}&status=success&withLogs=true&order=desc`;
  const { data } = await axios.get(url);

  if (!data?.length) return [];

  lastScanTimestamp = data[0].timestamp + 1;

  return data.filter((e) => allowedFunctions.includes(e?.function));
};

const processTransactions = async (transactions) => {
  const parsedEvents = {
    createStream: [],
    claimFromStream: [],
    cancelStream: [],
  };

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const events = tx?.logs?.events;

    if (events) {
      const eventsToParse = parseEvents(events);

      eventsToParse?.forEach((event) => {
        try {
          event.decoded = decodeMethods[event.eventName](event);

          if (event.decoded)
            parsedEvents[event.eventName]?.push({
              ...event,
              hash: tx.txHash,
            });
        } catch (e) {
          console.log(e);
        }
      });
    }
  }

  return parsedEvents;
};

const run = async () => {
  const transactions = await getLastTransactionsWithLogs();

  const events = await processTransactions(transactions);

  try {
    if (events?.createStream?.length) {
      await insertCreateStreamEvents(events.createStream);
    }
    if (events?.cancelStream?.length) {
      await insertCancelStreamEvents(events.cancelStream);
    }
    if (events?.claimFromStream?.length) {
      await insertClaimEvents(events.claimFromStream);
    }
  } catch (e) {
    console.log(e);
  }
};

cron.schedule("* * * * * *", run);
