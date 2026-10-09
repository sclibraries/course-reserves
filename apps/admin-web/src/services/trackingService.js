import apiClient from './apiClient';

const TRACKING_PATH = `${import.meta.env.VITE_COURSE_RESERVES_PATH ?? '/course-reserves/backend/web'}/tracking`;

export const trackingService = {
  async trackEvent(eventData) {
    const { data } = await apiClient.post(TRACKING_PATH, eventData);
    return data;
  },
};
