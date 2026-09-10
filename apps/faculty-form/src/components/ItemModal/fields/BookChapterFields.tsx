import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemData } from "../index";

interface FieldsProps {
  formData: ItemData;
  setFormData: (data: ItemData) => void;
}

export default function BookChapterFields({ formData, setFormData }: FieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="pages">Chapter/Pages</Label>
        <Input
          id="pages"
          value={formData.pages || ""}
          onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
          placeholder="e.g., Chapter 3, pp. 45-67"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="isbn">ISBN</Label>
          <Input
            id="isbn"
            value={formData.isbn || ""}
            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
            placeholder="978-0-123456-78-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edition">Edition</Label>
          <Input
            id="edition"
            value={formData.edition || ""}
            onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
            placeholder="e.g., 4th"
          />
        </div>
      </div>
    </>
  );
}
