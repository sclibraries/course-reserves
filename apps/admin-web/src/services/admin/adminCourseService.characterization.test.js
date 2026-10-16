import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer test-token',
};

let adminCourseService;
let config;
let getAuthTokenSpy;
let fetchMock;

beforeEach(async () => {
  ({ config } = await import('../../config'));
  getAuthTokenSpy = vi.spyOn(config.api, 'getAuthToken').mockReturnValue('Bearer test-token');
  ({ adminCourseService } = await import('./adminCourseService'));

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const result = { success: true, data: [{ id: 17 }] };

const requestCases = () => {
  const courseApi = config.api.urls.courseReserves;
  const folioApi = config.api.urls.folio;
  const course = { name: 'Synthetic Course', course_number: 'CR-101' };
  const offering = { offering_id: 41, course_id: 29 };
  const resource = { title: 'Synthetic resource', id: 52 };
  const formData = { title: 'Synthetic electronic resource', resource_type: 'electronic' };
  const folioData = { id: 'folio-resource-63' };
  const linkedResource = { resourceType: 'electronic', resource_id: 63, order: 2 };
  const physicalResource = { resourceType: 'physical', id: 64, order: 3 };
  const query = 'biology / access';
  const expectedJsonRequest = (method, body) => ({
    method,
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  return [
    {
      name: 'checkPermanentCourseExists',
      invoke: () => adminCourseService.checkPermanentCourseExists(course),
      url: `${courseApi}/course/check-course-exists`,
      init: expectedJsonRequest('POST', course),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'reactivateCourse',
      invoke: () => adminCourseService.reactivateCourse({ course_id: 29 }),
      url: `${courseApi}/course/reactivate-course`,
      init: expectedJsonRequest('POST', { params: { course_id: 29 } }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'searchResources',
      invoke: () => adminCourseService.searchResources(query),
      url: `${courseApi}/course/search-resources?search=biology%20%2F%20access`,
      init: { headers: { Authorization: 'Bearer test-token' } },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'checkCourseExists',
      invoke: () => adminCourseService.checkCourseExists('folio-course-71'),
      url: `${courseApi}/course/exists?folioCourseId=folio-course-71`,
      init: {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'createLocalCourse',
      invoke: () => adminCourseService.createLocalCourse({ course, offering }),
      url: `${courseApi}/course/create-from-folio`,
      init: expectedJsonRequest('POST', { course, offering }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'createFromFolio',
      invoke: () => adminCourseService.createFromFolio(course, offering),
      url: `${courseApi}/course/create-from-folio`,
      init: expectedJsonRequest('POST', { course, offering }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'fetchCourseResources',
      invoke: () => adminCourseService.fetchCourseResources(29),
      url: `${courseApi}/course/29/resources`,
      init: { method: 'GET', headers: { Authorization: 'Bearer test-token' } },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'searchEDS',
      invoke: () => adminCourseService.searchEDS(query),
      url: `${courseApi}/ebsco-search/search?query=biology%20%2F%20access`,
      init: { headers: { Authorization: 'Bearer test-token' } },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'createResource',
      invoke: () => adminCourseService.createResource(41, 29, formData, folioData),
      url: `${courseApi}/course/create-resource`,
      init: expectedJsonRequest('POST', {
        ...formData,
        courseId: 29,
        offering_id: 41,
        folioData,
      }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'linkCourses',
      invoke: () => adminCourseService.linkCourses(41, 42),
      url: `${courseApi}/offering-link`,
      init: expectedJsonRequest('POST', { offering_id: 41, linked_offering_id: 42 }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'unlinkCourses',
      invoke: () => adminCourseService.unlinkCourses(43),
      url: `${courseApi}/offering-link/43`,
      init: {
        method: 'DELETE',
        headers: authHeaders,
      },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'linkExistingResources',
      invoke: () => adminCourseService.linkExistingResources(41, 52),
      url: `${courseApi}/offering-link/link-existing-resources?offering_id=41&resource_id=52`,
      init: { headers: { Authorization: 'Bearer test-token' } },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'getLinkedCourses',
      invoke: () => adminCourseService.getLinkedCourses(41),
      url: `${courseApi}/offering-link/find-linked-offerings?offering_id=41`,
      init: undefined,
      expectedResult: result,
      sendsToken: false,
    },
    {
      name: 'getResourcesByCourse',
      invoke: () => adminCourseService.getResourcesByCourse(29),
      url: `${courseApi}/course/get-resources?courseListingId=29`,
      init: { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' } },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'deleteResourceLink',
      invoke: () => adminCourseService.deleteResourceLink(54),
      url: `${courseApi}/course/unlink-resource`,
      init: expectedJsonRequest('POST', { courseResourceId: 54 }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'updateResourceOrder',
      invoke: () => adminCourseService.updateResourceOrder(29, [
        { course_resource_id: 81, order: 1 },
        { course_resource_id: 82, order: 2 },
      ]),
      url: `${courseApi}/course/update-resource-order`,
      init: expectedJsonRequest('POST', {
        courseId: 29,
        resources: [
          { course_resource_id: 81, order: 1 },
          { course_resource_id: 82, order: 2 },
        ],
      }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'searchCoursesByQuery',
      invoke: () => adminCourseService.searchCoursesByQuery('**TST 101'),
      url: `${config.api.urls.folio}${config.api.endpoints.folioSearch.courses}?query=(name%3D%22TST%20101*%22%20or%20courseNumber%3D%22TST%20101*%22)`,
      init: undefined,
      responseJson: { data: result.data },
      expectedResult: result.data,
      sendsToken: false,
    },
    {
      name: 'searchFolioCourses',
      invoke: () => adminCourseService.searchFolioCourses(query),
      url: `${folioApi}/search/search-courses?query=biology%20%2F%20access`,
      init: { headers: { 'Content-Type': 'application/json' } },
      responseJson: { data: result.data },
      expectedResult: result.data,
      sendsToken: false,
    },
    {
      name: 'getFolioCourseId',
      invoke: () => adminCourseService.getFolioCourseId('uuid-85', 'A & B'),
      url: `${courseApi}/course/check-unique-id?uuid=uuid-85&section=A%20%26%20B`,
      init: undefined,
      expectedResult: result,
      sendsToken: false,
    },
    {
      name: 'getPhysicalResourceByExternalId',
      invoke: () => adminCourseService.getPhysicalResourceByExternalId('ext-91', 'offering-41'),
      url: `${courseApi}/physical-resource/by-external-id/ext-91?offering_id=offering-41`,
      init: {
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'getPhysicalResourceReferences',
      invoke: () => adminCourseService.getPhysicalResourceReferences(41),
      url: `${courseApi}/physical-resource/get-references?offering_id=41`,
      init: {
        method: 'GET',
        headers: authHeaders,
      },
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'cleanupPhysicalResourceReferences',
      invoke: () => adminCourseService.cleanupPhysicalResourceReferences(41, [91, 92]),
      url: `${courseApi}/physical-resource/cleanup-references`,
      init: expectedJsonRequest('POST', { offering_id: 41, folio_resource_ids: [91, 92] }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'updatePhysicalResourceOrder',
      invoke: () => adminCourseService.updatePhysicalResourceOrder(41, [resource]),
      url: `${courseApi}/physical-resource/update-resource-order`,
      init: expectedJsonRequest('POST', { offering_id: 41, resources: [resource] }),
      responseText: JSON.stringify(result),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'updateGlobalResourceOrder',
      invoke: () => adminCourseService.updateGlobalResourceOrder(41, [linkedResource, physicalResource]),
      url: `${courseApi}/resource/update-global-order`,
      init: expectedJsonRequest('POST', {
        offering_id: 41,
        resources: [
          { resource_type: 'electronic', resource_id: 63, order: 2 },
          { resource_type: 'physical', resource_id: 64, order: 3 },
        ],
      }),
      expectedResult: result,
      sendsToken: true,
    },
    {
      name: 'linkCourseOffering',
      invoke: () => adminCourseService.linkCourseOffering(96, { course_id: 29 }),
      url: `${courseApi}/course/link-course-offering`,
      init: expectedJsonRequest('POST', { submission_id: 96, selectedCourse: { course_id: 29 } }),
      expectedResult: result,
      sendsToken: true,
    },
  ];
};

describe('adminCourseService request characterization', () => {
  it('keeps the existing public method names and token accessor', () => {
    expect(Object.keys(adminCourseService).sort()).toEqual([
      'checkCourseExists',
      'checkPermanentCourseExists',
      'cleanupPhysicalResourceReferences',
      'createFromFolio',
      'createLocalCourse',
      'createResource',
      'deleteResourceLink',
      'fetchCourseResources',
      'getAuthToken',
      'getFolioCourseId',
      'getLinkedCourses',
      'getPhysicalResourceByExternalId',
      'getPhysicalResourceReferences',
      'getResourcesByCourse',
      'linkCourseOffering',
      'linkCourses',
      'linkExistingResources',
      'provisionCourseFromFolio',
      'reactivateCourse',
      'searchCoursesByQuery',
      'searchEDS',
      'searchFolioCourses',
      'searchResources',
      'unlinkCourses',
      'updateGlobalResourceOrder',
      'updatePhysicalResourceOrder',
      'updateResourceOrder',
    ]);
    expect(adminCourseService.getAuthToken()).toBe('Bearer test-token');
    expect(getAuthTokenSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves every request method and response contract', async () => {
    for (const testCase of requestCases()) {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(testCase.responseJson ?? result),
        text: vi.fn().mockResolvedValue(testCase.responseText ?? JSON.stringify(result)),
      });

      expect(await testCase.invoke(), testCase.name).toEqual(testCase.expectedResult);

      const expectedCall = testCase.init === undefined
        ? [testCase.url]
        : [testCase.url, testCase.init];
      expect(fetchMock.mock.calls, testCase.name).toEqual([expectedCall]);
      expect(getAuthTokenSpy, testCase.name).toHaveBeenCalledTimes(testCase.sendsToken ? 1 : 0);
      fetchMock.mockClear();
      getAuthTokenSpy.mockClear();
    }
  });

  it('provisionCourseFromFolio returns the existing course through its service methods', async () => {
    const checkResult = { exists: true, offeringId: 41, course: { course_id: 29 } };
    const checkCourse = vi.spyOn(adminCourseService, 'checkPermanentCourseExists').mockResolvedValue(checkResult);

    await expect(adminCourseService.provisionCourseFromFolio({ name: 'Synthetic Course' })).resolves.toEqual({
      offering_id: 41,
      course: { course_id: 29 },
      is_created: false,
    });

    expect(checkCourse).toHaveBeenCalledWith({
      course_name: 'Synthetic Course',
      course_number: undefined,
      department_id: undefined,
      folio_course_id: undefined,
      term_id: undefined,
      section_name: '',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('provisionCourseFromFolio creates a missing course through its service methods', async () => {
    const courseDetails = { name: 'Synthetic Course', courseNumber: 'CR-101' };
    const localCourseData = { course: { course_id: 29 }, offering: { offering_id: 41 } };
    const checkCourse = vi.spyOn(adminCourseService, 'checkPermanentCourseExists')
      .mockResolvedValue({ exists: false });
    const createCourse = vi.spyOn(adminCourseService, 'createLocalCourse').mockResolvedValue({
      offering: { offering_id: 41 },
      course: { course_id: 29 },
    });

    await expect(adminCourseService.provisionCourseFromFolio(courseDetails, localCourseData)).resolves.toEqual({
      offering_id: 41,
      course: { course_id: 29 },
      is_created: true,
    });

    expect(checkCourse).toHaveBeenCalledOnce();
    expect(createCourse).toHaveBeenCalledWith(localCourseData);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws the same fixed error when permanent-course lookup fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(adminCourseService.checkPermanentCourseExists({ name: 'Synthetic Course' }))
      .rejects.toThrow('Error checking course existence.');
    expect(fetchMock.mock.calls).toEqual([[
      `${config.api.urls.courseReserves}/course/check-course-exists`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'Synthetic Course' }),
      },
    ]]);
    expect(getAuthTokenSpy).toHaveBeenCalledTimes(1);
  });

  it('includes response status and text when unlinking fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: vi.fn().mockResolvedValue('link is still in use'),
    });

    await expect(adminCourseService.unlinkCourses(43))
      .rejects.toThrow('Failed to unlink courses: 409 link is still in use');
    expect(fetchMock.mock.calls).toEqual([[
      `${config.api.urls.courseReserves}/offering-link/43`,
      { method: 'DELETE', headers: authHeaders },
    ]]);
    expect(getAuthTokenSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the special empty result for an invalid FOLIO CQL search', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('invalid CQL'),
    });

    await expect(adminCourseService.searchCoursesByQuery('TST 101')).resolves.toEqual([]);
    expect(fetchMock.mock.calls).toEqual([[
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.courses}?query=(name%3D%22TST%20101*%22%20or%20courseNumber%3D%22TST%20101*%22)`,
    ]]);
    expect(getAuthTokenSpy).not.toHaveBeenCalled();
  });
});
