"use server";

import { headers } from "next/headers";

import { buildMessagingBootstrap, sendChatMessage } from "@/lib/messaging";
import { requireIdentityHeaders } from "@/lib/request-auth";

export async function getMessagingBootstrap() {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return buildMessagingBootstrap(identity);
}

export async function sendMessageAction(contactUserId: string, text: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);

  return sendChatMessage(identity, contactUserId, text);
}
