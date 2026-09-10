import { Message, CreateMessageRequest } from '@/services/api/communications';
import MessageCard from './MessageCard';

interface Props {
  messages: Message[];
  onMarkAsRead: (messageId: number) => void;
  onReply: (data: CreateMessageRequest) => void;
  onResolve: (messageId: number, status: 'resolved') => void;
}

export default function MessageList({ messages, onMarkAsRead, onReply, onResolve }: Props) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No messages yet. Start a conversation with staff!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map(message => (
        <MessageCard
          key={message.id}
          message={message}
          onMarkAsRead={onMarkAsRead}
          onReply={onReply}
          onResolve={onResolve}
        />
      ))}
    </div>
  );
}
