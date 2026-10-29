import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getSafeErrorFeedback } from '@/services/notify';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useCourseAssignmentsStore } from '@/store/courseAssignmentsStore';
import {
  getMyProxies,
  getProxyActivityLog,
  inviteProxy,
  revokeProxy,
  type FacultyProxyActivity,
  type FacultyProxyGrant,
  type InviteProxyPayload,
  type ProxyPermissionType,
} from '@/services/api/facultyProxyApi';

const apiError = (error: unknown, message: string) => {
  const feedback = getSafeErrorFeedback(error, message);
  return `${feedback.message}. Reference: ${feedback.reference}`;
};

const ManageDesignees = () => {
  const user = useAuthStore((state) => state.user);
  const { assignments, fetchCourseAssignments } = useCourseAssignmentsStore();
  const [proxies, setProxies] = useState<FacultyProxyGrant[]>([]);
  const [email, setEmail] = useState('');
  const [permissionType, setPermissionType] = useState<ProxyPermissionType>('specific_courses');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<FacultyProxyGrant | null>(null);
  const [activity, setActivity] = useState<FacultyProxyActivity[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProxies = useCallback(async () => {
    const response = await getMyProxies();
    setProxies(response.items || []);
  }, []);

  useEffect(() => {
    if (user?.role !== 'faculty') return;
    loadProxies().catch((loadError) => setError(apiError(loadError, "Couldn't load designees")));
    fetchCourseAssignments().catch(() => undefined);
  }, [user?.role, loadProxies, fetchCourseAssignments]);

  const courses = assignments.flatMap((assignment) => {
    const listingId = assignment.folio_course?.courseListingId;
    if (!listingId) return [];
    const number = assignment.folio_course?.courseNumber || assignment.parsed_course?.courseNumber || '';
    const title = assignment.folio_course?.name || assignment.assignment?.course_title || '';
    const term = assignment.folio_term?.name || assignment.assignment?.academic_period || '';
    return [{ listingId, label: [number, title, term].filter(Boolean).join(' · ') }];
  });

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const proxyEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proxyEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (permissionType === 'specific_courses' && selectedCourses.length === 0) {
      setError('Choose at least one course for this invitation.');
      return;
    }

    const payload: InviteProxyPayload = {
      proxy_email: proxyEmail,
      permission_type: permissionType,
      ...(permissionType === 'specific_courses'
        ? { course_permissions: selectedCourses.map((folio_course_listing_id) => ({ folio_course_listing_id })) }
        : {}),
    };

    setLoading(true);
    setError(null);
    setInvitationUrl(null);
    try {
      const response = await inviteProxy(payload);
      setInvitationUrl(response.invitation_url);
      await loadProxies();
    } catch (inviteError) {
      setError(apiError(inviteError, "Couldn't invite this designee"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setError(null);
    } catch {
      setError('Copy was unavailable. Select and copy the invitation link.');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setLoading(true);
    setError(null);
    try {
      await revokeProxy(revokeTarget.permission_id);
      setRevokeTarget(null);
      await loadProxies();
    } catch (revokeError) {
      setError(apiError(revokeError, "Couldn't revoke this designee"));
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async () => {
    if (activityLoaded) return;
    try {
      const response = await getProxyActivityLog();
      setActivity(response.items || []);
      setActivityLoaded(true);
    } catch (activityError) {
      setError(apiError(activityError, "Couldn't load the activity log"));
    }
  };

  if (user?.role !== 'faculty') {
    return (
      <main className="container mx-auto max-w-3xl p-6">
        <p>Only faculty can designate a proxy.</p>
        <Link to="/">Return to dashboard</Link>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Manage designees</h1>
          <p className="text-sm text-muted-foreground">Invite someone to work on your course reserves.</p>
        </div>
        <Button asChild variant="outline"><Link to="/">Dashboard</Link></Button>
      </header>

      <section aria-labelledby="current-designees">
        <h2 id="current-designees" className="mb-3 text-lg font-medium">Designees</h2>
        {proxies.length === 0 ? <p>No designees yet.</p> : (
          <ul className="space-y-3">
            {proxies.map((proxy) => {
              const expiry = proxy.status === 'pending' ? proxy.invitation_expires_at : proxy.expires_at;
              return (
                <li key={proxy.permission_id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{proxy.proxy_display_name || proxy.proxy_email}</h3>
                      <p className="text-sm text-muted-foreground">{proxy.proxy_email}</p>
                      <p className="mt-1 text-sm">{proxy.scope_summary}</p>
                      <p className="text-sm">Status: {proxy.status}</p>
                      {expiry && <p className="text-sm">Expires: {new Date(expiry).toLocaleDateString()}</p>}
                    </div>
                    {(proxy.status === 'pending' || proxy.status === 'active') && (
                      <Button variant="outline" onClick={() => setRevokeTarget(proxy)}>Revoke</Button>
                    )}
                  </div>
                  {proxy.courses?.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      {proxy.courses.map((course) => (
                        <li key={course.folio_course_listing_id}>{course.course_title || course.folio_course_listing_id}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="invite-designee">
        <h2 id="invite-designee" className="mb-3 text-lg font-medium">Invite a designee</h2>
        <form className="space-y-4 rounded-md border p-4" onSubmit={handleInvite}>
          <div className="space-y-2">
            <Label htmlFor="proxy-email">Email</Label>
            <Input
              id="proxy-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@example.test"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proxy-scope">Access scope</Label>
            <select
              id="proxy-scope"
              name="permission_type"
              className="w-full rounded-md border bg-background p-2"
              value={permissionType}
              onChange={(event) => setPermissionType(event.target.value as ProxyPermissionType)}
            >
              <option value="specific_courses">Edit selected courses</option>
              <option value="full_access">Edit all courses</option>
              <option value="view_only">View only</option>
            </select>
          </div>
          {permissionType === 'specific_courses' && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Choose courses</legend>
              {courses.length === 0 ? <p className="text-sm text-muted-foreground">No courses are available.</p> : (
                courses.map((course) => (
                  <label key={course.listingId} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={course.listingId}
                      checked={selectedCourses.includes(course.listingId)}
                      onChange={() => setSelectedCourses((selected) => (
                        selected.includes(course.listingId)
                          ? selected.filter((id) => id !== course.listingId)
                          : [...selected, course.listingId]
                      ))}
                    />
                    {course.label || course.listingId}
                  </label>
                ))
              )}
            </fieldset>
          )}
          <Button type="submit" disabled={loading}>Invite designee</Button>
        </form>
        {invitationUrl && (
          <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-4">
            <p>Emailing isn’t automatic yet. Copy this link and send it to your designee.</p>
            <p className="break-all text-sm"><a href={invitationUrl}>{invitationUrl}</a></p>
            <Button variant="outline" onClick={handleCopy}>Copy</Button>
          </div>
        )}
      </section>

      <details onToggle={(event) => { if (event.currentTarget.open) loadActivity(); }}>
        <summary className="cursor-pointer font-medium">Activity log</summary>
        {activity.length === 0 ? <p className="mt-2 text-sm">No activity yet.</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {activity.map((entry, index) => (
              <li key={entry.activity_id || `${entry.action}-${index}`}>
                {entry.action} · {new Date(entry.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </details>

      {revokeTarget && (
        <div role="alertdialog" aria-labelledby="revoke-title" className="rounded-md border p-4">
          <p id="revoke-title" className="font-medium">Revoke this designee?</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={loading} onClick={handleRevoke}>Confirm revoke</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </main>
  );
};

export default ManageDesignees;
