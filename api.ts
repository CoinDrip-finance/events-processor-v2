import 'dotenv/config';

import axios from 'axios';

export const getTokenData = async (tokenIdentifier: string) => {
  if (tokenIdentifier === "EGLD") {
    return {
      decimals: 18,
      payment_token_label: "EGLD",
    };
  }
  const {
    data: {
      data: {
        data: { returnData },
      },
    },
  } = await axios.post(`${process.env.GATEWAY_URL}/vm-values/query`, {
    scAddress: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzllls8a5w6u",
    funcName: "getTokenProperties",
    args: [Buffer.from(tokenIdentifier, "utf-8").toString("hex")],
  });

  const tokenName = Buffer.from(returnData[0], "base64").toString("utf-8");
  const decimals = parseInt(Buffer.from(returnData[5], "base64").toString("utf-8").replace("NumDecimals-", ""));

  return {
    decimals,
    payment_token_label: tokenName,
  };
};
