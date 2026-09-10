import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ItemData {
  id?: string;
  materialType: string;
  title: string;
  author: string;
  citation: string;
  sourceLink: string;
  requestType: string;
  neededBy?: Date;
  publicNote: string;
}

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ItemData) => void;
  initialData?: ItemData;
}

export const ItemDrawer = ({ open, onOpenChange, onSave, initialData }: ItemDrawerProps) => {
  const [formData, setFormData] = useState<ItemData>(
    initialData || {
      materialType: "",
      title: "",
      author: "",
      citation: "",
      sourceLink: "",
      requestType: "",
      publicNote: "",
    }
  );

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!formData.materialType) {
      toast.error("Please select a material type");
      return;
    }
    if (!formData.requestType) {
      toast.error("Please select a request type");
      return;
    }

    onSave(formData);
    onOpenChange(false);
    toast.success("Item saved successfully");
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initialData ? "Edit Item" : "Add Item"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="materialType">
              Material Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.materialType}
              onValueChange={(value) => setFormData({ ...formData, materialType: value })}
            >
              <SelectTrigger id="materialType">
                <SelectValue placeholder="Select material type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="book">Book</SelectItem>
                <SelectItem value="chapter">Chapter</SelectItem>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="streaming-video">Streaming Video</SelectItem>
                <SelectItem value="dvd">DVD Digitization</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author/Creator</Label>
            <Input
              id="author"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              placeholder="Enter author or creator name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="citation">Citation Text</Label>
            <Textarea
              id="citation"
              value={formData.citation}
              onChange={(e) => setFormData({ ...formData, citation: e.target.value })}
              placeholder="Paste full citation here"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceLink">Source Link/URL</Label>
            <Input
              id="sourceLink"
              type="url"
              value={formData.sourceLink}
              onChange={(e) => setFormData({ ...formData, sourceLink: e.target.value })}
              placeholder="https://"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Request Type <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={formData.requestType}
              onValueChange={(value) => setFormData({ ...formData, requestType: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="link-physical" id="link-physical" />
                <Label htmlFor="link-physical" className="font-normal">
                  Link owned physical
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="link-electronic" id="link-electronic" />
                <Label htmlFor="link-electronic" className="font-normal">
                  Link owned electronic
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="order" id="order" />
                <Label htmlFor="order" className="font-normal">
                  Order
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="streaming" id="streaming" />
                <Label htmlFor="streaming" className="font-normal">
                  Streaming request
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="digitize" id="digitize" />
                <Label htmlFor="digitize" className="font-normal">
                  Digitize
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Needed By Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.neededBy && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.neededBy ? format(formData.neededBy, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.neededBy}
                  onSelect={(date) => setFormData({ ...formData, neededBy: date })}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="publicNote">Public Note</Label>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <Textarea
              id="publicNote"
              value={formData.publicNote}
              onChange={(e) => setFormData({ ...formData, publicNote: e.target.value })}
              placeholder="Add notes visible to library staff and faculty"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>File Upload</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload syllabus excerpt or citation PDF
              </p>
              <p className="text-xs text-muted-foreground mt-1">Max file size: 10MB</p>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Item</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
