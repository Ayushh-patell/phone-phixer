// lib/checkLogic.js
export const calculateSelfChecks = (selfVol) =>
  Math.floor((selfVol || 0) / 4);

export const calculateTreeChecks = (left, right) => {
  const leftPairs = Math.floor((left || 0) / 2);
  const rightPairs = Math.floor((right || 0) / 2);
  return Math.min(leftPairs, rightPairs);
};

export const CHECK_PAYOUT_AMOUNT = 540;