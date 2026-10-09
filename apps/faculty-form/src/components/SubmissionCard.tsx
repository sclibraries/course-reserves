import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, SubmissionStatus } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface Submission {
  id: string;
  courseCode: string;
  courseTitle: string;
  term: string;
  status: SubmissionStatus;
  totalItems: number;
  completeItems: number;
  inProgressItems: number;
  needsReviewItems: number;
  lastUpdated: string;
  isLocked?: boolean;
}

interface SubmissionCardProps {
  submission: Submission;
  onDelete?: (id: string) => void;
}

export const SubmissionCard = ({ submission, onDelete }: SubmissionCardProps) => {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (submission.status === "draft") {
      navigate(`/submission/${submission.id}/edit`);
    } else {
      navigate(`/submission/${submission.id}`);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleOpen}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight truncate">
              {submission.courseCode} · {submission.courseTitle}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {submission.term}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {submission?.isLocked && (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 text-xs"
                title="This submission is locked by library staff"
              >
                Locked
              </Badge>
            )}
            <StatusBadge status={submission.status} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Items: {submission.totalItems} · {submission.completeItems} complete · {submission.inProgressItems} in progress · {submission.needsReviewItems} needs review
        </p>
        <p className="text-xs text-muted-foreground">
          Last updated: {submission.lastUpdated}
        </p>
      </CardContent>

      <CardFooter className="gap-2">
        <Button 
          variant="default" 
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
        >
          Open
        </Button>
        <Button 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
        >
          View Status
        </Button>
        {submission.status === "draft" && (
          <>
            <Button 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/submission/${submission.id}/edit`);
              }}
            >
              Continue Editing
            </Button>
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Course Reserve</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{submission.courseCode} · {submission.courseTitle}"? 
                      This action cannot be undone and all items will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(submission.id);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
};
