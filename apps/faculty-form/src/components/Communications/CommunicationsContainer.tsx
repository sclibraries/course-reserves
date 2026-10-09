import { useEffect, useState } from 'react';
import { CommunicationsAPI, Message, CreateMessageRequest } from '@/services/api/communications';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import MessageFilters from './MessageFilters';
import { Loader2 } from 'lucide-react';

interface Props {
  submissionUuid: string;
}

export default function CommunicationsContainer({ submissionUuid }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    priority?: string;
    status?: string;
    category?: string;
  }>({});

  const api = new CommunicationsAPI();

  const loadMessages = async (silent = false) => {
    try {
      // Only show loading spinner on initial load
      if (!silent) {
        setLoading(true);
      }
      
      const data = await api.getMessages(submissionUuid);
      
      // Only update if data has actually changed (prevents flashing)
      setMessages(prevMessages => {
        const hasChanged = JSON.stringify(prevMessages) !== JSON.stringify(data);
        return hasChanged ? data : prevMessages;
      });
      
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial load with loading indicator
    loadMessages(false);
    
    // Poll for new messages every 30 seconds (silent updates)
    const interval = setInterval(() => loadMessages(true), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionUuid]);

  const handleCreateMessage = async (data: CreateMessageRequest) => {
    try {
      await api.createMessage(submissionUuid, data);
      await loadMessages(true); // Refresh list silently
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      alert(errorMessage);
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      await api.markAsRead(submissionUuid, messageId);
      // Update local state optimistically
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleUpdateMessage = async (messageId: number, status: 'resolved') => {
    try {
      await api.updateMessage(submissionUuid, messageId, { status });
      await loadMessages(true); // Refresh list silently
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update message';
      alert(errorMessage);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter.priority && msg.priority !== filter.priority) return false;
    if (filter.status && msg.status !== filter.status) return false;
    if (filter.category && msg.category !== filter.category) return false;
    return true;
  });

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Messages 
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </h3>
        <MessageComposer 
          onSubmit={handleCreateMessage}
          submissionUuid={submissionUuid}
        />
      </div>

      <MessageFilters 
        filter={filter}
        onFilterChange={setFilter}
      />

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {error && (
        <div className="text-center py-8 text-destructive">
          {error}
        </div>
      )}
      
      {!loading && !error && (
        <MessageList 
          messages={filteredMessages}
          onMarkAsRead={handleMarkAsRead}
          onReply={handleCreateMessage}
          onResolve={handleUpdateMessage}
        />
      )}
    </div>
  );
}
