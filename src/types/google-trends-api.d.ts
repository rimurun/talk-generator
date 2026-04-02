declare module 'google-trends-api' {
  const googleTrends: {
    dailyTrends(options: { geo: string }): Promise<string>;
    interestOverTime(options: Record<string, any>): Promise<string>;
    interestByRegion(options: Record<string, any>): Promise<string>;
    relatedQueries(options: Record<string, any>): Promise<string>;
    relatedTopics(options: Record<string, any>): Promise<string>;
  };
  export default googleTrends;
}
