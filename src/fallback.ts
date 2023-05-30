import "dotenv/config";

import axios from "axios";

import { run } from "./events";

const cron = require("node-cron");

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getTxByHash = async (hash: string) => {
  const { data } = await axios.get(`${process.env.API_URL}/transactions/${hash}`);
  return data;
};

const getScResult = async (hash: string) => {
  const { data } = await axios.get(`${process.env.API_URL}/sc-results/${hash}`);
  return data;
};

const getLastProcessedTransaction = async (): Promise<any | null> => {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;

  try {
    const txData = await getTxByHash(data.hash);
    return txData;
  } catch (e) {
    const scResult = await getScResult(data.hash);
    const txData = await getTxByHash(scResult.originalTxHash);
    return txData;
  }
};

const getTransactionFromTimestamp = async (timestamp: number): Promise<any[]> => {
  const response: any[] = [];
  let page = 0;
  const pageSize = 50;
  while (true) {
    const from = page * pageSize;
    const { data } = await axios.get(
      `${process.env.API_URL}/transactions?receiver=${process.env.SC_ADDRESS}&after=${timestamp}&order=asc&withLogs=true&withScResults=true&status=success&from=${from}&size=${pageSize}`
    );
    if (data?.length) {
      response.push(...data);
      page++;
      await sleep(250);
    } else {
      return response;
    }
  }
};

const handleSuccess = async (transaction: any) => {
  const logs = transaction?.logs?.events;
  let resultLogs: any[] = [];
  transaction?.results?.forEach((result: any) => {
    if (result?.logs?.events) {
      resultLogs = [...resultLogs, ...result?.logs?.events];
    }
  });

  const events = [...logs, ...resultLogs].map((e: any) => {
    e.txHash = transaction.txHash;
    return e;
  });

  await run(events);
};

export const cronFallback = async () => {
  const lastProcessedTransaction = await getLastProcessedTransaction();
  const lastProcessedTransactionTimestamp = lastProcessedTransaction?.timestamp;

  if (lastProcessedTransactionTimestamp) {
    const transactionsToProcess = await getTransactionFromTimestamp(lastProcessedTransactionTimestamp);

    for (let i = 0; i < transactionsToProcess.length; i++) {
      const transaction = transactionsToProcess[i];

      if (transaction.status === "success") {
        await handleSuccess(transaction);
      }

      await supabaseAdmin.from("transactions").insert({ hash: transaction.txHash });
      //   console.log(`Processed action ${transaction.txHash}`);
    }
  }
};

cronFallback();
cron.schedule("*/1 * * * *", () => {
  cronFallback();
});
