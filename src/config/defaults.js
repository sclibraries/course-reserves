export const defaults = {
    api: {
      baseUrl: 'https://libtools2.smith.edu',
      endpoints: {
        courseReserves: '/course-reserves/backend/web',
        auth:"/course-reserves/backend/admin",
        folio: '/folio/web',
      },
      timeout: 30000,
    },
    app: {
      name: 'Course Reserves',
      itemsPerPage: 20,
    }
  };