"use server";

import { headers } from "next/headers";

import {
  buildSocialHubBootstrap,
  connectSocialHubTablePerson,
  sendSocialHubPrivateMessage,
  sendSocialHubTableMessage,
  selectSocialHubGroupTopic,
  setSocialHubTopic,
} from "@/lib/social-hub";
import { requireIdentityHeaders } from "@/lib/request-auth";

export async function getSocialHubBootstrap(topicId?: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return buildSocialHubBootstrap(identity, topicId);
}

export async function setSocialHubTopicAction(topicId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return setSocialHubTopic(identity, topicId);
}

export async function selectSocialHubGroupTopicAction(topicId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);
  return selectSocialHubGroupTopic(identity, topicId);
}

export async function sendSocialHubPrivateMessageAction(contactUserId: string, text: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);

  return sendSocialHubPrivateMessage(identity, contactUserId, text);
}

export async function sendSocialHubTableMessageAction(topicId: string, text: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);

  return sendSocialHubTableMessage(identity, topicId, text);
}

export async function connectSocialHubTablePersonAction(contactUserId: string) {
  const requestHeaders = await headers();
  const identity = requireIdentityHeaders(requestHeaders);

  return connectSocialHubTablePerson(identity, contactUserId);
}
