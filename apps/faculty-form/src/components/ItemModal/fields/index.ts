import type { ItemData } from '../itemFormData';
import type React from 'react';
import BookFields from './BookFields';
import BookChapterFields from './BookChapterFields';
import ArticleFields from './ArticleFields';

export interface FieldsProps {
  formData: ItemData;
  setFormData: (data: ItemData) => void;
}

export type FieldsComponent = React.ComponentType<FieldsProps>;

export const MATERIAL_FIELDS: Record<string, FieldsComponent> = {
  "Book": BookFields,
  "Book Chapter": BookChapterFields,
  "Journal Article": ArticleFields,
  "Article": ArticleFields,
  "Research Paper": ArticleFields,
};
