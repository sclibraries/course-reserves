import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { useCourseReservesStore } from "../store/courseReservesStore";
import { useTermsStore } from "../store/termsStore";
import { useAuthStore } from "../store/authStore";
import { toast } from "sonner";

interface CourseMatch {
  nextTermCourse: {
    id: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    term: string;
    instructors: string;
  };
  previousCourses: Array<{
    id: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    term: string;
    itemCount: number;
    matchScore: number; // 0-100, how well it matches
    matchReason: string;
  }>;
  selectedPreviousId?: string;
}

const CloneMatchingTest = () => {
  const navigate = useNavigate();
  const { reserves, cloneReserve, getReserveStats } = useCourseReservesStore();
  const { getNextTermName, getCurrentTermName } = useTermsStore();
  const { user } = useAuthStore();
  
  const [matches, setMatches] = useState<CourseMatch[]>([]);
  const [processing, setProcessing] = useState(false);

  // Calculate matching score between two course codes
  const calculateMatchScore = (nextCode: string, prevCode: string): { score: number; reason: string } => {
    // Exact match
    if (nextCode === prevCode) {
      return { score: 100, reason: "Exact course code match" };
    }

    // Extract department and number (e.g., "CSC 201" -> ["CSC", "201"])
    const extractParts = (code: string) => {
      const match = code.match(/^([A-Z]+)\s*(\d+[A-Z]?)/i);
      if (match) {
        return { dept: match[1].toUpperCase(), number: match[2] };
      }
      return null;
    };

    const nextParts = extractParts(nextCode);
    const prevParts = extractParts(prevCode);

    if (!nextParts || !prevParts) {
      return { score: 0, reason: "Cannot parse course codes" };
    }

    // Same department and number
    if (nextParts.dept === prevParts.dept && nextParts.number === prevParts.number) {
      return { score: 95, reason: "Same department and course number" };
    }

    // Same department, different number
    if (nextParts.dept === prevParts.dept) {
      return { score: 30, reason: "Same department, different course number" };
    }

    return { score: 0, reason: "No match" };
  };

  // Find matching courses
  useEffect(() => {
    const nextTerm = getNextTermName();
    
    // Get courses for next term (these would normally come from registrar)
    const nextTermCourses = reserves.filter(r => r.term === nextTerm);
    
    // Get previous term courses
    const previousCourses = reserves.filter(r => r.term !== nextTerm);

    const courseMatches: CourseMatch[] = nextTermCourses.map(nextCourse => {
      // Find potential matches from previous terms
      const potentialMatches = previousCourses.map(prevCourse => {
        const { score, reason } = calculateMatchScore(
          nextCourse.courseCode,
          prevCourse.courseCode
        );
        
        const stats = getReserveStats(prevCourse.id);
        
        return {
          id: prevCourse.id,
          courseCode: prevCourse.courseCode,
          courseTitle: prevCourse.courseTitle,
          section: prevCourse.section,
          term: prevCourse.term,
          itemCount: stats.totalItems,
          matchScore: score,
          matchReason: reason,
        };
      })
      // Only include reasonable matches
      .filter(m => m.matchScore > 20)
      // Sort by match score
      .sort((a, b) => b.matchScore - a.matchScore);

      return {
        nextTermCourse: {
          id: nextCourse.id,
          courseCode: nextCourse.courseCode,
          courseTitle: nextCourse.courseTitle,
          section: nextCourse.section,
          term: nextCourse.term,
          instructors: nextCourse.instructors,
        },
        previousCourses: potentialMatches,
        // Auto-select best match if score is high enough
        selectedPreviousId: potentialMatches[0]?.matchScore >= 90 ? potentialMatches[0].id : undefined,
      };
    });

    setMatches(courseMatches);
  }, [reserves, getNextTermName, getReserveStats]);

  const handleSelectPrevious = (matchIndex: number, previousId: string) => {
    setMatches(prev => prev.map((match, idx) => 
      idx === matchIndex 
        ? { ...match, selectedPreviousId: previousId }
        : match
    ));
  };

  const handleCloneSelected = async (match: CourseMatch) => {
    if (!match.selectedPreviousId) {
      toast.error("Please select a previous course to clone from");
      return;
    }

    setProcessing(true);
    try {
      const newReserveId = cloneReserve(match.selectedPreviousId, {
        courseCode: match.nextTermCourse.courseCode,
        courseTitle: match.nextTermCourse.courseTitle,
        section: match.nextTermCourse.section,
        instructors: match.nextTermCourse.instructors,
        term: match.nextTermCourse.term,
      });

      toast.success("Course materials cloned successfully!");
      navigate(`/submission/${newReserveId}/edit`);
    } catch (error) {
      console.error("Failed to clone course:", error);
      toast.error("Failed to clone course materials");
    } finally {
      setProcessing(false);
    }
  };

  const getMatchBadgeVariant = (score: number): "default" | "secondary" | "outline" => {
    if (score >= 90) return "default";
    if (score >= 50) return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Clone Matching Test</h1>
            </div>
            <Badge variant="secondary">Debug Mode</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Course Matching & Cloning</h2>
          <p className="text-muted-foreground">
            This test interface shows how courses from the next term can be matched with previous courses for cloning materials.
          </p>
        </div>

        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900 text-base">How Matching Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <div><strong>100 points:</strong> Exact course code match (e.g., CSC 201 → CSC 201)</div>
            <div><strong>95 points:</strong> Same department and number, different formatting</div>
            <div><strong>30 points:</strong> Same department, different course number</div>
            <div><strong>&lt;20 points:</strong> No reasonable match (not shown)</div>
          </CardContent>
        </Card>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Courses to Match</h3>
              <p className="text-muted-foreground mb-4">
                Create some courses for {getNextTermName()} and have some previous term courses to see matching.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate("/")}>
                  Go to Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate("/clone-previous")}>
                  View Previous Courses
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {matches.map((match, matchIndex) => (
              <Card key={match.nextTermCourse.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg mb-1">
                        {match.nextTermCourse.courseCode} - {match.nextTermCourse.courseTitle}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Section {match.nextTermCourse.section} • {match.nextTermCourse.term}</div>
                        <div>{match.nextTermCourse.instructors}</div>
                      </div>
                    </div>
                    {match.selectedPreviousId && (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Match Selected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {match.previousCourses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No matching previous courses found</p>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-semibold mb-3">
                        Potential Matches ({match.previousCourses.length})
                      </h4>
                      <div className="space-y-3">
                        {match.previousCourses.map((prevCourse) => (
                          <div
                            key={prevCourse.id}
                            className={`
                              border rounded-lg p-4 transition-all cursor-pointer
                              ${match.selectedPreviousId === prevCourse.id 
                                ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                                : 'hover:border-primary/50 hover:bg-accent/50'}
                            `}
                            onClick={() => handleSelectPrevious(matchIndex, prevCourse.id)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="font-medium">
                                    {prevCourse.courseCode} - {prevCourse.courseTitle}
                                  </h5>
                                  <Badge variant={getMatchBadgeVariant(prevCourse.matchScore)}>
                                    {prevCourse.matchScore}% match
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div>Section {prevCourse.section} • {prevCourse.term}</div>
                                  <div className="flex items-center gap-2">
                                    <span>{prevCourse.itemCount} materials</span>
                                    <span>•</span>
                                    <span className="italic">{prevCourse.matchReason}</span>
                                  </div>
                                </div>
                              </div>
                              {match.selectedPreviousId === prevCourse.id && (
                                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {match.selectedPreviousId && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            onClick={() => handleCloneSelected(match)}
                            disabled={processing}
                            className="gap-2"
                          >
                            <Copy className="h-4 w-4" />
                            Clone Materials & Edit
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Debug Info */}
        <Card className="mt-6 bg-slate-50">
          <CardHeader>
            <CardTitle className="text-base">Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Next Term:</strong> {getNextTermName()}</div>
            <div><strong>Current Term:</strong> {getCurrentTermName()}</div>
            <div><strong>Total Reserves:</strong> {reserves.length}</div>
            <div><strong>Next Term Courses:</strong> {matches.length}</div>
            <div><strong>User:</strong> {user?.full_name || 'Not logged in'}</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CloneMatchingTest;
