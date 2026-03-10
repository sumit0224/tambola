export type ClaimType = "TOP_ROW" | "MIDDLE_ROW" | "BOTTOM_ROW" | "EARLY_FIVE" | "FULL_HOUSE";

export type NumberCalledEvent = {
  number: number;
  callIndex: number;
  calledAt: string;
};

export type WinnerAnnouncedEvent = {
  claimType: ClaimType;
  winner: {
    userId: string;
    displayName: string;
  };
};
