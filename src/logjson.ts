import { LogObj } from "./types";

export const logJson = (mData: (string | LogObj)[]): void => {
  console.log(
    JSON.stringify({
      timestamp: Date.now(),
      message: mData
    })
  );
};

export const logSh = (mData: string): void => {
  console.log(mData);
};
