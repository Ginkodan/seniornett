import { buildChatBootstrap, sendChatMessage, type ChatContact } from "@/lib/chat-core";
import {
  buildTableChatBootstrap,
  hopToPrivateChat,
  sendTableChatMessage,
  setTableChatTopic,
  type TableChatMessage,
  type TableChatPerson,
  type TableChatTopic,
} from "@/lib/table-chat";
import type { RequestIdentity } from "@/lib/request-auth";

export type SocialHubBootstrap = {
  user: {
    id: string;
    name: string;
    role: string;
  };
  caretakers: ChatContact[];
  friends: ChatContact[];
  table: {
    topics: TableChatTopic[];
    joinedTopicIds: string[];
    currentTopic: TableChatTopic;
    people: TableChatPerson[];
    messages: TableChatMessage[];
  };
};

export async function buildSocialHubBootstrap(
  identity: RequestIdentity,
  topicId?: string | null
): Promise<SocialHubBootstrap> {
  const chat = await buildChatBootstrap(identity);
  const tableChat = await buildTableChatBootstrap(identity, topicId);

  return {
    user: chat.user,
    caretakers: chat.contacts.filter((contact) => contact.role === "caregiver"),
    friends: chat.contacts.filter((contact) => contact.role !== "caregiver"),
    table: {
      topics: tableChat.topics,
      joinedTopicIds: tableChat.joinedTopicIds,
      currentTopic: tableChat.currentTopic,
      people: tableChat.people,
      messages: tableChat.messages,
    },
  };
}

export async function setSocialHubTopic(
  identity: RequestIdentity,
  topicId: string
): Promise<SocialHubBootstrap> {
  await setTableChatTopic(identity, topicId);
  return buildSocialHubBootstrap(identity, topicId);
}

export async function selectSocialHubGroupTopic(
  identity: RequestIdentity,
  topicId: string
): Promise<SocialHubBootstrap> {
  return buildSocialHubBootstrap(identity, topicId);
}

export async function sendSocialHubPrivateMessage(
  identity: RequestIdentity,
  contactUserId: string,
  text: string
) {
  return sendChatMessage(identity, contactUserId, text);
}

export async function sendSocialHubTableMessage(identity: RequestIdentity, topicId: string, text: string) {
  return sendTableChatMessage(identity, topicId, text);
}

export async function connectSocialHubTablePerson(
  identity: RequestIdentity,
  contactUserId: string
): Promise<SocialHubBootstrap> {
  await hopToPrivateChat(identity, contactUserId);
  return buildSocialHubBootstrap(identity);
}
