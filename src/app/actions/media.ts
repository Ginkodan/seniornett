"use server";

import { headers } from "next/headers";

import { buildMediaBootstrap, searchMediaItems, uploadMediaItem } from "@/lib/media";
import { requireIdentityHeaders } from "@/lib/request-auth";

export async function getMediaBootstrap(ownerUserId?: string | null) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return buildMediaBootstrap(identity, ownerUserId);
}

export async function uploadMediaItemAction(formData: FormData) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return uploadMediaItem(identity, formData);
}

export async function searchMediaItemsAction(ownerUserId: string | null | undefined, query: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return searchMediaItems(identity, ownerUserId, query);
}
