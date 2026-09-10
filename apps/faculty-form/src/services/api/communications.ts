import apiClient from '@/services/apiClient';

const COURSE_RESERVES_BASE = `${import.meta.env.VITE_COURSE_RESERVES_PATH ?? '/course-reserves/backend/web'}`;

/** Returns the base path for all communications on a given submission. */
function submissionPath(uuid: string): string {
  return `${COURSE_RESERVES_BASE}/faculty-submission/${uuid}/communications`;
}

export interface Message {
  id: number;
  resource_id: number | null;
  subject: string | null;
  message: string;
  category: 'question' | 'issue' | 'update' | 'note';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'active' | 'resolved' | 'archived';
  sender_name: string;
  sender_type: 'faculty' | 'staff';
  created_at: string;
  is_read: boolean;
  reply_count: number;
  replies: Reply[];
}

export interface Reply {
  id: number;
  message: string;
  sender_name: string;
  sender_type: 'faculty' | 'staff';
  created_at: string;
}

export interface CreateMessageRequest {
  message: string;
  subject?: string;
  category?: 'question' | 'issue' | 'update' | 'note';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  resource_id?: number;
  parent_message_id?: number;
}

export interface UpdateMessageRequest {
  message?: string;
  subject?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'active' | 'resolved' | 'archived';
}

export class CommunicationsAPI {
  /**
   * Get all messages for a submission
   */
  async getMessages(submissionUuid: string): Promise<Message[]> {
    const { data } = await apiClient.get(submissionPath(submissionUuid));
    return data.messages ?? [];
  }

  /**
   * Create a new message or reply
   */
  async createMessage(
    submissionUuid: string,
    payload: CreateMessageRequest
  ): Promise<{ success: boolean; message_id: number; message: string }> {
    const { data } = await apiClient.post(submissionPath(submissionUuid), payload);
    return data;
  }

  /**
   * Update an existing message
   */
  async updateMessage(
    submissionUuid: string,
    messageId: number,
    payload: UpdateMessageRequest
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.put(`${submissionPath(submissionUuid)}/${messageId}`, payload);
    return data;
  }

  /**
   * Delete a message (soft delete - archives it)
   */
  async deleteMessage(
    submissionUuid: string,
    messageId: number
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`${submissionPath(submissionUuid)}/${messageId}`);
    return data;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(
    submissionUuid: string,
    messageId: number
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post(`${submissionPath(submissionUuid)}/${messageId}/read`);
    return data;
  }
}
