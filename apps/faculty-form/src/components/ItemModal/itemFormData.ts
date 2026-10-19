export interface ItemData {
  id?: string;
  materialType: string;
  title: string;
  author: string;
  citation: string;
  sourceLink: string;
  requestType: string;
  displayStartDate?: Date;
  displayEndDate?: Date;
  publicNote: string;
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
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

export interface ItemFormProps {
  formData: ItemData;
  setFormData: (data: ItemData) => void;
}

export function createEmptyItemData(): ItemData {
  return {
    materialType: '', title: '', author: '', citation: '', sourceLink: '',
    requestType: 'link-electronic', publicNote: '', hasAttachment: false,
    isbn: '', doi: '', pages: '', edition: '', publisher: '', publicationYear: '',
    journal: '', volume: '', issue: '',
  };
}
