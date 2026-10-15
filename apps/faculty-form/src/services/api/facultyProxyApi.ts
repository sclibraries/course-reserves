import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/config/endpoints';

export type ProxyPermissionType = 'specific_courses' | 'full_access' | 'view_only';
export type ProxyGrantStatus = 'pending' | 'active' | 'revoked' | 'expired';

export interface FacultyProxyCourse {
  folio_course_listing_id: string;
  course_title?: string | null;
  term_id?: string | null;
}

export interface FacultyProxyGrant {
  permission_id: number;
  faculty_id?: string;
  faculty_display_name?: string;
  proxy_display_name?: string | null;
  proxy_email?: string;
  permission_type: ProxyPermissionType;
  scope_summary: string;
  courses: FacultyProxyCourse[];
  status: ProxyGrantStatus;
  invited_at?: string | null;
  invitation_expires_at?: string | null;
  accepted_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
}

export interface InviteProxyPayload {
  proxy_email: string;
  permission_type: ProxyPermissionType;
  course_permissions?: Array<{ folio_course_listing_id: string }>;
}

export interface FacultyProxyInvitation {
  faculty_name: string;
  scope_summary: string;
  invitation_expires_at: string;
}

export interface FacultyProxyActivity {
  activity_id?: number;
  action: string;
  created_at: string;
  [key: string]: unknown;
}

const courseReservesUrl = (path: string) =>
  `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${path}`;

export const getMyProxies = async () => (
  await apiClient.get(courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_MY_PROXIES))
).data as { items: FacultyProxyGrant[]; count: number };

export const inviteProxy = async (payload: InviteProxyPayload) => (
  await apiClient.post(
    courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_INVITE),
    payload,
  )
).data as {
  success: boolean;
  invitation_url: string;
  permission: FacultyProxyGrant;
};

export const getMyFacultyAccess = async () => (
  await apiClient.get(courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_MY_FACULTY_ACCESS))
).data as { items: FacultyProxyGrant[]; count: number };

export const validateProxyInvitation = async (token: string) => (
  await apiClient.get(
    `${courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_VALIDATE_TOKEN)}/${encodeURIComponent(token)}`,
  )
).data as {
  valid: boolean;
  invitation?: FacultyProxyInvitation;
  message?: string;
};

export const acceptProxyInvitation = async (token: string) => {
  const response = await apiClient.post(
    courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_ACCEPT),
    { invitation_token: token },
    { validateStatus: (status) => (status >= 200 && status < 300) || status === 401 },
  );

  if (response.status === 401) {
    throw Object.assign(new Error('Sign in again to accept this invitation'), {
      response: { status: response.status, data: response.data },
    });
  }

  return response.data as { success: boolean; permission: FacultyProxyGrant };
};

export const revokeProxy = async (permissionId: string | number) => (
  await apiClient.delete(
    `${courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_REVOKE)}/${encodeURIComponent(String(permissionId))}`,
  )
).data as { success: boolean; message: string };

export const getProxyActivityLog = async (facultyId?: string) => (
  await apiClient.get(
    `${courseReservesUrl(API_ENDPOINTS.COURSE_RESERVES.FACULTY_PROXY_ACTIVITY_LOG)}`
      + (facultyId ? `/${encodeURIComponent(facultyId)}` : ''),
  )
).data as { items: FacultyProxyActivity[]; count: number };
