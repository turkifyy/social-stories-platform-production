declare module 'google-trends-api' {
  export function relatedQueries(options: {
    keyword: string;
    geo?: string;
    category?: number;
    hl?: string;
  }): Promise<string>;

  export function dailyTrends(options: {
    geo?: string;
  }): Promise<string>;

  export function interestOverTime(options: {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
  }): Promise<string>;
}
