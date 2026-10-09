import { defaults } from './defaults';

export const appConfig = {
  name: import.meta.env.VITE_APP_NAME || defaults.app.name,
  defaultCollege: import.meta.env.VITE_APP_DEFAULT_COLLEGE || defaults.app.defaultCollege,
  itemsPerPage: parseInt(import.meta.env.VITE_APP_ITEMS_PER_PAGE || defaults.app.itemsPerPage),
};