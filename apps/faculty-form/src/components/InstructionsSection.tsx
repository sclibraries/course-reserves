import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

interface InstructionsSectionProps {
  showInstructions: boolean;
  onToggle: () => void;
}

export const InstructionsSection: React.FC<InstructionsSectionProps> = ({ 
  showInstructions, 
  onToggle 
}) => {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardContent className="pt-4 pb-4">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-blue-900 hover:text-blue-700 transition-colors"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Managing Your Course Materials - Tips & Shortcuts
          </h3>
          {showInstructions ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        
        {showInstructions && (
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800 mt-4 pt-4 border-t border-blue-200">
            <div>
              <h4 className="font-medium mb-2">✨ Ordering & Organization</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• <strong>Drag & drop</strong> to reorder materials</li>
                <li>• Use <strong>arrow buttons</strong> for precise positioning</li>
                <li>• <strong>Position numbers</strong> show the final order</li>
                <li>• The displayed order is the order students see</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🔍 Search</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• Search by title, author, or material type</li>
                <li>• Search also finds materials inside folders</li>
                <li>• Clear the search to reorder materials</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
