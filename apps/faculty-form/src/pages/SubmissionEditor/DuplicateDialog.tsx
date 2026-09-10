import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { useCourseCloning } from '@/hooks/useCourseCloning';
import type { PhysicalReserve, ElectronicResource } from '@/hooks/useCourseCloning';
import type { CourseReserve, CourseItem, FolioLocation, FolioCopiedItem } from '@/store/courseReservesStore';
import type { User } from '@/store/authStore';

interface DuplicateDialogProps {
  showDuplicateDialog: boolean;
  setShowDuplicateDialog: (v: boolean) => void;
  reserve: CourseReserve;
  user: User | null;
  id: string;
  emailConfirmation: boolean;
  setEmailConfirmation: (v: boolean) => void;
  updateReserve: (id: string, updates: Partial<CourseReserve>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submissionHandlers: Record<string, (...args: any[]) => any>;
  addItem: (reserveId: string, item: Omit<CourseItem, 'id'>) => boolean;
  duplicateSourceCourse: {
    term: string;
    courseName: string;
    resourceCount: number;
    electronicCount: number;
    physicalCount: number;
  } | null;
}

export default function DuplicateDialog({
  showDuplicateDialog,
  setShowDuplicateDialog,
  reserve,
  user,
  id,
  emailConfirmation,
  setEmailConfirmation,
  updateReserve,
  submissionHandlers,
  duplicateSourceCourse,
}: DuplicateDialogProps) {
  const [duplicateSubmitting, setDuplicateSubmitting] = React.useState(false);
  const { fetchPreviousCourses, fetchCourseResources } = useCourseCloning();

  const handleConfirm = async () => {
    if (!reserve?.courseCode || !user?.full_name) {
      submissionHandlers.confirmDuplicateSubmit(emailConfirmation);
      setShowDuplicateDialog(false);
      return;
    }
    try {
      setDuplicateSubmitting(true);
      const courses = await fetchPreviousCourses(reserve.courseCode, user.full_name, 'exact');
      if (!courses || courses.length === 0) {
        submissionHandlers.confirmDuplicateSubmit(emailConfirmation);
        setShowDuplicateDialog(false);
        return;
      }
      const source = courses[0];
      if (!source.courseListingId) {
        submissionHandlers.confirmDuplicateSubmit(emailConfirmation);
        setShowDuplicateDialog(false);
        return;
      }

      const { physicalReserves, electronicResources } = await fetchCourseResources(source.courseListingId);
      const mapped: CourseItem[] = [];

      (physicalReserves || []).forEach((res: PhysicalReserve, idx: number) => {
        type PhysicalItemInfo = {
          title?: string;
          contributors?: Array<{ name: string; primary?: boolean }>;
          publication?: Array<{ publisher?: string; dateOfPublication?: string }>;
          callNumber?: string;
          barcode?: string;
          copy?: string;
          instanceId?: string;
          holdingsId?: string;
          instanceHrid?: string;
          temporaryLocationId?: string;
          temporaryLocationObject?: unknown;
          permanentLocationId?: string;
          permanentLocationObject?: unknown;
          effectiveCallNumberComponents?: { callNumber?: string };
        };
        const item = (res.copiedItem || res.item) as PhysicalItemInfo;
        if (!item?.title) return;
        const primaryAuthor =
          item.contributors?.find((c) => c.primary)?.name || item.contributors?.[0]?.name || '';
        const pubInfo = item.publication?.[0];
        let callNumber = '';
        if (item.callNumber) callNumber = item.callNumber;
        else if (item.effectiveCallNumberComponents?.callNumber) callNumber = item.effectiveCallNumberComponents.callNumber;
        const barcode = res.barcode || item.barcode || '';
        const copy = item.copy || '';
        mapped.push({
          id: `item-${Date.now()}-${idx}`,
          title: item.title,
          authors: primaryAuthor,
          materialType: 'book',
          status: 'draft',
          publisher: pubInfo?.publisher || '',
          publicationYear: pubInfo?.dateOfPublication || '',
          notes: `Call Number: ${callNumber || 'N/A'}${barcode ? ` | Barcode: ${barcode}` : ''}`,
          barcode: barcode || undefined,
          callNumber: callNumber || undefined,
          copy: copy || undefined,
          instanceId: item.instanceId || undefined,
          holdingsId: item.holdingsId || undefined,
          instanceHrid: item.instanceHrid || undefined,
          temporaryLocationId: item.temporaryLocationId || undefined,
          temporaryLocationObject: (item.temporaryLocationObject as FolioLocation) || undefined,
          permanentLocationId: item.permanentLocationId || undefined,
          permanentLocationObject: (item.permanentLocationObject as FolioLocation) || undefined,
          copiedItem: item as FolioCopiedItem,
        });
      });

      (electronicResources || []).forEach((er: ElectronicResource, idx: number) => {
        const url = er.url || '';
        let materialType: 'article' | 'video' | 'website' | 'other' = 'other';
        if (url.includes('youtube') || url.includes('video')) materialType = 'video';
        else if (url.includes('ebsco') || url.includes('journal') || !!er.publication_title) materialType = 'article';
        else if (url) materialType = 'website';
        const notesParts = [er.notes, er.description, er.external_note, er.internal_note].filter(Boolean);
        mapped.push({
          id: `item-${Date.now()}-e${idx}`,
          title: er.title || er.publication_title || 'Untitled Resource',
          authors: er.authors || '',
          url,
          materialType,
          status: 'draft',
          journalTitle: er.publication_title || undefined,
          publicationYear: er.publication_date || undefined,
          notes: notesParts.length ? notesParts.join(' ') : undefined,
        });
      });

      updateReserve(id, { items: mapped });
      submissionHandlers.confirmDuplicateSubmit(emailConfirmation, mapped);
      setShowDuplicateDialog(false);
    } finally {
      setDuplicateSubmitting(false);
    }
  };

  return (
    <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reuse Previous Course Materials?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            {duplicateSourceCourse ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                <p className="text-sm font-semibold text-blue-900 mb-1">Duplicating from:</p>
                <p className="text-sm text-blue-700">
                  <strong>{reserve.courseCode}</strong> · {duplicateSourceCourse.term}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {duplicateSourceCourse.resourceCount > 0
                    ? `${duplicateSourceCourse.resourceCount} resource${duplicateSourceCourse.resourceCount !== 1 ? 's' : ''} (${duplicateSourceCourse.electronicCount} electronic, ${duplicateSourceCourse.physicalCount} physical)`
                    : 'No resources found'}
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                <p className="text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  No previous version of <strong>{reserve.courseCode}</strong> found. Library staff will
                  be notified you want to reuse materials.
                </p>
              </div>
            )}
            <div className="space-y-2 text-sm">
              <p>
                Submitting as <strong>Duplicate Previous Course</strong> tells library staff you are
                reusing the exact same materials from a prior offering of this course. You do{' '}
                <em>not</em> need to add items here.
              </p>
              <p>
                If you intend to make any changes or add new materials, cancel and use the standard
                submission or copy tools instead.
              </p>
              <p className="text-amber-600 font-medium flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                This action submits immediately with a duplicate flag for staff triage.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dup-email"
                checked={emailConfirmation}
                onCheckedChange={(checked) => setEmailConfirmation(checked as boolean)}
              />
              <label
                htmlFor="dup-email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email me a confirmation
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 hover:bg-amber-700"
            disabled={duplicateSubmitting}
            onClick={handleConfirm}
          >
            {duplicateSubmitting ? 'Submitting…' : 'Submit as Duplicate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
