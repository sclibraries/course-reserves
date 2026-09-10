import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Copy, ExternalLink, Plus } from "lucide-react";
import type { PreviewResource } from "@/hooks/useCourseCloning";

interface ResourcePreviewViewProps {
  loadingPreview: boolean;
  previewResources: PreviewResource[];
  onAddResource: (resource: PreviewResource) => void;
  onAddAllResources: () => void;
}

export const ResourcePreviewView: React.FC<ResourcePreviewViewProps> = ({
  loadingPreview,
  previewResources,
  onAddResource,
  onAddAllResources,
}) => {
  if (loadingPreview) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Loading resources...</p>
      </div>
    );
  }

  if (previewResources.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Resources Found</h3>
        <p>This course doesn't have any materials.</p>
      </div>
    );
  }

  const electronicCount = previewResources.filter(r => r.type === 'electronic').length;
  const physicalCount = previewResources.filter(r => r.type === 'physical').length;

  return (
    <div className="space-y-3 pb-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-blue-700">
            <strong>{previewResources.length}</strong> total resources 
            <span className="ml-2">
              ({electronicCount} electronic, {physicalCount} physical)
            </span>
          </p>
          <Button
            onClick={onAddAllResources}
            size="sm"
          >
            <Copy className="h-3 w-3 mr-2" />
            Add All Resources
          </Button>
        </div>
      </div>

      {previewResources.map((resource, index) => (
        <ResourceCard
          key={index}
          resource={resource}
          onAdd={() => onAddResource(resource)}
        />
      ))}
    </div>
  );
};

interface ResourceCardProps {
  resource: PreviewResource;
  onAdd: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onAdd }) => {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={resource.type === 'electronic' ? 'default' : 'secondary'}>
              {resource.type === 'electronic' ? 'Electronic' : 'Physical'}
            </Badge>
            <Badge variant="outline">{resource.materialType}</Badge>
          </div>
          
          <div>
            <h4 className="font-semibold leading-tight">{resource.title}</h4>
            {resource.author && (
              <p className="text-sm text-muted-foreground mt-1">
                by {resource.author}
              </p>
            )}
          </div>

          <div className="text-sm space-y-1">
            {/* Electronic resource URL */}
            {resource.type === 'electronic' && resource.url && (
              <div className="flex items-center gap-1 text-blue-600">
                <ExternalLink className="h-3 w-3" />
                <a 
                  href={resource.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline truncate"
                >
                  View resource
                </a>
              </div>
            )}
            
            {/* Physical resource discovery URL */}
            {resource.type === 'physical' && resource.discoveryUrl && (
              <div className="flex items-center gap-1 text-blue-600">
                <ExternalLink className="h-3 w-3" />
                <a 
                  href={resource.discoveryUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  View in catalog
                </a>
              </div>
            )}
            
            {/* Description (primarily for electronic resources) */}
            {resource.description && (
              <div 
                className="text-muted-foreground text-xs" 
                dangerouslySetInnerHTML={{ __html: resource.description }}
              />
            )}
            
            {resource.publicationInfo && (
              <div className="text-muted-foreground text-xs">
                {resource.publicationInfo}
              </div>
            )}

            {resource.callNumber && (
              <div className="text-muted-foreground text-xs">
                Call Number: {resource.callNumber}
              </div>
            )}

            {resource.notes && (
              <div className="text-muted-foreground italic text-xs">
                {resource.notes}
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={onAdd}
          size="sm"
          className="shrink-0"
        >
          <Plus className="h-3 w-3 mr-2" />
          Add
        </Button>
      </div>
    </Card>
  );
};
