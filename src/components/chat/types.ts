export type DealerThread = {
  id: string;
  matchId: string;
  listingId: string;
  listingLabel: string;
  counterpartyLabel: string;
  identityRevealed: boolean;
  viewerIsSeller: boolean;
  updatedAt: string;
};

export type DealerMessage = {
  id: string;
  body: string;
  fromViewerCompany: boolean;
  createdAt: string;
};

export type DealerThreadDetail = {
  thread: DealerThread;
  messages: DealerMessage[];
  unreadCount: number;
};

export type PlatformThread = {
  id: string;
  listingId: string;
  listingLabel: string;
  sellerCompanyName: string;
  buyerCompanyName: string;
  identityRevealed: boolean;
  updatedAt: string;
};

export type PlatformMessage = {
  id: string;
  body: string;
  senderCompanyName: string;
  senderUserName: string;
  senderUserEmail: string;
  createdAt: string;
};
