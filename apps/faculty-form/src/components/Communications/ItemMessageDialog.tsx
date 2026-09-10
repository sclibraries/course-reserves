import { useState } from 'react';
import { CreateMessageRequest } from '@/services/api/communications';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare } from 'lucide-react';

interface Props {
  itemTitle: string;
  itemId: string;
  resourceId?: number;
  onSubmit: (data: CreateMessageRequest) => Promise<void>;
  trigger?: React.ReactNode;
}

export default function ItemMessageDialog({ itemTitle, itemId, resourceId, onSubmit, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CreateMessageRequest>({
    message: '',
    subject: `Question about: ${itemTitle}`,
    category: 'question',
    priority: 'normal',
    resource_id: resourceId,
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.message.trim()) {
      alert('Message cannot be empty');
      return;
    }

    setSending(true);
    try {
      await onSubmit({
        ...formData,
        resource_id: resourceId,
      });
      setFormData({
        message: '',
        subject: `Question about: ${itemTitle}`,
        category: 'question',
        priority: 'normal',
        resource_id: resourceId,
      });
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Send Message About Item</DialogTitle>
          <DialogDescription>
            Send a message to library staff about <strong>"{itemTitle}"</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-subject">Subject</Label>
            <input
              id="item-subject"
              type="text"
              className="w-full px-3 py-2 border border-input rounded-md"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Subject line for your message"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: 'question' | 'issue' | 'update' | 'note') => 
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="item-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="issue">Issue</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'normal' | 'high' | 'urgent') => 
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger id="item-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-message">Message *</Label>
            <Textarea
              id="item-message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Type your message here..."
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              This message will be linked to the item: <strong>{itemTitle}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 justify-end pt-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={sending || !formData.message.trim()}
            >
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
