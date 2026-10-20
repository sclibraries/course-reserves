import { useCallback, useEffect, useRef, useState } from 'react';
import type { CourseReserve } from '@/store/courseReservesStore';
import { useDraftStore } from '@/store/draftStore';
import { useReserveStore } from '@/store/useReserveStore';
import { buildSubmissionPayload } from '@/handlers/submissionPayload';
import {
  getDraft,
  isDraftConflict,
  syncDraft,
  submitDraft as submitServerDraft,
} from '@/services/api/facultyDraftApi';

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'retrying' | 'conflict';

interface ServerDraftSyncConfig {
  autoSaveDelay?: number;
  autoSaveEnabled?: boolean;
}

export function useServerDraftSync(
  reserveId: string | undefined,
  reserve: CourseReserve | null | undefined,
  { autoSaveDelay = 3000, autoSaveEnabled = true }: ServerDraftSyncConfig = {},
) {
  const draftStore = useDraftStore();
  const reserveRef = useRef(reserve);
  reserveRef.current = reserve;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const performSaveRef = useRef<() => Promise<boolean>>(async () => false);
  const inFlightPromiseRef = useRef<Promise<boolean> | null>(null);
  const conflictRef = useRef(false);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const retryCountRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>(
    reserve?.status === 'draft' && reserve.draftVersion ? 'saved' : 'idle',
  );
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(
    reserve?.status === 'draft' && reserve.draftVersion ? new Date(reserve.lastUpdated) : null,
  );
  const hasUnsavedChanges = reserveId ? draftStore.hasChanges(reserveId) : false;

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const queueSave = useCallback((delay: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void performSaveRef.current();
    }, delay);
  }, [clearTimer]);

  const performSave = useCallback((): Promise<boolean> => {
    if (inFlightPromiseRef.current) return inFlightPromiseRef.current;
    const current = reserveRef.current;
    if (!reserveId || !current || current.status !== 'draft' || !autoSaveEnabled || conflictRef.current) {
      return Promise.resolve(false);
    }

    const savedRevision = revisionRef.current;
    draftStore.setSavingStatus(reserveId, 'saving');
    draftStore.clearSaveError(reserveId);
    setSaveStatus('saving');

    const request = (async () => {
      try {
        const payload = buildSubmissionPayload(current, false);
        const response = await syncDraft(current, payload);
        const serverUuid = response.submission_uuid;
        const nextVersion = response.draft_version;
        if (response.existing) {
          conflictRef.current = true;
          updateDraftIdentity(reserveId, serverUuid, nextVersion);
          setSaveStatus('conflict');
          draftStore.setSavingStatus(reserveId, 'error');
          return false;
        }

        updateDraftIdentity(reserveId, serverUuid, nextVersion);
        retryCountRef.current = 0;
        draftStore.setSavingStatus(reserveId, 'saved');
        const savedAt = new Date();
        draftStore.setLastSaveTime(reserveId, savedAt);
        setLastSaveTime(savedAt);

        if (revisionRef.current === savedRevision) {
          savedRevisionRef.current = savedRevision;
          draftStore.markAsSaved(reserveId);
          setSaveStatus('saved');
        } else {
          setSaveStatus('saving');
        }
        return true;
      } catch (error) {
        console.error('Failed to save faculty draft:', error);
        if (isDraftConflict(error)) {
          conflictRef.current = true;
          setSaveStatus('conflict');
          draftStore.setSavingStatus(reserveId, 'error');
          return false;
        }

        retryCountRef.current += 1;
        setSaveStatus('retrying');
        draftStore.setSavingStatus(reserveId, 'error');
        draftStore.setSaveError(reserveId, 'Not saved - retrying');
        const retryDelay = Math.min(autoSaveDelay * (2 ** Math.min(retryCountRef.current - 1, 5)), 60000);
        queueSave(retryDelay);
        return false;
      } finally {
        inFlightPromiseRef.current = null;
        if (revisionRef.current !== savedRevision && !conflictRef.current && !timerRef.current) {
          queueSave(0);
        }
      }
    })();
    inFlightPromiseRef.current = request;
    return request;
  }, [autoSaveDelay, autoSaveEnabled, draftStore, queueSave, reserveId]);
  performSaveRef.current = performSave;

  const saveDraft = useCallback(async (): Promise<boolean> => {
    clearTimer();
    const current = reserveRef.current;
    if (current?.submissionUuid && savedRevisionRef.current === revisionRef.current) return true;
    if (!current?.submissionUuid && savedRevisionRef.current === revisionRef.current) return false;
    return performSave();
  }, [clearTimer, performSave]);

  const markChanged = useCallback(() => {
    if (!reserveId || !autoSaveEnabled || reserveRef.current?.status !== 'draft' || conflictRef.current) return;
    revisionRef.current += 1;
    retryCountRef.current = 0;
    draftStore.markAsChanged(reserveId);
    draftStore.clearSaveError(reserveId);
    setSaveStatus('idle');
    queueSave(autoSaveDelay);
  }, [autoSaveDelay, autoSaveEnabled, draftStore, queueSave, reserveId]);

  const loadLatestVersion = useCallback(async () => {
    const current = reserveRef.current;
    const uuid = current?.submissionUuid || (current && !current.id.startsWith('reserve-') ? current.id : undefined);
    if (!reserveId || !uuid) return false;

    try {
      const latest = await getDraft(uuid);
      const replacement = { ...latest, id: reserveId, submissionUuid: uuid };
      reserveRef.current = replacement;
      useReserveStore.getState().updateReserve(reserveId, replacement);
      conflictRef.current = false;
      revisionRef.current += 1;
      savedRevisionRef.current = revisionRef.current;
      draftStore.markAsSaved(reserveId);
      draftStore.setSavingStatus(reserveId, 'saved');
      const savedAt = new Date();
      draftStore.setLastSaveTime(reserveId, savedAt);
      setLastSaveTime(savedAt);
      setSaveStatus('saved');
      return true;
    } catch (error) {
      console.error('Failed to load latest faculty draft:', error);
      return false;
    }
  }, [draftStore, reserveId]);

  const submitCurrentDraft = useCallback(async (_emailConfirmation: boolean): Promise<string | null> => {
    let current = reserveRef.current;
    if (!current || conflictRef.current) return null;
    const needsSave = !current.submissionUuid || savedRevisionRef.current !== revisionRef.current;
    const hasLocalList = current.items.length > 0 || current.folders.length > 0;
    if (needsSave && hasLocalList && !current.submissionUuid) {
      if (!(await performSave())) return null;
    } else if (needsSave && !(await saveDraft())) {
      return null;
    }

    current = useReserveStore.getState().getReserveById(reserveId || '') || reserveRef.current;
    const uuid = current?.submissionUuid || (current && !current.id.startsWith('reserve-') ? current.id : undefined);
    if (!uuid) return null;
    await submitServerDraft(uuid);
    return uuid;
  }, [performSave, reserveId, saveDraft]);

  useEffect(() => {
    if (!autoSaveEnabled) clearTimer();
  }, [autoSaveEnabled, clearTimer]);

  useEffect(() => {
    if (hasUnsavedChanges || reserve?.status !== 'draft' || !reserve.draftVersion || conflictRef.current) return;
    setSaveStatus((current) => current === 'idle' ? 'saved' : current);
    setLastSaveTime((current) => current || new Date(reserve.lastUpdated));
  }, [hasUnsavedChanges, reserve?.draftVersion, reserve?.lastUpdated, reserve?.status]);

  useEffect(() => {
    const handlePageHide = () => {
      if (draftStore.hasChanges(reserveId || '') && !conflictRef.current) {
        clearTimer();
        void performSaveRef.current();
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [clearTimer, draftStore, reserveId]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    saveDraft,
    markChanged,
    saveStatus,
    lastSaveTime,
    saveError: saveStatus === 'retrying' ? 'Not saved - retrying' : null,
    hasUnsavedChanges,
    isSaving: saveStatus === 'saving',
    hasConflict: saveStatus === 'conflict',
    loadLatestVersion,
    submitCurrentDraft,
  };
}

function updateDraftIdentity(reserveId: string, submissionUuid: string, draftVersion: number) {
  const current = useReserveStore.getState().getReserveById(reserveId);
  if (!current) return;
  useReserveStore.getState().updateReserve(reserveId, { submissionUuid, draftVersion });
}
