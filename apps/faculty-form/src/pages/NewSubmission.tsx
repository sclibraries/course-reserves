import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

const NewSubmission = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    courseCode: "",
    courseTitle: "",
    section: "",
    instructors: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.courseCode.trim()) {
      newErrors.courseCode = "Course code is required";
    }
    
    if (!formData.courseTitle.trim()) {
      newErrors.courseTitle = "Course title is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleCreate = () => {
    const newId = Date.now().toString();
    toast.success("Submission created successfully!");
    navigate(`/submission/${newId}/edit`);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" onClick={() => navigate("/")} className="mr-4">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Create New Course Reserve</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <div className={`h-0.5 w-16 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              2
            </div>
          </div>
        </div>

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>Course Information</CardTitle>
              <CardDescription>
                Enter your course details to get started with reserve materials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label htmlFor="instructors">Instructors</Label>
                <Input
                  id="instructors"
                  placeholder="Comma-separated names"
                  value={formData.instructors}
                  onChange={(e) => handleInputChange("instructors", e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button onClick={handleContinue}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Confirmation</CardTitle>
              <CardDescription>
                Review your submission details before creating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Course Code</p>
                  <p className="font-medium">{formData.courseCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Course Title</p>
                  <p className="font-medium">{formData.courseTitle}</p>
                </div>
                {formData.section && (
                  <div>
                    <p className="text-sm text-muted-foreground">Section</p>
                    <p className="font-medium">{formData.section}</p>
                  </div>
                )}
                {formData.instructors && (
                  <div>
                    <p className="text-sm text-muted-foreground">Instructors</p>
                    <p className="font-medium">{formData.instructors}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Term</p>
                  <Badge variant="secondary">Fall 2025</Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleCreate}>
                <Check className="mr-2 h-4 w-4" />
                Create Submission
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
};

export default NewSubmission;
