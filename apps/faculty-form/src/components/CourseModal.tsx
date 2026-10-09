import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTermsStore } from "@/store/termsStore";
import { Loader2 } from "lucide-react";

export interface CourseData {
  courseCode: string;
  courseTitle: string;
  section: string;
  instructors: string;
  term: string;
}

interface CourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (course: CourseData) => void;
  initialData?: CourseData;
  isEditing?: boolean;
}

export const CourseModal = ({ open, onOpenChange, onSave, initialData, isEditing = false }: CourseModalProps) => {
  const { 
    terms, 
    loading, 
    error, 
    fetchTerms, 
    getNextTermName, 
    getAvailableTerms,
    getOrderedTerms,
    refreshTermsIfStale 
  } = useTermsStore();
  
  const [formData, setFormData] = useState<CourseData>({
    courseCode: "",
    courseTitle: "",
    section: "",
    instructors: "",
    term: "", // Will be set when terms are loaded
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load terms when modal opens
  useEffect(() => {
    if (open) {
      refreshTermsIfStale();
    }
  }, [open, refreshTermsIfStale]);

  // Initialize form state once per modal open to avoid overriding user edits
  const didInitRef = useRef(false);
  useEffect(() => {
    if (open && !didInitRef.current) {
      if (initialData) {
        setFormData(initialData);
      } else if (terms.length > 0 && !isEditing) {
        // Only set default term for new courses, not when editing
        const defaultTerm = getNextTermName();
        setFormData(prev => ({ ...prev, term: defaultTerm }));
      }
      didInitRef.current = true;
    }
  }, [open, initialData, terms, getNextTermName, isEditing]);

  // Reset the init guard when modal closes
  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
    }
  }, [open]);

  const handleInputChange = (field: keyof CourseData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.courseCode.trim()) {
      newErrors.courseCode = "Course code is required";
    }

    if (!formData.courseTitle.trim()) {
      newErrors.courseTitle = "Course title is required";
    }

    if (!formData.term.trim()) {
      newErrors.term = "Term is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    onSave(formData);
    
    // Reset form
    const defaultTerm = getNextTermName();
    setFormData({
      courseCode: "",
      courseTitle: "",
      section: "",
      instructors: "",
      term: defaultTerm,
    });
    setErrors({});
    
    onOpenChange(false);
    toast.success("Course created successfully!");
  };

  const handleCancel = () => {
    // Reset form only if not editing
    if (!isEditing) {
      const defaultTerm = getNextTermName();
      setFormData({
        courseCode: "",
        courseTitle: "",
        section: "",
        instructors: "",
        term: defaultTerm,
      });
    }
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Course Details' : 'Create New Course Reserve'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courseCode">
              Course Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="courseCode"
              placeholder="e.g., CSC 201"
              value={formData.courseCode}
              onChange={(e) => handleInputChange("courseCode", e.target.value)}
              className={errors.courseCode ? "border-destructive" : ""}
            />
            {errors.courseCode && (
              <p className="text-sm text-destructive">{errors.courseCode}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseTitle">
              Course Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="courseTitle"
              placeholder="e.g., Data Structures"
              value={formData.courseTitle}
              onChange={(e) => handleInputChange("courseTitle", e.target.value)}
              className={errors.courseTitle ? "border-destructive" : ""}
            />
            {errors.courseTitle && (
              <p className="text-sm text-destructive">{errors.courseTitle}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              placeholder="e.g., 01"
              value={formData.section}
              onChange={(e) => handleInputChange("section", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructors">
              Faculty/Instructors 
              {isEditing && <span className="text-xs font-normal text-muted-foreground ml-1">(add co-instructors if needed)</span>}
            </Label>
            <Input
              id="instructors"
              placeholder="e.g., Dr. Smith, Prof. Johnson"
              value={formData.instructors}
              onChange={(e) => handleInputChange("instructors", e.target.value)}
              className={errors.instructors ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple instructors with commas. Include titles if preferred.
            </p>
            {errors.instructors && (
              <p className="text-sm text-destructive">{errors.instructors}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="term">
              Term <span className="text-destructive">*</span>
            </Label>
            {loading ? (
              <div className="flex items-center gap-2 p-2 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading terms...</span>
              </div>
            ) : error ? (
              <div className="p-2 border rounded-md bg-destructive/10">
                <p className="text-sm text-destructive">Error loading terms: {error}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchTerms}
                  className="mt-1 h-auto p-0 text-xs"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <Select
                value={formData.term}
                onValueChange={(value) => handleInputChange("term", value)}
                disabled={terms.length === 0}
              >
                <SelectTrigger className={errors.term ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableTerms().map((term, index) => {
                    const isNext = term.name === getNextTermName();
                    return (
                      <SelectItem key={term.id} value={term.name}>
                        {term.name} 
                        {isNext && " (Default)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {errors.term && (
              <p className="text-sm text-destructive">{errors.term}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Create Course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};