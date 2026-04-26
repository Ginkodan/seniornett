"use server";

import { headers } from "next/headers";

import {
  buildMarketplaceBootstrap,
  createMarketplaceListing,
  deleteMarketplaceListing,
  startMarketplaceConversation,
  type CreateMarketplaceListingInput,
} from "@/lib/marketplace";
import { requireIdentityHeaders } from "@/lib/request-auth";

export async function getMarketplaceBootstrapAction() {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return buildMarketplaceBootstrap(identity);
}

export async function createMarketplaceListingAction(input: CreateMarketplaceListingInput) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return createMarketplaceListing(identity, input);
}

export async function startMarketplaceConversationAction(listingId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return startMarketplaceConversation(identity, listingId);
}

export async function deleteMarketplaceListingAction(listingId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return deleteMarketplaceListing(identity, listingId);
}
