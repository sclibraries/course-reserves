import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ItemForm from './ItemForm';
import { createEmptyItemData, type ItemData } from './itemFormData';
import { saveValidatedItem } from '@/utils/saveValidatedItem';

export type { ItemData } from './itemFormData';

interface ItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ItemData) => void;
  initialData?: ItemData;
  showSuccessToast?: boolean;
}

export const ItemModal = ({ open, onOpenChange, onSave, initialData, showSuccessToast = true }: ItemModalProps) => {
  const [formData, setFormData] = useState<ItemData>(createEmptyItemData);

  useEffect(() => {
    setFormData(initialData ? withInitialItemData(initialData) : createEmptyItemData());
  }, [initialData, open]);

  const handleSave = () => {
    if (!saveValidatedItem(formData, onSave)) return;
    onOpenChange(false);
    if (showSuccessToast) toast.success('Item saved successfully');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-4xl">
        <DialogHeader><DialogTitle>{initialData ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
        <ItemForm formData={formData} setFormData={setFormData} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function withInitialItemData(item: ItemData): ItemData {
  return {
    ...createEmptyItemData(),
    ...item,
    materialType: item.materialType || '',
    title: item.title || '',
    author: item.author || '',
    citation: item.citation || '',
    sourceLink: item.sourceLink || '',
    requestType: item.requestType || 'link-electronic',
    publicNote: item.publicNote || '',
    hasAttachment: item.hasAttachment || false,
    isbn: item.isbn || '',
    doi: item.doi || '',
    pages: item.pages || '',
    edition: item.edition || '',
    publisher: item.publisher || '',
    publicationYear: item.publicationYear || '',
    journal: item.journal || '',
    volume: item.volume || '',
    issue: item.issue || '',
  };
}
