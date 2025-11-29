import { apiClient } from './api.config';
import { ApiResponse } from '../../types';

export interface ConversationSummary {
  id: number;
  property_id?: number;
  property_title?: string;
  last_message_id?: number;
  last_message_text?: string;
  last_message_created_at?: string;
  last_message_sender_id?: number;
  unread_count: number;
  created_at: string;
  updated_at: string;
  other_user_id?: number;
  other_user_first_name?: string;
  other_user_last_name?: string;
  other_user_email?: string;
  other_user_phone?: string;
  other_user_profile_image?: string;
  participant_archived_at?: string | null;
  is_archived?: boolean;
}

export interface MessageItem {
  id: number;
  message: string;
  sender_id: number;
  recipient_id?: number | null;
  created_at: string;
  is_read: boolean;
  sender_first_name?: string;
  sender_last_name?: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
}

export async function getConversations() {
  const { data } = await apiClient.get<ApiResponse<{ conversations: ConversationSummary[] }>>('/messages/conversations');
  return data.data?.conversations ?? [];
}

export async function getArchivedConversations() {
  const { data } = await apiClient.get<ApiResponse<{ conversations: ConversationSummary[] }>>('/messages/conversations/archived');
  return data.data?.conversations ?? [];
}

export async function createConversation(payload: { participant_ids: number[]; property_id?: number; booking_id?: number; }) {
  const { data } = await apiClient.post<ApiResponse<{ conversation_id: number }>>('/messages/conversations', payload);
  return data.data?.conversation_id;
}

export async function getMessages(conversationId: number) {
  const { data } = await apiClient.get<ApiResponse<{ messages: MessageItem[] }>>(`/messages/conversations/${conversationId}/messages`);
  return data.data?.messages ?? [];
}

export async function sendMessage(conversationId: number, message: string) {
  const { data } = await apiClient.post<ApiResponse<{ message_id: number }>>(`/messages/conversations/${conversationId}/messages`, { message });
  return data.data?.message_id;
}

export async function markConversationRead(conversationId: number) {
  await apiClient.post<ApiResponse<unknown>>(`/messages/conversations/${conversationId}/read`, {});
}

export async function archiveConversation(conversationId: number) {
  await apiClient.post<ApiResponse<unknown>>(`/messages/conversations/${conversationId}/archive`, {});
}

export async function unarchiveConversation(conversationId: number) {
  await apiClient.post<ApiResponse<unknown>>(`/messages/conversations/${conversationId}/unarchive`, {});
}
