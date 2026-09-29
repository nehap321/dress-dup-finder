import type { Listing } from "../marketplaces/Listing";
import { StyleQuery } from "./StyleQuery";

export class ListingOrder {
  static byLookAndPrice(listings: Listing[], words: string[]): Listing[] {
    return [...listings].sort((left, right) => {
      const look = StyleQuery.closeness(right.title, words) - StyleQuery.closeness(left.title, words);
      if (look !== 0) return look;
      return (left.price?.amount ?? Number.POSITIVE_INFINITY) - (right.price?.amount ?? Number.POSITIVE_INFINITY);
    });
  }
}
