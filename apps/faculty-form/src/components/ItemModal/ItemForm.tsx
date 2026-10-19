import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MATERIAL_FIELDS } from './fields';
import type { ItemData, ItemFormProps } from './itemFormData';

export type { ItemData, ItemFormProps } from './itemFormData';

export default function ItemForm({ formData, setFormData }: ItemFormProps) {
  const update = (updates: Partial<ItemData>) => setFormData({ ...formData, ...updates });
  const FieldsComponent = MATERIAL_FIELDS[formData.materialType];

  return (
    <ScrollArea className="max-h-[calc(95vh-140px)] pr-4">
      <div className="grid grid-cols-1 gap-6 py-4 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="border-b pb-2 text-lg font-semibold">Basic Information</h3>
          <div className="space-y-2">
            <Label htmlFor="materialType">Material Type <span className="text-destructive">*</span></Label>
            <Select value={formData.materialType} onValueChange={(value) => update({ materialType: value })}>
              <SelectTrigger id="materialType"><SelectValue placeholder="Select material type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Book">Book</SelectItem>
                <SelectItem value="Book Chapter">Book Chapter</SelectItem>
                <SelectItem value="Journal Article">Journal Article</SelectItem>
                <SelectItem value="Article">Article</SelectItem>
                <SelectItem value="Research Paper">Research Paper</SelectItem>
                <SelectItem value="Video">Video</SelectItem>
                <SelectItem value="Video Lecture">Video Lecture</SelectItem>
                <SelectItem value="Streaming Video">Streaming Video</SelectItem>
                <SelectItem value="DVD Digitization">DVD Digitization</SelectItem>
                <SelectItem value="Website">Website/Web Page</SelectItem>
                <SelectItem value="Problem Set">Problem Set</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" value={formData.title} onChange={(event) => update({ title: event.target.value })} placeholder="Enter title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Author/Creator</Label>
            <Input id="author" value={formData.author} onChange={(event) => update({ author: event.target.value })} placeholder="Enter author or creator name" />
          </div>
          {FieldsComponent && <FieldsComponent formData={formData} setFormData={setFormData} />}
        </div>

        <div className="space-y-4">
          <h3 className="border-b pb-2 text-lg font-semibold">Additional Information</h3>
          <div className="space-y-2">
            <Label htmlFor="sourceLink">Source Link/URL</Label>
            <Input id="sourceLink" type="url" value={formData.sourceLink} onChange={(event) => update({ sourceLink: event.target.value })} placeholder="https://" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="citation">Full Citation</Label>
            <Textarea id="citation" value={formData.citation} onChange={(event) => update({ citation: event.target.value })} placeholder="Paste or enter the full citation here" rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Display Dates (optional)</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateField label="Display from" id="displayStart" date={formData.displayStartDate} onChange={(date) => update({ displayStartDate: date })} />
              <DateField label="Expires on" id="displayEnd" date={formData.displayEndDate} onChange={(date) => update({ displayEndDate: date })} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Label htmlFor="publicNote">Notes for Library Staff</Label><Info className="h-4 w-4 text-muted-foreground" /></div>
            <Textarea id="publicNote" value={formData.publicNote} onChange={(event) => update({ publicNote: event.target.value })} placeholder="Add any special instructions, preferences, or clarifications" rows={3} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function DateField({ label, id, date, onChange }: { label: string; id: string; date?: Date; onChange: (date?: Date) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, 'PPP') : `Select ${id === 'displayStart' ? 'start' : 'end'} date`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={(selected) => onChange(selected || undefined)} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}
