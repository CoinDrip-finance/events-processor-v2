import "dotenv/config";

import { run } from "./events";

const amqplib = require("amqplib");

(async () => {
  const queue = process.env.RABBIT_QUEUE;
  const connection = await amqplib.connect(process.env.RABBIT_CONNECTION_STRING);

  const channel = await connection.createChannel();
  await channel.checkQueue(queue);

  channel.consume(queue, (msg: any) => {
    if (msg !== null) {
      const { events } = JSON.parse(msg.content.toString());

      if (events?.length > 0) {
        run(events);
      }

      channel.ack(msg);
    }
  });
})();
