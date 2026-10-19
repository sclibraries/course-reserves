import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ItemForm from '@/components/ItemModal/ItemForm';
import { createEmptyItemData, type ItemData } from '@/components/ItemModal/itemFormData';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { saveValidatedItem } from '@/utils/saveValidatedItem';

export default function TypeTab() {
  const { itemHandlers } = useSubmissionEditorContext();
  const [formData, setFormData] = useState<ItemData>(createEmptyItemData);
  const save = () => {
    const handleSave = itemHandlers.handleSaveItem as (item: ItemData) => void | boolean;
    if (saveValidatedItem(formData, handleSave)) setFormData(createEmptyItemData());
  };

  return (
    <section aria-label="Type it in" className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Type it in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter material details that are not in the library search.</p>
      </div>
      <ItemForm formData={formData} setFormData={setFormData} />
      <div className="flex justify-end border-t pt-4">
        <Button onClick={save}>Add item</Button>
      </div>
    </section>
  );
}
