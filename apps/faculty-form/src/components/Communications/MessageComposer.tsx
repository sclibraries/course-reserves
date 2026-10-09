import { useState } from 'react';
import { CreateMessageRequest } from '@/services/api/communications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { MessageSquarePlus } from 'lucide-react';

interface Props {
  onSubmit: (data: CreateMessageRequest) => Promise<void>;
  submissionUuid: string;
}

export default function MessageComposer({ onSubmit }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CreateMessageRequest>({
    message: '',
    subject: '',
    category: 'question',
    priority: 'normal',
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
      await onSubmit(formData);
      setFormData({
        message: '',
        subject: '',
        category: 'question',
        priority: 'normal',
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
        <Button size="sm">
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Message to Staff</DialogTitle>
          <DialogDescription>
            Send a message to library staff about this course reserve.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="What is this about?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: 'question' | 'issue' | 'update' | 'note') => 
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="category">
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
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'normal' | 'high' | 'urgent') => 
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger id="priority">
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
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Type your message here..."
              rows={5}
              required
            />
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
