import { config } from '../../config'

const COURSE_API = config.api.urls.courseReserves;
const getAuthToken = config.api.getAuthToken;

export const adminCustomizationService = {
    async getCustomization() {
        const response = await fetch(`${COURSE_API}${config.api.endpoints.customizations.getCustomizations}`)
        if (!response.ok) {
            throw new Error('Error fetching customization data.');
        }
        return response.json();
    }, 
    async updateCustomization(id, customizationData) {
        const response = await fetch(`${COURSE_API}${config.api.endpoints.customizations.updateCustomizations}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${getAuthToken()}`,
            },
            body: JSON.stringify(customizationData)
        });
        
        if (!response.ok) {
            throw new Error('Error updating customization data.');
        }
        
        return response.json();
    },
    async updateCustomizationSection(id, sectionData) {
        const response = await fetch(`${COURSE_API}${config.api.endpoints.customizations.updateCustomizations}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${getAuthToken()}`,
            },
            body: JSON.stringify(sectionData)
        });
        
        if (!response.ok) {
            throw new Error('Error updating customization section.');
        }
        
        return response.json();
    }
}
