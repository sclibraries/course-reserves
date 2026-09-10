import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Loader2, 
  BookOpen, 
  ExternalLink, 
  MapPin,
  Plus,
  Check,
  Calendar,
  Globe,
  FileText,
  CheckCircle2,
  Filter
} from "lucide-react";
import { 
  searchDiscovery, 
  type DiscoverySearchResult,
  type SearchLimiters,
  type FieldQuery 
} from "@/services/discoverySearchService";
import type { CourseItem } from "@/store/courseReservesStore";
import {
  executeCitationBatchSearch,
  prepareCitationBatchSearches,
  type CitationBatchSearchGroup,
} from "@/utils/citationBatchSearch";

interface DiscoverySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsSelected: (items: Partial<CourseItem>[]) => void;
}

interface DiscoveryResultCardProps {
  result: DiscoverySearchResult;
  isSelected: boolean;
  onToggle: () => void;
}

function DiscoveryResultCard({
  result,
  isSelected,
  onToggle,
}: DiscoveryResultCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? 'border-primary bg-primary/5' : ''
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {isSelected ? (
            <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded border-2 border-muted-foreground/30" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold leading-tight text-base">{result.title}</h3>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                {result.publicationType}
              </Badge>
              {result.hasFullText && (
                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Full Text
                </Badge>
              )}
            </div>
          </div>

          {result.authors.length > 0 && (
            <p className="text-sm text-foreground/80 mb-2 font-medium">
              {result.authors.slice(0, 3).join('; ')}
              {result.authors.length > 3 && ` +${result.authors.length - 3} more`}
            </p>
          )}

          <div className="space-y-1.5 mb-3">
            {result.journalTitle && (
              <div className="text-sm text-foreground/75 font-medium">
                {result.journalTitle}
                {result.volumeNumber && ` Vol. ${result.volumeNumber}`}
                {result.issueNumber && `, Issue ${result.issueNumber}`}
              </div>
            )}

            {result.publicationInfo && !result.journalTitle && (
              <div className="text-sm text-foreground/75">
                {result.publicationInfo}
              </div>
            )}

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/70">
              {result.publicationDate && (result.publicationDate.year || result.publicationDate.month) && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-foreground/60" />
                  <span>
                    {result.publicationDate.year}
                    {result.publicationDate.month && `-${result.publicationDate.month.padStart(2, '0')}`}
                    {result.publicationDate.day && `-${result.publicationDate.day.padStart(2, '0')}`}
                  </span>
                </div>
              )}
              {result.languages && result.languages.length > 0 && (
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-foreground/60" />
                  <span>{result.languages.slice(0, 2).join(', ')}</span>
                </div>
              )}
              {result.fileDescription && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3 text-foreground/60" />
                  <span>{result.fileDescription}</span>
                </div>
              )}
            </div>
          </div>

          {(result.doi || result.isbn || result.issn) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result.doi && (
                <Badge variant="secondary" className="text-xs font-mono">
                  DOI: {result.doi}
                </Badge>
              )}
              {result.isbn && (
                <Badge variant="secondary" className="text-xs font-mono">
                  ISBN: {result.isbn}
                </Badge>
              )}
              {result.issn && (
                <Badge variant="secondary" className="text-xs font-mono">
                  ISSN: {result.issn}
                </Badge>
              )}
            </div>
          )}

          {result.abstract && (
            <p className="text-sm text-foreground/75 line-clamp-3 mb-3 leading-relaxed">
              {result.abstract}
            </p>
          )}

          {result.subjects && result.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {result.subjects.slice(0, 5).map((subject, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-muted/50">
                  {subject}
                </Badge>
              ))}
              {result.subjects.length > 5 && (
                <Badge variant="outline" className="text-xs bg-muted/50">
                  +{result.subjects.length - 5} more
                </Badge>
              )}
            </div>
          )}

          {(result.callNumber || result.location) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
              {result.callNumber && (
                <div className="flex items-center gap-1.5 text-foreground/70">
                  <BookOpen className="h-3.5 w-3.5 text-foreground/60" />
                  <span className="font-medium">Call #:</span>
                  <span>{result.callNumber}</span>
                </div>
              )}
              {result.location && (
                <div className="flex items-center gap-1.5 text-foreground/70">
                  <MapPin className="h-3.5 w-3.5 text-foreground/60" />
                  <span className="font-medium">Location:</span>
                  <span>{result.location}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
            <span className="text-xs text-foreground/60 font-medium">
              {result.database}
            </span>
            <div className="flex items-center gap-2">
              {result.fullTextUrl && (
                <a
                  href={result.fullTextUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:underline font-semibold"
                  onClick={(event) => event.stopPropagation()}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Access Full Text
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {result.url && result.url !== result.pLink && !result.fullTextUrl && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  onClick={(event) => event.stopPropagation()}
                >
                  View Resource
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <a
                href={result.pLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                onClick={(event) => event.stopPropagation()}
              >
                View in Discover
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscoverySearchDialog({
  open,
  onOpenChange,
  onItemsSelected
}: DiscoverySearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DiscoverySearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Citation search mode
  const [searchMode, setSearchMode] = useState<'simple' | 'citation'>('simple');
  const [citationRaw, setCitationRaw] = useState('');
  const [citationSearchGroups, setCitationSearchGroups] = useState<CitationBatchSearchGroup[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [ebscoQueryString, setEbscoQueryString] = useState<string>(''); // Store QueryString from EBSCO
  const [appliedLimiterIds, setAppliedLimiterIds] = useState<string[]>([]); // Track applied limiters from EBSCO
  const resultsPerPage = 20; // EBSCO default
  
  // Limiter state
  const [limiters, setLimiters] = useState<SearchLimiters>({
    fullText: false,
    peerReviewed: false,
    fiveCollege: false,
    location: undefined
  });
  
  // Ref for scroll container
  const scrollRef = useRef<HTMLDivElement>(null);

  const LOCATIONS = [
    "Smith College Annex",
    "Smith College Hillyer Art Library",
    "Smith College Josten Library",
    "Smith College Neilson Library",
    "Smith College Online"
  ];

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setResults([]);
      setSelectedItems(new Set());
      setCurrentPage(1);
      setHasMore(false);
      setEbscoQueryString('');
      setAppliedLimiterIds([]);
      setSearchMode('simple');
      setCitationRaw('');
      setCitationSearchGroups([]);
      setLimiters({
        fullText: false,
        peerReviewed: false,
        fiveCollege: false,
        location: undefined
      });
      setError(null);
    }
  }, [open]);

  const handleSearch = async (e?: React.FormEvent, isLimiterChange = false, updatedLimiters?: SearchLimiters) => {
    e?.preventDefault();
    
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    setCurrentPage(1); // Reset to first page
    setCitationSearchGroups([]);
    
    try {
      const queryToSearch: string | FieldQuery[] = searchQuery;
      
      // If this is a limiter change and we have a QueryString, use it
      const queryStringToUse = isLimiterChange && ebscoQueryString ? ebscoQueryString : undefined;
      
      // Use provided limiters (from direct call) or current state
      const limitersToUse = updatedLimiters || limiters;
      
      const response = await searchDiscovery(
        queryToSearch, 
        1, 
        queryStringToUse, 
        limitersToUse,
        isLimiterChange ? appliedLimiterIds : undefined
      );
      setResults(response.results);
      setTotalHits(response.totalHits);
      setSearchTime(response.searchTime);
      setEbscoQueryString(response.queryString); // Store QueryString for pagination
      setAppliedLimiterIds(response.appliedLimiters); // Store applied limiters
      setSelectedItems(new Set()); // Reset selection on new search
      
      // Check if there are more results to load
      setHasMore(response.results.length < response.totalHits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTotalHits(0);
      setHasMore(false);
    } finally {
      setSearching(false);
    }
  };

  const handleCitationBatchSearch = async (e?: React.FormEvent, updatedLimiters?: SearchLimiters) => {
    e?.preventDefault();

    if (!citationRaw.trim()) {
      return;
    }

    const preparedSearches = prepareCitationBatchSearches(citationRaw);
    if (preparedSearches.length === 0) {
      setError('No citations were detected. Paste one citation per line or separate citation blocks with blank lines.');
      setCitationSearchGroups([]);
      setSelectedItems(new Set());
      return;
    }

    setSearching(true);
    setError(null);
    setResults([]);
    setTotalHits(0);
    setSearchTime(0);
    setSelectedItems(new Set());
    setCurrentPage(1);
    setHasMore(false);
    setEbscoQueryString('');
    setAppliedLimiterIds([]);

    try {
      const groups = await executeCitationBatchSearch(
        preparedSearches,
        searchDiscovery,
        updatedLimiters || limiters
      );
      setCitationSearchGroups(groups);
    } finally {
      setSearching(false);
    }
  };

  const loadMoreResults = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    // For pagination, we use ebscoQueryString, so we don't need to validate the original query
    if (!ebscoQueryString) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      // Use the QueryString from EBSCO for pagination
      // Pass empty string as query since we're using queryString parameter
      const response = await searchDiscovery('', nextPage, ebscoQueryString, limiters, appliedLimiterIds);
      setResults(prev => [...prev, ...response.results]);
      setCurrentPage(nextPage);
      
      // Check if there are still more results
      const totalLoaded = results.length + response.results.length;
      setHasMore(totalLoaded < response.totalHits);
    } catch (err) {
      console.error('Failed to load more results:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more results');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, results.length, ebscoQueryString, limiters, appliedLimiterIds]);
  
  // Attach scroll listener to ScrollArea viewport
  useEffect(() => {
    if (searchMode !== 'simple') return;

    const scrollViewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
    
    if (!scrollViewport) return;
    
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      
      const scrollPercentage = (scrollViewport.scrollTop + scrollViewport.clientHeight) / scrollViewport.scrollHeight;
      
      // Load more when scrolled 80% down
      if (scrollPercentage > 0.8) {
        loadMoreResults();
      }
    };
    
    scrollViewport.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollViewport.removeEventListener('scroll', handleScroll);
    };
  }, [loadingMore, hasMore, loadMoreResults, searchMode]);

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const makeCitationSelectionKey = (groupId: string, resultId: string) => `${groupId}::${resultId}`;

  const handleSearchModeChange = (mode: 'simple' | 'citation') => {
    setSearchMode(mode);
    setSelectedItems(new Set());
    setResults([]);
    setTotalHits(0);
    setSearchTime(0);
    setHasMore(false);
    setCurrentPage(1);
    setEbscoQueryString('');
    setAppliedLimiterIds([]);
    setCitationSearchGroups([]);
    setError(null);
  };

  const rerunActiveSearchWithLimiters = (newLimiters: SearchLimiters) => {
    setLimiters(newLimiters);

    if (searchMode === 'citation' && citationSearchGroups.length > 0) {
      void handleCitationBatchSearch(undefined, newLimiters);
      return;
    }

    if (searchMode === 'simple' && results.length > 0) {
      void handleSearch(undefined, true, newLimiters);
    }
  };

  const handleAddSelected = () => {
    const selectedResults = searchMode === 'citation'
      ? citationSearchGroups.flatMap((group) =>
          group.results.filter((result) => selectedItems.has(makeCitationSelectionKey(group.id, result.id)))
        )
      : results.filter((result) => selectedItems.has(result.id));

    const uniqueResults = Array.from(
      new Map(selectedResults.map((result) => [result.id, result])).values()
    );

    const itemsToAdd = uniqueResults.map((result) => convertToReserveItem(result));
    
    onItemsSelected(itemsToAdd);
    onOpenChange(false);
    
    // Reset state
    setSearchQuery("");
    setResults([]);
    setSelectedItems(new Set());
    setCurrentPage(1);
    setHasMore(false);
    setEbscoQueryString('');
    setAppliedLimiterIds([]);
    setSearchMode('simple');
    setCitationRaw('');
    setCitationSearchGroups([]);
    setLimiters({
      fullText: false,
      peerReviewed: false,
      fiveCollege: false,
      location: undefined
    });
  };

  const convertToReserveItem = (result: DiscoverySearchResult): Partial<CourseItem> => {
    // Determine material type with comprehensive detection
    let materialType: CourseItem['materialType'] = 'other';

    const pubType = result.publicationType.toLowerCase();
    const pubTypeId = result.publicationType.replace(/\s+/g, '').toLowerCase();
    
    // Check for articles/journals first (most common in EBSCO)
    if (
      pubType.includes('journal') ||
      pubType.includes('article') ||
      pubType.includes('periodical') ||
      pubType.includes('magazine') ||
      pubTypeId.includes('academic')
    ) {
      materialType = 'article';
    } 
    // Then check for books
    else if (
      pubType.includes('book') || 
      pubType.includes('ebook') ||
      pubType.includes('monograph')
    ) {
      materialType = 'book';
    }
    // Check for book chapters
    else if (
      pubType.includes('chapter') ||
      pubType.includes('book section')
    ) {
      materialType = 'chapter';
    }
    // Check for videos
    else if (
      pubType.includes('video') || 
      pubType.includes('film') ||
      pubType.includes('dvd') ||
      pubType.includes('streaming')
    ) {
      materialType = 'video';
    }
    // Check for websites
    else if (
      pubType.includes('website') || 
      pubType.includes('web') ||
      result.fileDescription?.toLowerCase().includes('web')
    ) {
      materialType = 'website';
    }

    // Build comprehensive publication info
    const pubInfoParts: string[] = [];
    if (result.journalTitle) {
      pubInfoParts.push(result.journalTitle);
      if (result.volumeNumber) pubInfoParts.push(`Vol. ${result.volumeNumber}`);
      if (result.issueNumber) pubInfoParts.push(`Issue ${result.issueNumber}`);
    } else if (result.publicationInfo) {
      pubInfoParts.push(result.publicationInfo);
    }

    // Format publication date
    let pubYear: string | undefined;
    let fullDate: string | undefined;
    if (result.publicationDate) {
      pubYear = result.publicationDate.year;
      if (result.publicationDate.year && result.publicationDate.month) {
        fullDate = `${result.publicationDate.year}-${result.publicationDate.month.padStart(2, '0')}`;
        if (result.publicationDate.day) {
          fullDate += `-${result.publicationDate.day.padStart(2, '0')}`;
        }
      }
    }

    // Build notes with links and key metadata
    const notesParts: string[] = [];
    
    // Add access information at the top
    if (result.hasFullText && result.fullTextUrl) {
      notesParts.push('✓ Full Text Available');
      notesParts.push(`Access: ${result.fullTextUrl}`);
    } else if (result.url) {
      notesParts.push(`Resource URL: ${result.url}`);
    }
    
    // Add Discover link for reference
    notesParts.push(`Discover: ${result.pLink}`);
    
    // Add database source
    notesParts.push(`Source: ${result.database}`);
    
    // Add DOI if present
    if (result.doi) {
      notesParts.push(`DOI: ${result.doi}`);
    }
    
    // Add abstract
    if (result.abstract) {
      const truncatedAbstract = result.abstract.substring(0, 350);
      notesParts.push(`\nAbstract: ${truncatedAbstract}${result.abstract.length > 350 ? '...' : ''}`);
    }

    // Build library notes with comprehensive metadata
    const libraryNotesParts: string[] = [];
    
    // Identifiers
    if (result.isbn) libraryNotesParts.push(`ISBN: ${result.isbn}`);
    if (result.issn) libraryNotesParts.push(`ISSN: ${result.issn}`);
    
    // Publication details
    if (fullDate) {
      libraryNotesParts.push(`Publication Date: ${fullDate}`);
    } else if (pubYear) {
      libraryNotesParts.push(`Publication Year: ${pubYear}`);
    }
    
    // Physical location
    if (result.callNumber || result.location) {
      const locationParts: string[] = [];
      if (result.location) locationParts.push(result.location);
      if (result.callNumber) locationParts.push(`Call #: ${result.callNumber}`);
      libraryNotesParts.push(`Location: ${locationParts.join(', ')}`);
    }
    
    // Format and languages
    if (result.fileDescription) {
      libraryNotesParts.push(`Format: ${result.fileDescription}`);
    }
    if (result.languages && result.languages.length > 0) {
      libraryNotesParts.push(`Languages: ${result.languages.join(', ')}`);
    }
    
    // Subject terms (filtered for relevance)
    if (result.subjects && result.subjects.length > 0) {
      const relevantSubjects = result.subjects
        .filter(s => !s.match(/^[A-Z]{2}\d+-\d+$/)) // Filter out classification codes
        .slice(0, 5);
      if (relevantSubjects.length > 0) {
        libraryNotesParts.push(`Subject Terms: ${relevantSubjects.join('; ')}`);
      }
    }
    
    // Additional URLs
    if (result.additionalUrls && result.additionalUrls.length > 0) {
      libraryNotesParts.push(`Related URLs: ${result.additionalUrls.slice(0, 2).join('; ')}`);
    }

    // Prioritize fullTextUrl over regular url
    const primaryUrl = result.fullTextUrl || result.url || result.pLink;

    return {
      title: result.title,
      authors: result.authors.length > 0 ? result.authors.join('; ') : undefined,
      isbn: result.isbn,
      url: primaryUrl,
      materialType,
      status: 'draft',
      notes: notesParts.join('\n'),
      libraryNotes: libraryNotesParts.length > 0 ? libraryNotesParts.join('\n') : undefined,
      publicationYear: pubYear,
      publisher: pubInfoParts.join(', ') || undefined
    };
  };

  const renderLimiters = () => (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-4 w-4 text-foreground/60" />
        <span className="text-sm font-medium text-foreground/80">Refine Results</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={limiters.fullText ? 'default' : 'outline'}
          onClick={() => {
            const newLimiters = { ...limiters, fullText: !limiters.fullText };
            rerunActiveSearchWithLimiters(newLimiters);
          }}
          className="h-8"
        >
          {limiters.fullText && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Full Text Only
        </Button>

        <Button
          type="button"
          size="sm"
          variant={limiters.peerReviewed ? 'default' : 'outline'}
          onClick={() => {
            const newLimiters = { ...limiters, peerReviewed: !limiters.peerReviewed };
            rerunActiveSearchWithLimiters(newLimiters);
          }}
          className="h-8"
        >
          {limiters.peerReviewed && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Scholarly (Peer Reviewed)
        </Button>

        <Button
          type="button"
          size="sm"
          variant={limiters.fiveCollege ? 'default' : 'outline'}
          onClick={() => {
            const newLimiters = { ...limiters, fiveCollege: !limiters.fiveCollege };
            rerunActiveSearchWithLimiters(newLimiters);
          }}
          className="h-8"
        >
          {limiters.fiveCollege && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Five College Library Catalog
        </Button>

        <Select
          value={limiters.location || '__none__'}
          onValueChange={(value) => {
            const newLimiters = {
              ...limiters,
              location: value === '__none__' ? undefined : value,
            };
            rerunActiveSearchWithLimiters(newLimiters);
          }}
        >
          <SelectTrigger className="h-8 w-[250px]">
            <SelectValue placeholder="Filter by location..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">All Locations</SelectItem>
            {LOCATIONS.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const citationVisibleResults = citationSearchGroups.reduce((total, group) => total + group.results.length, 0);
  const citationTotalHits = citationSearchGroups.reduce((total, group) => total + group.totalHits, 0);
  const citationErrorCount = citationSearchGroups.filter((group) => group.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${searchMode === 'citation' ? 'max-w-[95vw] xl:max-w-7xl max-h-[90vh]' : 'max-w-6xl max-h-[85vh]'} flex flex-col`}>
        <DialogHeader>
          <DialogTitle>Search Discover Advanced</DialogTitle>
          <DialogDescription>
            Search discovery advanced for books, articles, videos, and more
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <div className="space-y-3">
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              type="button"
              size="sm"
              variant={searchMode === 'simple' ? 'default' : 'ghost'}
              onClick={() => handleSearchModeChange('simple')}
              className="flex-1"
            >
              Simple Search
            </Button>
            <Button
              type="button"
              size="sm"
              variant={searchMode === 'citation' ? 'default' : 'ghost'}
              onClick={() => handleSearchModeChange('citation')}
              className="flex-1"
            >
              Citation Search
            </Button>
          </div>

          {/* Simple Search */}
          {searchMode === 'simple' && (
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search by title, author, ISBN, keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={searching || !searchQuery.trim()}>
                {searching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        {searchMode === 'citation' ? (
          <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
              <form onSubmit={handleCitationBatchSearch} className="border rounded-lg p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground/80 block">
                      Paste One Or More Citations
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Paste a reading list or bibliography block. Wrapped lines stay together, and each detected citation is parsed and searched separately against Discover.
                    </p>
                  </div>
                  <Textarea
                    placeholder={`Paste citations here, one per line or separated by blank lines...

Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28

Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment...`}
                    value={citationRaw}
                    onChange={(event) => setCitationRaw(event.target.value)}
                    className="flex-1 min-h-[180px] lg:min-h-[240px] max-h-full font-mono text-sm resize-none overflow-y-auto"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={searching || !citationRaw.trim()}
                  className="w-full shrink-0"
                >
                  {searching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Parsing & Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Parse & Search Citations
                    </>
                  )}
                </Button>
              </form>

              {renderLimiters()}

              {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="border rounded-lg min-h-0 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/20">
                {citationSearchGroups.length > 0 ? (
                  <div className="text-sm text-foreground/75">
                    Parsed <span className="font-semibold text-foreground">{citationSearchGroups.length}</span> citations
                    <span className="ml-2 text-foreground/60">• {citationVisibleResults} results shown</span>
                    <span className="ml-2 text-foreground/60">• {citationTotalHits.toLocaleString()} total hits</span>
                    {citationErrorCount > 0 && (
                      <span className="ml-2 text-destructive">• {citationErrorCount} citation searches failed</span>
                    )}
                    {selectedItems.size > 0 && (
                      <span className="ml-2 font-medium text-foreground">• {selectedItems.size} selected</span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Run one batch search on the left to review results citation by citation.
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1">
                {citationSearchGroups.length === 0 && !searching && !error && (
                  <div className="text-center py-16 px-6">
                    <Search className="h-12 w-12 mx-auto mb-4 text-foreground/40" />
                    <p className="text-foreground/60 text-sm">Parsed citation results will appear here in grouped sections.</p>
                  </div>
                )}

                {searching && citationSearchGroups.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-foreground/70">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <span className="text-sm">Searching each citation against Discover...</span>
                  </div>
                )}

                <div className="space-y-4 p-4">
                  {citationSearchGroups.map((group) => (
                    <section key={group.id} className="border rounded-lg overflow-hidden bg-background">
                      <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm leading-relaxed font-medium">{group.rawCitation}</p>
                            <p className="text-xs font-mono text-muted-foreground break-all">{group.matchedQuery}</p>
                            {group.matchedQuery !== group.builtQuery && (
                              <p className="text-xs text-amber-700">
                                Fallback used after trying {group.attemptedQueries.length} query variants.
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {group.totalHits.toLocaleString()} hits
                          </Badge>
                        </div>
                        {group.error ? (
                          <p className="text-sm text-destructive">{group.error}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Showing {group.results.length} of {group.totalHits.toLocaleString()} results in {group.searchTime}ms
                            {group.attemptedQueries.length > 1 && ` • ${group.attemptedQueries.length} strategies tried`}
                          </p>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        {group.results.length === 0 && !group.error && (
                          <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/20">
                            No results found for this citation after trying {group.attemptedQueries.length} search {group.attemptedQueries.length === 1 ? 'strategy' : 'strategies'}.
                          </div>
                        )}

                        {group.results.map((result) => (
                          <DiscoveryResultCard
                            key={makeCitationSelectionKey(group.id, result.id)}
                            result={result}
                            isSelected={selectedItems.has(makeCitationSelectionKey(group.id, result.id))}
                            onToggle={() => toggleItemSelection(makeCitationSelectionKey(group.id, result.id))}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <>
            {renderLimiters()}

            {totalHits > 0 && (
              <div className="text-sm text-foreground/70">
                Found <span className="font-semibold text-foreground">{totalHits.toLocaleString()}</span> results in {searchTime}ms
                {results.length < totalHits && (
                  <span className="ml-2 text-foreground/60">
                    • Showing {results.length} of {totalHits.toLocaleString()}
                  </span>
                )}
                {selectedItems.size > 0 && (
                  <span className="ml-2 font-medium text-foreground">
                    • {selectedItems.size} selected
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <ScrollArea ref={scrollRef} className="h-[400px] -mx-6 px-6">
              {results.length === 0 && !searching && !error && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto mb-4 text-foreground/40" />
                  <p className="text-foreground/60 text-sm">Enter search terms above to find library materials</p>
                </div>
              )}

              <div className="space-y-3 pb-4">
                {results.map((result) => (
                  <DiscoveryResultCard
                    key={result.id}
                    result={result}
                    isSelected={selectedItems.has(result.id)}
                    onToggle={() => toggleItemSelection(result.id)}
                  />
                ))}

                {loadingMore && (
                  <div className="flex items-center justify-center py-6 text-foreground/70">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <span className="text-sm">Loading more results...</span>
                  </div>
                )}

                {!hasMore && results.length > 0 && results.length === totalHits && (
                  <div className="text-center py-6 text-foreground/50 text-sm">
                    End of results ({totalHits.toLocaleString()} total)
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddSelected}
            disabled={selectedItems.size === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {selectedItems.size > 0 ? `${selectedItems.size} ` : ''}
            {selectedItems.size === 1 ? 'Item' : 'Items'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
