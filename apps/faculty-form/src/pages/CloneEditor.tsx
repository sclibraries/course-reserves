import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ItemModal, ItemData } from "@/components/ItemModal";
import { ArrowLeft, Plus, Edit2, FileText, Calendar, Trash2, X, Pencil, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface ClonedCourse {
  courseCode: string;
  courseTitle: string;
  section: string;
  instructors: string;
  term: string;
  items: Array<{
    id: string;
    materialType: string;
    title: string;
    author: string;
    citation: string;
    sourceLink: string;
    requestType: string;
    publicNote: string;
  }>;
}

const CloneEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<(ItemData & { id: string })[]>([]);
  const [courseData, setCourseData] = useState<ClonedCourse | null>(null);
  const [originalTerm, setOriginalTerm] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(ItemData & { id: string }) | undefined>();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editedCourseData, setEditedCourseData] = useState<ClonedCourse | null>(null);
  const [courseErrors, setCourseErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const state = location.state as { clonedCourse?: ClonedCourse; originalTerm?: string } | null;
    
    if (!state?.clonedCourse) {
      toast.error("No course data found");
      navigate("/clone-previous");
      return;
    }

    setCourseData(state.clonedCourse);
    setEditedCourseData(state.clonedCourse);
    setOriginalTerm(state.originalTerm || "");
    
    // Convert items to the format expected by the editor
    const convertedItems = state.clonedCourse.items.map(item => ({
      ...item,
      neededBy: undefined // Reset needed by date for new term
    }));
    setItems(convertedItems);
  }, [location.state, navigate]);

  const handleAddItem = () => {
    setEditingItem(undefined);
    setModalOpen(true);
  };

  const handleEditItem = (item: ItemData & { id: string }) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSaveItem = (itemData: ItemData) => {
    if (editingItem) {
      setItems(items.map((item) => (item.id === editingItem.id ? { ...itemData, id: editingItem.id } : item)));
      toast.success("Item updated");
    } else {
      const newItem = { ...itemData, id: Date.now().toString() };
      setItems([...items, newItem]);
      toast.success("Item added");
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setItemToRemove(itemId);
    setShowRemoveDialog(true);
  };

  const confirmRemoveItem = () => {
    if (itemToRemove) {
      setItems(items.filter(item => item.id !== itemToRemove));
      toast.success("Item removed");
      setItemToRemove(null);
      setShowRemoveDialog(false);
    }
  };

  const handleSubmit = () => {
    if (isEditingCourse) {
      toast.error("Please save or cancel course changes before submitting");
      return;
    }
    
    if (!validateCourseData()) {
      toast.error("Please check course details for required fields");
      return;
    }
    
    setShowSubmitDialog(true);
  };

  const confirmSubmit = () => {
    const newId = Date.now().toString();
    toast.success("Course reserve created successfully!");
    navigate(`/submission/${newId}/edit`);
  };

  const handleSaveDraft = () => {
    toast.success("Cloned draft saved");
  };

  const handleEditCourse = () => {
    setIsEditingCourse(true);
    setCourseErrors({});
  };

  const handleCourseInputChange = (field: keyof ClonedCourse, value: string) => {
    if (!editedCourseData) return;
    
    setEditedCourseData({
      ...editedCourseData,
      [field]: value
    });

    // Clear error for this field
    if (courseErrors[field]) {
      setCourseErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  const validateCourseData = (): boolean => {
    if (!editedCourseData) return false;
    
    const errors: Record<string, string> = {};

    if (!editedCourseData.courseCode.trim()) {
      errors.courseCode = "Course code is required";
    }

    if (!editedCourseData.courseTitle.trim()) {
      errors.courseTitle = "Course title is required";
    }

    if (!editedCourseData.term.trim()) {
      errors.term = "Term is required";
    }

    setCourseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCourse = () => {
    if (!validateCourseData() || !editedCourseData) return;

    setCourseData(editedCourseData);
    setIsEditingCourse(false);
    toast.success("Course details updated");
  };

  const handleCancelCourseEdit = () => {
    setEditedCourseData(courseData);
    setIsEditingCourse(false);
    setCourseErrors({});
  };

  if (!courseData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/clone-previous")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Copying from {originalTerm} →</span>
                  <span className="font-semibold">{courseData.courseCode} ({courseData.term})</span>
                  <Badge variant="secondary" className="text-xs">
                    Current Term
                  </Badge>
                  {isEditingCourse && (
                    <Badge variant="outline" className="text-xs">
                      Editing
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status="draft" />
              <Button variant="ghost" onClick={handleSaveDraft} disabled={isEditingCourse}>
                Save Draft
              </Button>
              <Button onClick={handleSubmit} disabled={isEditingCourse}>
                Create Course
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          {/* Left: Course Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Course Details</h3>
                    <p className="text-sm text-muted-foreground">
                      Cloned from {originalTerm}
                    </p>
                  </div>
                  {!isEditingCourse ? (
                    <Button variant="outline" size="sm" onClick={handleEditCourse}>
                      <Pencil className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelCourseEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveCourse}>
                        <Check className="mr-2 h-3 w-3" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isEditingCourse ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Course Code</p>
                      <p className="font-medium">{courseData.courseCode}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Course Title</p>
                      <p className="font-medium">{courseData.courseTitle}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Section</p>
                      <p className="font-medium">{courseData.section || "Not specified"}</p>
                    </div>
                    {courseData.instructors && (
                      <div>
                        <p className="text-sm text-muted-foreground">Instructors</p>
                        <p className="font-medium">{courseData.instructors}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Term</p>
                      <Badge variant="secondary">{courseData.term}</Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="courseCode">
                        Course Code <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="courseCode"
                        placeholder="e.g., CSC 201"
                        value={editedCourseData?.courseCode || ""}
                        onChange={(e) => handleCourseInputChange("courseCode", e.target.value)}
                        className={courseErrors.courseCode ? "border-destructive" : ""}
                      />
                      {courseErrors.courseCode && (
                        <p className="text-sm text-destructive">{courseErrors.courseCode}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="courseTitle">
                        Course Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="courseTitle"
                        placeholder="e.g., Data Structures"
                        value={editedCourseData?.courseTitle || ""}
                        onChange={(e) => handleCourseInputChange("courseTitle", e.target.value)}
                        className={courseErrors.courseTitle ? "border-destructive" : ""}
                      />
                      {courseErrors.courseTitle && (
                        <p className="text-sm text-destructive">{courseErrors.courseTitle}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="section">Section</Label>
                      <Input
                        id="section"
                        placeholder="e.g., 01"
                        value={editedCourseData?.section || ""}
                        onChange={(e) => handleCourseInputChange("section", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instructors">Instructors</Label>
                      <Input
                        id="instructors"
                        placeholder="Comma-separated names"
                        value={editedCourseData?.instructors || ""}
                        onChange={(e) => handleCourseInputChange("instructors", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="term">
                        Term <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={editedCourseData?.term || ""}
                        onValueChange={(value) => handleCourseInputChange("term", value)}
                      >
                        <SelectTrigger className={courseErrors.term ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fall 2025">Fall 2025 (Current)</SelectItem>
                          <SelectItem value="Winter 2026">Winter 2026</SelectItem>
                          <SelectItem value="Spring 2026">Spring 2026</SelectItem>
                          <SelectItem value="Summer 2026">Summer 2026</SelectItem>
                          <SelectItem value="Fall 2026">Fall 2026</SelectItem>
                        </SelectContent>
                      </Select>
                      {courseErrors.term && (
                        <p className="text-sm text-destructive">{courseErrors.term}</p>
                      )}
                    </div>
                  </>
                )}
                
                <div>
                  <p className="text-sm text-muted-foreground">FOLIO Linkage</p>
                  <p className="text-sm">Not linked to FOLIO</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Needed By Date</p>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    Pick a date
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Clone Info */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <span>�</span>
                    Copying Materials to Current Term
                  </h4>
                  <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900 font-medium">
                      📖 Copying from: <strong>{courseData.courseCode}</strong> ({originalTerm})<br/>
                      📅 Creating for: <strong>{courseData.term}</strong> (Current Term)
                    </p>
                  </div>
                  <p className="text-sm text-blue-700">
                    📝 <strong>Edit course:</strong> Click "Edit" to update course details<br/>
                    ✏️ <strong>Edit materials:</strong> Click the edit button to modify readings<br/>
                    ❌ <strong>Remove materials:</strong> Click the X button to remove items<br/>
                    ➕ <strong>Add materials:</strong> Use "Add Item" button for new readings
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Items List */}
          <div className="space-y-4">
            {/* Instructions */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Copying from Previous Term
                </h3>
                <div className="text-sm text-green-800">
                  <p className="mb-2">
                    Materials from <strong>{originalTerm}</strong> have been copied to <strong>{courseData.term}</strong>. 
                    Review each item and make changes as needed for the new term.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>• ✏️ <strong>Edit</strong> materials to update information</div>
                    <div>• ❌ <strong>Remove</strong> materials no longer needed</div>
                    <div>• ➕ <strong>Add</strong> new materials for this term</div>
                    <div>• 💾 <strong>Save</strong> when ready to create the course</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Course Materials</h3>
                <p className="text-sm text-muted-foreground">
                  {items.length} materials copied from {originalTerm} • Review and modify as needed
                </p>
              </div>
              <Button onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Material
              </Button>
            </div>

            {items.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    All materials have been removed. Add your first reading, video, or resource.
                  </p>
                  <Button onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Material
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">{item.title}</h4>
                            {courseData.items.some(origItem => origItem.id === item.id) && (
                              <Badge variant="secondary" className="text-xs">
                                Cloned
                              </Badge>
                            )}
                          </div>
                          {item.author && (
                            <p className="text-sm text-muted-foreground">{item.author}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.materialType}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.requestType}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Item Modal */}
      <ItemModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSaveItem}
        initialData={editingItem}
      />

      {/* Remove Item Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this item from your cloned submission? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Course Reserve?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You are creating a new course reserve for {courseData.courseCode} · {courseData.term} with {items.length} materials copied from {originalTerm}.
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email"
                  checked={emailConfirmation}
                  onCheckedChange={(checked) => setEmailConfirmation(checked as boolean)}
                />
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Email me a confirmation
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>Create Course</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CloneEditor;