import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS } from '@/config/endpoints';
import {
  acceptProxyInvitation,
  getMyFacultyAccess,
  validateProxyInvitation,
  type FacultyProxyInvitation,
} from '@/services/api/facultyProxyApi';
import { useAuthStore } from '@/store/authStore';
import { useActingForStore } from '@/store/actingForStore';

export const PROXY_INVITATION_SESSION_KEY = 'faculty-proxy-invitation-token';

const errorDetails = (error: unknown) => {
  const response = (error as { response?: { status?: number; data?: { message?: string; error?: string } } }).response;
  return {
    status: response?.status,
    message: response?.data?.message || response?.data?.error || (error instanceof Error ? error.message : ''),
  };
};

const AcceptProxyInvitation = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [invitation, setInvitation] = useState<FacultyProxyInvitation | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(PROXY_INVITATION_SESSION_KEY, token); } catch { /* Session storage can be disabled. */ }
    let current = true;
    validateProxyInvitation(token).then((response) => {
      if (!current) return;
      if (response.valid && response.invitation) setInvitation(response.invitation);
      else setValidationMessage(response.message || 'This invitation is invalid or has expired.');
    }).catch((error: unknown) => {
      if (current) setValidationMessage(errorDetails(error).message || 'Unable to validate this invitation.');
    }).finally(() => { if (current) setValidating(false); });
    return () => { current = false; };
  }, [token]);

  const signInUrl = () => {
    const basePath = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/?$/, '/');
    const redirect = `${window.location.origin}${basePath}faculty/accept-proxy-invitation/${encodeURIComponent(token)}`;
    return `${API_ENDPOINTS.AUTH.BASE_URL}${API_ENDPOINTS.AUTH.FACULTY_AUTHORIZE}?redirect=${encodeURIComponent(redirect)}`;
  };

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptMessage(null);
    try {
      const accepted = await acceptProxyInvitation(token);
      const grants = await getMyFacultyAccess();
      const permissionId = accepted.permission?.permission_id;
      const grant = grants.items.find((item) => String(item.permission_id) === String(permissionId) && item.status === 'active');
      if (!grant?.faculty_id) throw new Error('Invitation accepted, but the faculty access record is not available yet. Refresh this page to continue.');
      useActingForStore.getState().selectFaculty({
        username: grant.faculty_id,
        displayName: grant.faculty_display_name || grant.faculty_id,
      });
      try { sessionStorage.removeItem(PROXY_INVITATION_SESSION_KEY); } catch { /* Non-fatal after acceptance. */ }
      navigate('/', { replace: true });
    } catch (error) {
      const { status, message } = errorDetails(error);
      setAcceptMessage(status === 401
        ? 'Please sign in again to accept this invitation.'
        : message || (status === 409
          ? 'This invitation can no longer be accepted by this account.'
          : status === 410
            ? 'This invitation has expired.'
            : 'Unable to accept this invitation.'));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main className="container mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Accept proxy invitation</h1>
      </header>
      {validating ? <p>Checking invitation…</p> : invitation ? (
        <section className="space-y-2 rounded-md border p-4">
          <p><strong>{invitation.faculty_name}</strong> invited you to help with course reserves.</p>
          <p>{invitation.scope_summary}</p>
          <p className="text-sm text-muted-foreground">Invitation expires {new Date(invitation.invitation_expires_at).toLocaleString()}.</p>
        </section>
      ) : <p role="alert">{validationMessage}</p>}
      {invitation && !isAuthenticated && <Button asChild><a href={signInUrl()}>Sign in to accept</a></Button>}
      {invitation && isAuthenticated && <Button disabled={accepting} onClick={handleAccept}>
        {accepting ? 'Accepting…' : 'Accept invitation'}
      </Button>}
      {acceptMessage && <p role="alert">{acceptMessage}</p>}
      <p><Link to="/">Return to dashboard</Link></p>
    </main>
  );
};

export default AcceptProxyInvitation;
