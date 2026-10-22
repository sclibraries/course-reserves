import { useId, useState } from 'react';
import { Message, CreateMessageRequest } from '@/services/api/communications';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, CheckCircle2, AlertCircle, Info, FileText } from 'lucide-react';
import ReplyForm from './ReplyForm';

interface Props {
  message: Message;
  onMarkAsRead: (messageId: number) => void;
  onReply: (data: CreateMessageRequest) => void;
  onResolve: (messageId: number, status: 'resolved') => void;
}

export default function MessageCard({ message, onMarkAsRead, onReply, onResolve }: Props) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const bodyId = useId();
  const subject = message.subject || 'No Subject';

  const priorityConfig = {
    low: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Low' },
    normal: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Normal' },
    high: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'High' },
    urgent: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Urgent' },
  };

  const categoryIcons = {
    question: <MessageSquare className="h-4 w-4" />,
    issue: <AlertCircle className="h-4 w-4" />,
    update: <Info className="h-4 w-4" />,
    note: <FileText className="h-4 w-4" />,
  };

  const handleToggleExpanded = () => {
    if (!message.is_read) {
      onMarkAsRead(message.id);
    }
    setIsExpanded(!isExpanded);
  };

  const handleReply = async (replyText: string) => {
    await onReply({
      message: replyText,
      parent_message_id: message.id,
    });
    setShowReplyForm(false);
  };

  return (
    <Card
      className={`transition-all ${
        !message.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''
      } ${message.status === 'resolved' ? 'opacity-70' : ''}`}
    >
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5" aria-hidden="true">
                {categoryIcons[message.category]}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h4 className="min-w-0 flex-1 font-semibold text-base">
                    <button
                      type="button"
                      className="min-w-0 whitespace-normal break-words rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={isExpanded}
                      aria-controls={bodyId}
                      onClick={handleToggleExpanded}
                    >
                      {subject}
                    </button>
                  </h4>
                  {!message.is_read && <Badge variant="destructive" className="text-xs">NEW</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">{message.sender_name}</span>
                  <span>•</span>
                  <span className="capitalize">({message.sender_type})</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>

            <div className="flex basis-full flex-wrap items-center gap-2 sm:basis-auto sm:justify-end">
              <Badge 
                variant="outline" 
                className={priorityConfig[message.priority].color}
              >
                {priorityConfig[message.priority].label}
              </Badge>
              <Badge 
                variant={message.status === 'active' ? 'default' : 'secondary'}
              >
                {message.status}
              </Badge>
            </div>
          </div>

          <p id={bodyId} className={`break-words text-sm ${isExpanded ? '' : 'line-clamp-2'}`}>
            {message.message}
          </p>
          {message.resource_id && (
            <div className="text-sm text-blue-600">
              📎 Related to Item #{message.resource_id}
            </div>
          )}

          {/* Replies Section */}
          {isExpanded && message.replies && message.replies.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <h5 className="text-sm font-semibold text-muted-foreground">
                Replies ({message.reply_count})
              </h5>
              {message.replies.map(reply => (
                <div key={reply.id} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm">{reply.message}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">{reply.sender_name}</span>
                    <span>•</span>
                    <span className="capitalize">({reply.sender_type})</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {isExpanded && (
            <div className="flex items-center gap-2 pt-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                Reply
              </Button>
              {message.status === 'active' && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => onResolve(message.id, 'resolved')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark as Resolved
                </Button>
              )}
            </div>
          )}

          {/* Reply Form */}
          {showReplyForm && (
            <ReplyForm
              onSubmit={handleReply}
              onCancel={() => setShowReplyForm(false)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
