import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSubmit: (message: string) => Promise<void>;
  onCancel: () => void;
}

export default function ReplyForm({ onSubmit, onCancel }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      return;
    }

    setSending(true);
    try {
      await onSubmit(message);
      setMessage('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your reply..."
        rows={3}
        disabled={sending}
      />
      <div className="flex items-center gap-2 justify-end">
        <Button 
          type="button" 
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={sending}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          size="sm"
          disabled={sending || !message.trim()}
        >
          {sending ? 'Sending...' : 'Send Reply'}
        </Button>
      </div>
    </form>
  );
}
