"use server";

import { headers } from "next/headers";

import {
  buildMediaBootstrap,
  getMediaImageDataUrl,
  getMediaPdfPageDataUrl,
  getMediaReaderDescriptor,
  searchMediaItems,
  uploadMediaItem,
} from "@/lib/media";
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

export async function getMediaReaderDescriptorAction(mediaItemId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return getMediaReaderDescriptor(identity, mediaItemId);
}

export async function getMediaImageDataUrlAction(mediaItemId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return getMediaImageDataUrl(identity, mediaItemId);
}

export async function getMediaPdfPageDataUrlAction(mediaItemId: string, pageNumber: number) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return getMediaPdfPageDataUrl(identity, mediaItemId, pageNumber);
}
