const API_BASE = "https://libtools2.smith.edu/course-reserves/backend/web/tracking";

export const trackingService = {
  async trackEvent(eventData) {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to track event: ${errorText}`);
    }
    return response.json();
  },
};
