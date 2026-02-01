import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

export interface ChatThread {
  threadId: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMessage {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface ThreadPreviewResponse {
  threadId: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

class ChatService {
  private getHeaders(token: string) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async createThread(token: string, otherUserId: string): Promise<ChatThread> {
    const response = await axios.post<ChatThread>(
      `${API_BASE_URL}/api/chat/threads`,
      { otherUserId },
      this.getHeaders(token)
    );
    return response.data;
  }

  async getThreads(token: string): Promise<ThreadPreviewResponse[]> {
    const response = await axios.get<ThreadPreviewResponse[]>(
      `${API_BASE_URL}/api/chat/threads`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async getMessages(token: string, threadId: string, limit: number = 50): Promise<ChatMessage[]> {
    const response = await axios.get<ChatMessage[]>(
      `${API_BASE_URL}/api/chat/threads/${threadId}/messages?limit=${limit}`,
      this.getHeaders(token)
    );
    return response.data;
  }

  async sendMessage(token: string, threadId: string, content: string): Promise<ChatMessage> {
    const response = await axios.post<ChatMessage>(
      `${API_BASE_URL}/api/chat/threads/${threadId}/messages`,
      { content },
      this.getHeaders(token)
    );
    return response.data;
  }

  async markThreadAsRead(token: string, threadId: string): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/api/chat/threads/${threadId}/mark-read`,
      {},
      this.getHeaders(token)
    );
  }
}

export const chatService = new ChatService();
