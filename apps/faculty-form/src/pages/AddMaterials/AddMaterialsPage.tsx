import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddedMaterialsTray from '@/components/AddedMaterialsTray';
import SearchTab from './SearchTab';
import ReuseTab from './ReuseTab';
import PasteTab from './PasteTab';
import TypeTab from './TypeTab';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';

const tabs = ['search', 'paste', 'reuse', 'type'] as const;
type TabName = typeof tabs[number];

export default function AddMaterialsPage() {
  const { id, reserve, isReadOnly, addedMaterials, undoAddedMaterial } = useSubmissionEditorContext();
  const navigate = useNavigate();
  const { dbId, an } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRecordRoute = Boolean(dbId && an);
  const returnToList = isRecordRoute && searchParams.get('returnTo') === 'list';
  const tab = validTab(searchParams.get('tab'));

  const navigateBack = () => {
    if (isRecordRoute) {
      if (returnToList) {
        navigate(`/submission/${id}/edit`);
        return;
      }
      const params = new URLSearchParams(searchParams);
      params.set('tab', tab);
      navigate(`/submission/${id}/edit/add?${params.toString()}`, { state: location.state });
      return;
    }
    navigate(`/submission/${id}/edit`);
  };
  const changeTab = (value: string) => {
    if (!tabs.includes(value as TabName)) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next);
  };
  const done = () => navigate(`/submission/${id}/edit`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 border-b pb-4">
        <Button variant="ghost" className="px-0" onClick={navigateBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />{returnToList ? 'Back to my list' : isRecordRoute ? 'Back to results' : 'Back to my list'}
        </Button>
        <h1 className="text-xl font-semibold">{reserve.courseCode} · {reserve.courseTitle}</h1>
      </div>

      {isReadOnly && !returnToList ? (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Add materials is unavailable while this submission is locked.
        </div>
      ) : isRecordRoute ? (
        tab === 'paste' ? <PasteTab isRecordRoute dbId={dbId} an={an} /> : <SearchTab isRecordRoute dbId={dbId} an={an} />
      ) : (
        <Tabs value={tab} onValueChange={changeTab} className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="search">Search the library</TabsTrigger>
            <TabsTrigger value="paste">Paste a list</TabsTrigger>
            <TabsTrigger value="reuse">Reuse a past course</TabsTrigger>
            <TabsTrigger value="type">Type it in</TabsTrigger>
          </TabsList>
          <TabsContent value="search"><SearchTab /></TabsContent>
          <TabsContent value="paste" forceMount hidden={tab !== 'paste'} aria-hidden={tab !== 'paste'}><PasteTab /></TabsContent>
          <TabsContent value="reuse">
            <ReuseTab />
          </TabsContent>
          <TabsContent value="type" forceMount hidden={tab !== 'type'} aria-hidden={tab !== 'type'}><TypeTab /></TabsContent>
        </Tabs>
      )}

      <AddedMaterialsTray items={addedMaterials} onUndo={undoAddedMaterial} onDone={done} />
    </div>
  );
}

function Placeholder({ title, description, primaryLabel, onPrimary, secondaryLabel, onSecondary }: {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <section className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button onClick={onPrimary}>{primaryLabel}</Button>
        {secondaryLabel && onSecondary && <Button variant="outline" onClick={onSecondary}>{secondaryLabel}</Button>}
      </div>
    </section>
  );
}

function validTab(value: string | null): TabName {
  return tabs.includes(value as TabName) ? value as TabName : 'search';
}
