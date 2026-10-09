import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2 } from "lucide-react";
import type { CourseReserve } from "../store/courseReservesStore";

interface CourseDetailsPanelProps {
  reserve: CourseReserve;
  onEdit: () => void;
}

export const CourseDetailsPanel: React.FC<CourseDetailsPanelProps> = ({ reserve, onEdit }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Course Details</h3>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Course Code</p>
          <p className="font-medium">{reserve.courseCode}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Course Title</p>
          <p className="font-medium">{reserve.courseTitle}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Section</p>
          <p className="font-medium">{reserve.section}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Term</p>
          <Badge variant="secondary">{reserve.term}</Badge>
        </div>
      </CardContent>
    </Card>
  );
};
