import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemData } from "../index";

interface FieldsProps {
  formData: ItemData;
  setFormData: (data: ItemData) => void;
}

export default function BookFields({ formData, setFormData }: FieldsProps) {
  return (
    <>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="publisher">Publisher</Label>
          <Input
            id="publisher"
            value={formData.publisher || ""}
            onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
            placeholder="Publisher name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="publicationYear">Year</Label>
          <Input
            id="publicationYear"
            value={formData.publicationYear || ""}
            onChange={(e) => setFormData({ ...formData, publicationYear: e.target.value })}
            placeholder="2024"
          />
        </div>
      </div>
    </>
  );
}
