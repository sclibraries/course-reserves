import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Loader2,
  Plus,
  AlertCircle,
  Sparkles,
  X
} from "lucide-react";
import type { CourseItem } from "@/store/courseReservesStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { extractCitationsFromSyllabus } from "@/utils/syllabusCitationExtractor";

interface SyllabusUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsExtracted: (items: Partial<CourseItem>[]) => void;
}

export function SyllabusUploadDialog({
  open,
  onOpenChange,
  onItemsExtracted
}: SyllabusUploadDialogProps) {
  const [syllabusText, setSyllabusText] = useState("");
  const [extractedCitations, setExtractedCitations] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [hasAttemptedExtraction, setHasAttemptedExtraction] = useState(false);

  const extractCitations = () => {
    if (!syllabusText.trim()) return;

    setProcessing(true);
    setHasAttemptedExtraction(true);
    
    try {
      setExtractedCitations(extractCitationsFromSyllabus(syllabusText));
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCitations = () => {
    const items: Partial<CourseItem>[] = extractedCitations.map(citation => {
      // Use the full citation as the title (truncated if too long)
      const title = citation.length > 200 ? citation.substring(0, 200) + '...' : citation;
      
      // Determine material type from citation keywords and patterns
      let materialType: CourseItem['materialType'] = 'other';
      const citationLower = citation.toLowerCase();
      
      // Legal cases (contains " v. " and legal reporters)
      if (/\bv\.\s+[A-Z]/i.test(citation) && /\b\d+\s+[A-Z][\w.]+\s+\d+/.test(citation)) {
        materialType = 'book'; // Legal cases typically treated as book items
      }
      // Videos/films
      else if (citationLower.includes('video') || citationLower.includes('film') || citationLower.includes('dvd')) {
        materialType = 'video';
      }
      // Journal articles
      else if (citationLower.includes('journal') && !citationLower.includes('press')) {
        materialType = 'article';
      }
      // Websites
      else if (citationLower.includes('http') || citationLower.includes('www.')) {
        materialType = 'website';
      }
      // Book chapters
      else if (citationLower.includes('chapter') || /\bin\s+[A-Z].*\(ed[s]?\.\)/i.test(citation)) {
        materialType = 'chapter';
      }
      // Default to book for citations with year and author
      else if (/\([12]\d{3}\)/.test(citation) || /^[A-Z][a-zA-Z'-]+,\s+[A-Z]/.test(citation)) {
        materialType = 'book';
      }

      return {
        title: title,
        materialType,
        status: 'draft',
        notes: citation
      };
    });

    onItemsExtracted(items);
    onOpenChange(false);
    
    // Reset all state
    setSyllabusText("");
    setExtractedCitations([]);
    setHasAttemptedExtraction(false);
  };

  const handleRemoveCitation = (index: number) => {
    setExtractedCitations(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAndRestart = () => {
    setExtractedCitations([]);
    setHasAttemptedExtraction(false);
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Paste Syllabus Citations</DialogTitle>
          <DialogDescription>
            Copy and paste your reading list or bibliography. We'll help you extract individual citations.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-0">
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              <strong>Tip:</strong> Paste your citations below. Put a blank line between each citation - we'll automatically merge multi-line citations.
            </AlertDescription>
          </Alert>

          {/* Text Input */}
          <div className="space-y-2 flex-1">
            <label className="text-sm font-medium">Paste Your Reading List (Blank Line Between Citations)</label>
            <Textarea
              placeholder={`Paste your citations here - separate each citation with a blank line...

Example:

Becker, Gary (1968) "Crime and Punishment: An Economics Analysis," 
Journal of Political Economy, Vol. 76, pp. 169-217.

Stigler, George (1970) "The Optimum Enforcement of Laws," 
Journal of Political Economy, Vol. 78, pp. 526-536.`}
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              className="min-h-[400px] font-mono text-sm resize-none"
            />
          </div>

          {/* Extracted Citations */}
          {extractedCitations.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Found {extractedCitations.length} citation{extractedCitations.length !== 1 ? 's' : ''}
                </h3>
                <Button size="sm" variant="outline" onClick={handleClearAndRestart}>
                  Clear & Re-extract
                </Button>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {extractedCitations.map((citation, index) => (
                  <div key={index} className="text-sm p-3 bg-muted rounded-md flex items-start gap-2 group">
                    <span className="flex-shrink-0 font-mono text-xs text-muted-foreground mt-0.5">
                      {index + 1}.
                    </span>
                    <p className="flex-1 text-sm">{citation}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveCitation(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Review the citations above. Click the × to remove any incorrectly detected items. 
                  Each will be added as a separate reserve item (you can edit details after adding).
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {/* Warning if no citations found after extraction attempt */}
          {hasAttemptedExtraction && extractedCitations.length === 0 && !processing && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>No citations detected.</strong> Try adding blank lines between each citation, 
                or make sure each citation includes a year (e.g., "1970" or "(1970)").
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer with actions */}
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {syllabusText && extractedCitations.length === 0 && (
            <Button onClick={extractCitations} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Extract Citations ({syllabusText.split('\n').filter(l => l.trim().length > 20).length} lines)
                </>
              )}
            </Button>
          )}
          
          {extractedCitations.length > 0 && (
            <Button onClick={handleAddCitations}>
              <Plus className="h-4 w-4 mr-2" />
              Add All to Course ({extractedCitations.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
