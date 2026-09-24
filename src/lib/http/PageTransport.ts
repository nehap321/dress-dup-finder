export type FetchedPage = {
  url: string;
  status: number;
  body: string;
  contentType: string;
};

export type PageTransport = {
  get(url: string): Promise<FetchedPage>;
};
