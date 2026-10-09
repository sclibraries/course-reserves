import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Copy, Book, Calendar, User, Eye, FileText, Link, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useCourseSearchStore, Course } from "@/store/courseSearchStore";
import { useAuthStore } from "@/store/authStore";
import { useTermsStore } from "@/store/termsStore";
import { useCourseReservesStore } from "@/store/courseReservesStore";
import { DEFAULT_CONFIG } from "@/config/endpoints";

export default function ClonePrevious() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [cloningCourse, setCloningCourse] = useState<string | null>(null);
  
  // Resource interface for course materials
  interface CourseResource {
    id: string;
    title: string;
    type: 'book' | 'article' | 'link' | 'file' | 'video' | 'other';
    author?: string;
    publicationInfo?: string;
    url?: string;
    notes?: string;
    status: 'active' | 'pending' | 'inactive';
  }

  // API response interfaces
  interface Contributor {
    name: string;
    contributorTypeId: string;
    contributorTypeText: string;
    contributorNameTypeId: string;
    primary: boolean;
  }

  interface Publication {
    publisher: string;
    place: string;
    dateOfPublication: string;
    role: string;
  }

  interface CopiedItem {
    barcode: string;
    title: string;
    contributors: Contributor[];
    publication: Publication[];
    callNumber: string;
    copy: string;
    instanceId: string;
    instanceHrid: string;
  }

  interface PhysicalReserve {
    id: string;
    courseListingId: string;
    itemId: string;
    copiedItem: CopiedItem;
    temporaryLoanTypeId: string;
  }

  interface ElectronicResource {
    resource_type: string;
    id: string;
    title: string;
    item_url?: string;
    description?: string;
    external_note?: string;
    internal_note?: string;
    folder_id?: string;
    folder_name?: string;
    course_resource_id: string;
    order: string;
  }
  
  const [courseResources, setCourseResources] = useState<CourseResource[]>([]);
  const [resourceCounts, setResourceCounts] = useState<{[courseListingId: string]: number | 'loading'}>({});
  
  const { 
    loading, 
    courses, 
    searchCoursesByInstructor, 
    clearResults 
  } = useCourseSearchStore();
  const { user, isAuthenticated } = useAuthStore();
  const { getNextTermName, getCurrentTermName } = useTermsStore();
  const { addReserve } = useCourseReservesStore();

  // Fetch functions for course resources (moved above useEffect that uses them)
  const fetchPhysicalReserves = useCallback(async (courseListingId: string): Promise<PhysicalReserve[]> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BASE_API_URL || 'https://libtools2.smith.edu'}${import.meta.env.VITE_FOLIO_PATH || '/folio/web'}/search/search-course-listings?courseListingId=${courseListingId}`,
        {
          method: 'GET',
          ...DEFAULT_CONFIG,
          mode: 'cors',
          credentials: 'omit'
        }
      );
      
      if (!response.ok) {
        throw new Error(`Physical reserves API error: ${response.status} ${response.statusText}`);
      }
      
      const results = await response.json();
      return results.data?.reserves || [];
    } catch (error) {
      console.error('Failed to fetch physical reserves:', error);
      return [];
    }
  }, []);

  const fetchElectronicResources = useCallback(async (courseListingId: string): Promise<ElectronicResource[]> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BASE_API_URL || 'https://libtools2.smith.edu'}${import.meta.env.VITE_COURSE_RESERVES_PATH || '/course-reserves/backend/web'}/course/get-merged-resources?courseListingId=${courseListingId}`,
        {
          method: 'GET',
          ...DEFAULT_CONFIG,
          mode: 'cors',
          credentials: 'omit'
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return []; // No electronic resources found
        }
        throw new Error(`Electronic resources API error: ${response.status} ${response.statusText}`);
      }
      
      const json = await response.json();
      return json.resources || [];
    } catch (error) {
      console.warn('Failed to fetch electronic resources:', error);
      return [];
    }
  }, []);

  // Auto-search when component mounts if user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.full_name) {
      searchCoursesByInstructor(user.full_name);
    }
  }, [isAuthenticated, user?.full_name, searchCoursesByInstructor]);

  // Fetch resource counts when courses change
  useEffect(() => {
    const fetchResourceCount = async (courseListingId: string): Promise<number> => {
      try {
        const [physicalReserves, electronicResources] = await Promise.all([
          fetchPhysicalReserves(courseListingId),
          fetchElectronicResources(courseListingId)
        ]);
        
        return physicalReserves.length + electronicResources.length;
      } catch (error) {
        console.error('Failed to fetch resource count:', error);
        return 0;
      }
    };

    const loadResourceCounts = async () => {
      if (courses.length === 0) return;

      // Set all courses to loading state
      const loadingState = courses.reduce((acc, course) => {
        acc[course.courseListingId] = 'loading';
        return acc;
      }, {} as {[key: string]: 'loading'});
      setResourceCounts(loadingState);

      // Fetch counts for all courses in parallel
      const countPromises = courses.map(async (course) => {
        const count = await fetchResourceCount(course.courseListingId);
        return { courseListingId: course.courseListingId, count };
      });

      // Update counts as they come in
      const results = await Promise.allSettled(countPromises);
      const newCounts: {[key: string]: number} = {};
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          newCounts[result.value.courseListingId] = result.value.count;
        } else {
          // Set to 0 if failed to fetch
          newCounts[courses[index].courseListingId] = 0;
        }
      });

      setResourceCounts(newCounts);
    };

    loadResourceCounts();
  }, [courses, fetchPhysicalReserves, fetchElectronicResources]);

  // Filter courses based on search query (local filtering, no API calls)
  const filteredCourses = courses.filter(course => {
    if (!searchQuery.trim()) return true;
    
    const courseName = course.name?.toLowerCase() || '';
    const searchTerm = searchQuery.toLowerCase();
    
    // Only search course titles/names
    return courseName.includes(searchTerm);
  });

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleCloneCourse = async (course: Course) => {
    setCloningCourse(course.id);
    
    try {
      console.log("Cloning course:", course);
      
      // Fetch the course resources first
      const courseListingId = course.courseListingId;
      const [physicalReserves, electronicResources] = await Promise.all([
        fetchPhysicalReserves(courseListingId),
        fetchElectronicResources(courseListingId)
      ]);

      // Convert course resources to CourseItem format
      const clonedItems = [];

      // Process physical reserves from FOLIO
      physicalReserves.forEach((reserve, index) => {
        const item = reserve.copiedItem;
        if (item) {
          // Get primary author
          const primaryAuthor = item.contributors?.find((c) => c.primary)?.name || 
                               item.contributors?.[0]?.name || 
                               '';
          
          // Get publication info
          const pubInfo = item.publication?.[0];
          
          clonedItems.push({
            id: `cloned-book-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            title: item.title || 'Untitled Item',
            authors: primaryAuthor,
            materialType: 'book' as const,
            status: 'draft' as const,
            priority: 'medium' as const,
            isbn: '', // Not available in current API
            publisher: pubInfo?.publisher || '',
            publicationYear: pubInfo?.dateOfPublication || '',
            pages: '',
            notes: `Call Number: ${item.callNumber || 'N/A'} | Barcode: ${item.barcode || 'N/A'}`,
          });
        }
      });

      // Process electronic resources from SQL backend
      electronicResources.forEach((resource, index) => {
        let materialType: 'article' | 'video' | 'website' | 'other' = 'other';
        
        // Determine material type based on URL or description
        if (resource.item_url) {
          if (resource.item_url.includes('youtube') || resource.item_url.includes('video')) {
            materialType = 'video';
          } else if (resource.item_url.includes('ebsco') || resource.item_url.includes('journal')) {
            materialType = 'article';
          } else {
            materialType = 'website';
          }
        }

        clonedItems.push({
          id: `cloned-${materialType}-${Date.now()}-${physicalReserves.length + index}-${Math.random().toString(36).substr(2, 9)}`,
          title: resource.title || 'Untitled Resource',
          materialType,
          status: 'draft' as const,
          priority: 'medium' as const,
          url: resource.item_url || '',
          notes: [
            resource.description,
            resource.external_note,
            resource.internal_note,
            resource.folder_name ? `Folder: ${resource.folder_name}` : null
          ].filter(Boolean).join(' | ') || '',
        });
      });

      // Create new course reserve
      const nextTerm = getNextTermName() || getCurrentTermName() || '2025 Spring';
      const newReserveId = addReserve({
        courseCode: course.courseNumber || course.name || 'Unknown Course',
        courseTitle: course.name || 'Unknown Course',
        section: '01', // Default section
        instructors: course.courseListingObject?.instructorObjects?.[0]?.name || user?.full_name || 'Unknown Instructor',
        term: nextTerm,
        status: 'draft',
        items: clonedItems,
      });

      // Close preview dialog if open
      setPreviewOpen(false);
      
      // Show success message
      toast.success(`Successfully cloned ${clonedItems.length} resources from ${course.courseNumber || course.name}`);
      
      // Navigate to the submission editor
      navigate(`/submission/${newReserveId}/edit`);
      
    } catch (error) {
      console.error('Failed to clone course:', error);
      toast.error('Failed to clone course. Please try again.');
    } finally {
      setCloningCourse(null);
    }
  };



  const handlePreviewCourse = async (course: Course) => {
    setSelectedCourse(course);
    setPreviewOpen(true);
    setLoadingResources(true);
    
    try {
      const courseListingId = course.courseListingId;
      console.log('Fetching resources for course listing ID:', courseListingId);
      
      // Fetch both physical and electronic resources in parallel
      const [physicalReserves, electronicResources] = await Promise.all([
        fetchPhysicalReserves(courseListingId),
        fetchElectronicResources(courseListingId)
      ]);

      console.log('Physical reserves:', physicalReserves.length);
      console.log('Electronic resources:', electronicResources.length);

      const resources: CourseResource[] = [];

      // Process physical reserves from FOLIO
      physicalReserves.forEach((reserve: PhysicalReserve) => {
        const item = reserve.copiedItem;
        if (item) {
          // Get primary author
          const primaryAuthor = item.contributors?.find((c: Contributor) => c.primary)?.name || 
                               item.contributors?.[0]?.name || 
                               'Unknown Author';
          
          // Get publication info
          const pubInfo = item.publication?.[0];
          let publicationInfo = '';
          if (pubInfo) {
            const parts = [];
            if (pubInfo.publisher) parts.push(pubInfo.publisher);
            if (pubInfo.place) parts.push(pubInfo.place);
            if (pubInfo.dateOfPublication) parts.push(pubInfo.dateOfPublication);
            publicationInfo = parts.join(', ');
          }

          resources.push({
            id: reserve.id,
            title: item.title || 'Untitled Item',
            type: 'book',
            author: primaryAuthor,
            publicationInfo: publicationInfo || undefined,
            notes: `Call Number: ${item.callNumber || 'N/A'} | Barcode: ${item.barcode || 'N/A'}`,
            status: 'active'
          });
        }
      });

      // Process electronic resources from SQL backend
      electronicResources.forEach((resource: ElectronicResource) => {
        let resourceType: CourseResource['type'] = 'other';
        
        // Determine resource type based on URL or description
        if (resource.item_url) {
          if (resource.item_url.includes('youtube') || resource.item_url.includes('video')) {
            resourceType = 'video';
          } else if (resource.item_url.includes('ebsco') || resource.item_url.includes('journal')) {
            resourceType = 'article';
          } else {
            resourceType = 'link';
          }
        } else {
          resourceType = 'file';
        }

        resources.push({
          id: resource.id,
          title: resource.title || 'Untitled Resource',
          type: resourceType,
          url: resource.item_url || undefined,
          notes: [
            resource.description,
            resource.external_note,
            resource.internal_note,
            resource.folder_name ? `Folder: ${resource.folder_name}` : null
          ].filter(Boolean).join(' | ') || undefined,
          status: 'active'
        });
      });

      console.log('Total processed resources:', resources.length);
      setCourseResources(resources);
      
    } catch (error) {
      console.error('Failed to load course resources:', error);
      setCourseResources([]);
    } finally {
      setLoadingResources(false);
    }
  };

  const formatCourseDisplay = (course: Course) => {
    const courseTitle = course.name || 'Unknown Course';
    const courseNumber = course.courseNumber || 'N/A';
    const departmentName = course.departmentObject?.name || 'Unknown Department';
    
    const instructors = course.courseListingObject?.instructorObjects || [];
    const instructorNames = instructors.length > 0 
      ? instructors.map(instructor => instructor.name).join(', ')
      : 'Unknown Instructor';
    
    const termName = course.courseListingObject?.termObject?.name || 'Unknown Term';
    
    // Get actual resource count from state, default to loading state
    const resourceCount = resourceCounts[course.courseListingId] ?? 'loading';
    
    return {
      id: course.id,
      courseNumber,
      courseTitle,
      departmentName,
      instructor: instructorNames,
      term: termName,
      resourceCount, // Real count from API
      courseListingId: course.courseListingId // Include for resource fetching
    };
  };

  // Group courses by term for better organization
  const groupCoursesByTerm = (courses: Course[]) => {
    type DisplayCourse = {
      id: string;
      courseNumber: string;
      courseTitle: string;
      departmentName: string;
      instructor: string;
      term: string;
      resourceCount: number | 'loading';
    };
    
    const grouped = courses.reduce((acc, course) => {
      const displayCourse = formatCourseDisplay(course);
      const termName = displayCourse.term;
      
      if (!acc[termName]) {
        acc[termName] = [];
      }
      acc[termName].push({ course, displayCourse });
      return acc;
    }, {} as Record<string, Array<{ course: Course; displayCourse: DisplayCourse }>>);

    // Sort terms by recency (most recent first)
    const sortedTerms = Object.entries(grouped).sort(([termA], [termB]) => {
      // Better sorting logic for academic terms
      // Extract year and season for proper chronological sorting
      const parseTermYear = (term: string) => {
        const match = term.match(/(\d{4})/);
        return match ? parseInt(match[1]) : 0;
      };
      
      const yearA = parseTermYear(termA);
      const yearB = parseTermYear(termB);
      
      // Sort by year first (most recent first)
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      
      // If same year, sort by season (Fall > Summer > Spring > Winter)
      const seasonOrder = { 'Fall': 4, 'Summer': 3, 'Spring': 2, 'Winter': 1 };
      const getSeasonValue = (term: string) => {
        for (const [season, value] of Object.entries(seasonOrder)) {
          if (term.toLowerCase().includes(season.toLowerCase())) {
            return value;
          }
        }
        return 0;
      };
      
      return getSeasonValue(termB) - getSeasonValue(termA);
    });

    return sortedTerms;
  };

  // Resource type icons and labels
  const getResourceIcon = (type: CourseResource['type']) => {
    switch (type) {
      case 'book': return <Book className="h-4 w-4" />;
      case 'article': return <FileText className="h-4 w-4" />;
      case 'link': return <Link className="h-4 w-4" />;
      case 'file': return <Download className="h-4 w-4" />;
      case 'video': return <Eye className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getResourceTypeLabel = (type: CourseResource['type']) => {
    switch (type) {
      case 'book': return 'Book';
      case 'article': return 'Article';
      case 'link': return 'Link';
      case 'file': return 'File';
      case 'video': return 'Video';
      default: return 'Resource';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground">
            Please log in to view and clone your previous courses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Clone from Previous Courses</h1>
        <p className="text-muted-foreground mb-6">
          Find your previous courses and copy their resources to create a new course reserves submission.
        </p>

        <div className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter courses by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchQuery && (
            <Button variant="outline" onClick={handleClearSearch}>
              Clear Filter
            </Button>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            How to Clone a Course
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Use the filter above to search course titles and narrow down the list</li>
            <li>• Click "Preview" to see course resources before cloning</li>
            <li>• Click "Clone" to copy resources to a new submission for the {getNextTermName() || getCurrentTermName() || "next term"}</li>
            <li>• You can edit and modify the cloned resources before submitting</li>
          </ul>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p>Searching for courses...</p>
        </div>
      )}

      {courses.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {searchQuery ? `${filteredCourses.length} of ${courses.length}` : courses.length} Course{courses.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {searchQuery ? filteredCourses.length : courses.length} result{(searchQuery ? filteredCourses.length : courses.length) !== 1 ? 's' : ''}
              </Badge>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Sorted by term and course name
              </span>
            </div>
          </div>

          {/* Courses Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Term</TableHead>
                  <TableHead className="w-[100px]">Course #</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="w-[200px]">Instructor(s)</TableHead>
                  <TableHead className="w-[100px] text-center">Resources</TableHead>
                  <TableHead className="w-[200px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupCoursesByTerm(filteredCourses).map(([termName, termCourses]) => 
                  termCourses.map(({ course, displayCourse }, index) => (
                    <TableRow key={`${termName}-${displayCourse.id || index}`} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="text-xs">
                          {displayCourse.term}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {displayCourse.courseNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{displayCourse.courseTitle}</div>
                          <div className="text-sm text-muted-foreground">{displayCourse.departmentName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{displayCourse.instructor}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {displayCourse.resourceCount === 'loading' ? (
                            <div className="flex items-center gap-1">
                              <div className="inline-block animate-spin rounded-full h-2 w-2 border-b border-current"></div>
                              Loading
                            </div>
                          ) : (
                            displayCourse.resourceCount
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button 
                            onClick={() => handlePreviewCourse(course)}
                            variant="outline"
                            size="sm"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview & Copy
                          </Button>
                          <Button 
                            onClick={() => handleCloneCourse(course)}
                            size="sm"
                            disabled={cloningCourse === course.id}
                          >
                            {cloningCourse === course.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                                Cloning...
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Clone
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div className="text-center py-12">
          <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Courses Found</h3>
          <p className="text-muted-foreground mb-4">
            No courses available to clone. This could mean you haven't taught any courses yet, or there may be an issue loading your course history.
          </p>
        </div>
      )}

      {!loading && courses.length > 0 && filteredCourses.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Matches Found</h3>
          <p className="text-muted-foreground mb-4">
            No courses match "{searchQuery}". Try a different search term or clear the filter to see all courses.
          </p>
          <Button variant="outline" onClick={handleClearSearch}>
            Clear Filter
          </Button>
        </div>
      )}

      {/* Course Resources Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Course Resources Preview
              {selectedCourse && (
                <Badge variant="outline" className="ml-2">
                  {formatCourseDisplay(selectedCourse).courseNumber} - {formatCourseDisplay(selectedCourse).courseTitle}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {loadingResources ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-center">
                  Loading course resources...
                  <br />
                  <span className="text-sm text-muted-foreground mt-1">
                    Fetching physical reserves from FOLIO and electronic resources from course database
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {courseResources.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p>No resources found for this course.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {courseResources.length} resource{courseResources.length !== 1 ? 's' : ''} found
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        Preview Mode
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {courseResources.map((resource, index) => (
                        <Card key={resource.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {getResourceIcon(resource.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm leading-tight">
                                    {resource.title}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {getResourceTypeLabel(resource.type)}
                                    </Badge>
                                    <Badge 
                                      variant={resource.status === 'active' ? 'default' : resource.status === 'pending' ? 'secondary' : 'destructive'} 
                                      className="text-xs"
                                    >
                                      {resource.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              {resource.author && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  <strong>Author:</strong> {resource.author}
                                </p>
                              )}
                              
                              {resource.publicationInfo && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <strong>Publication:</strong> {resource.publicationInfo}
                                </p>
                              )}
                              
                              {resource.url && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <strong>URL:</strong> 
                                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                                    {resource.url}
                                  </a>
                                </p>
                              )}
                              
                              {resource.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <strong>Notes:</strong> {resource.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          {index < courseResources.length - 1 && <Separator className="mt-3" />}
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
          
          {/* Dialog Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Preview the resources above, then clone if they match your needs.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Cancel
              </Button>
              {selectedCourse && (
                <Button 
                  onClick={() => handleCloneCourse(selectedCourse)}
                  disabled={cloningCourse === selectedCourse.id}
                >
                  {cloningCourse === selectedCourse.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                      Cloning Course...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Clone This Course
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
