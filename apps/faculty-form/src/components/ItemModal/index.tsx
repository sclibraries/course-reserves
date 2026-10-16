import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MATERIAL_FIELDS } from './fields';
import { validateReserveItem } from "@/utils/reserveValidation";

export interface ItemData {
  id?: string;
  materialType: string;
  title: string;
  author: string;
  citation: string;
  sourceLink: string;
  requestType: string;
  // Optional display window for when the item should be visible to students
  displayStartDate?: Date;
  displayEndDate?: Date;
  publicNote: string;
  // Optional attachment metadata (no file contents stored)
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
  // Material-specific fields
  isbn?: string;
  doi?: string;
  pages?: string;
  edition?: string;
  publisher?: string;
  publicationYear?: string;
  journal?: string;
  volume?: string;
  issue?: string;
}

interface ItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ItemData) => void;
  initialData?: ItemData;
  showSuccessToast?: boolean;
}

export const ItemModal = ({ open, onOpenChange, onSave, initialData, showSuccessToast = true }: ItemModalProps) => {
  const [formData, setFormData] = useState<ItemData>({
    materialType: "",
    title: "",
    author: "",
    citation: "",
    sourceLink: "",
    requestType: "link-electronic", // Default to most common
    displayStartDate: undefined,
    displayEndDate: undefined,
    publicNote: "",
    hasAttachment: false,
    attachmentName: undefined,
    attachmentSize: undefined,
    attachmentType: undefined,
    isbn: "",
    doi: "",
    pages: "",
    edition: "",
    publisher: "",
    publicationYear: "",
    journal: "",
    volume: "",
    issue: "",
  });

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        materialType: initialData.materialType || "",
        title: initialData.title || "",
        author: initialData.author || "",
        citation: initialData.citation || "",
        sourceLink: initialData.sourceLink || "",
        requestType: initialData.requestType || "link-electronic",
        publicNote: initialData.publicNote || "",
        displayStartDate: initialData.displayStartDate,
        displayEndDate: initialData.displayEndDate,
        hasAttachment: initialData.hasAttachment || false,
        attachmentName: initialData.attachmentName,
        attachmentSize: initialData.attachmentSize,
        attachmentType: initialData.attachmentType,
        isbn: initialData.isbn || "",
        doi: initialData.doi || "",
        pages: initialData.pages || "",
        edition: initialData.edition || "",
        publisher: initialData.publisher || "",
        publicationYear: initialData.publicationYear || "",
        journal: initialData.journal || "",
        volume: initialData.volume || "",
        issue: initialData.issue || "",
      });
    } else {
      setFormData({
        materialType: "",
        title: "",
        author: "",
        citation: "",
        sourceLink: "",
        requestType: "link-electronic",
        displayStartDate: undefined,
        displayEndDate: undefined,
        publicNote: "",
        hasAttachment: false,
        attachmentName: undefined,
        attachmentSize: undefined,
        attachmentType: undefined,
        isbn: "",
        doi: "",
        pages: "",
        edition: "",
        publisher: "",
        publicationYear: "",
        journal: "",
        volume: "",
        issue: "",
      });
    }
  }, [initialData, open]); // Also depend on open to reset when modal opens

  const handleSave = () => {
    const validation = validateReserveItem(formData);

    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    onSave(formData);
    onOpenChange(false);
    if (showSuccessToast) toast.success("Item saved successfully");
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const FieldsComponent = MATERIAL_FIELDS[formData.materialType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(95vh-140px)] pr-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
            {/* Left Column - Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
              
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

              {/* Material-specific fields */}
              {FieldsComponent && (
                <FieldsComponent formData={formData} setFormData={setFormData} />
              )}
            </div>

            {/* Right Column - Additional Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
              
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
                <Label htmlFor="citation">Full Citation</Label>
                <Textarea
                  id="citation"
                  value={formData.citation}
                  onChange={(e) => setFormData({ ...formData, citation: e.target.value })}
                  placeholder="Paste or enter the full citation here"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Display Dates (optional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="displayStart">Display from</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="displayStart"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.displayStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.displayStartDate ? format(formData.displayStartDate, "PPP") : "Select start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.displayStartDate}
                          onSelect={(date) => setFormData({ ...formData, displayStartDate: date || undefined })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="displayEnd">Expires on</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="displayEnd"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.displayEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.displayEndDate ? format(formData.displayEndDate, "PPP") : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.displayEndDate}
                          onSelect={(date) => setFormData({ ...formData, displayEndDate: date || undefined })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="publicNote">Notes for Library Staff</Label>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                  id="publicNote"
                  value={formData.publicNote}
                  onChange={(e) => setFormData({ ...formData, publicNote: e.target.value })}
                  placeholder="Add any special instructions, preferences, or clarifications"
                  rows={3}
                />
              </div>

            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
