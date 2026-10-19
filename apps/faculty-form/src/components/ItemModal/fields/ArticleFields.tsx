import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemData } from "../itemFormData";

interface FieldsProps {
  formData: ItemData;
  setFormData: (data: ItemData) => void;
}

export default function ArticleFields({ formData, setFormData }: FieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="journal">Journal Name</Label>
        <Input
          id="journal"
          value={formData.journal || ""}
          onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
          placeholder="Journal name"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="volume">Volume</Label>
          <Input
            id="volume"
            value={formData.volume || ""}
            onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
            placeholder="Vol. 15"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issue">Issue</Label>
          <Input
            id="issue"
            value={formData.issue || ""}
            onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
            placeholder="No. 3"
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
      <div className="space-y-2">
        <Label htmlFor="doi">DOI</Label>
        <Input
          id="doi"
          value={formData.doi || ""}
          onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
          placeholder="10.1000/182"
        />
      </div>
    </>
  );
}
