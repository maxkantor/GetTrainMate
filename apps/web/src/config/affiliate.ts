// Amazon Affiliate configuration
export const AMAZON_ASSOCIATE_TAG = 'gettrainmate-20';

/**
 * Builds an Amazon Affiliate URL with associate tag
 * @param asin - Amazon Standard Identification Number
 * @param tag - Optional override for associate tag
 * @returns Complete Amazon URL with affiliate tracking
 */
export function buildAmazonAffiliateUrl(asin: string, tag: string = AMAZON_ASSOCIATE_TAG): string {
  return `https://www.amazon.com/dp/${asin}?tag=${tag}`;
}
