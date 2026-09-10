import { useTermsStore } from "@/store/termsStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";

export const TermsDebugPanel = () => {
  const {
    terms,
    currentTerm,
    nextTerm,
    loading,
    error,
    fetchTerms,
    getCurrentTermName,
    getNextTermName,
    getOrderedTerms,
    getAvailableTerms
  } = useTermsStore();

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Terms Debug Panel
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTerms}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Status:</strong>
            <div className="mt-1">
              {loading && <Badge variant="secondary">Loading...</Badge>}
              {error && <Badge variant="destructive">Error: {error}</Badge>}
              {!loading && !error && <Badge variant="default">Loaded</Badge>}
            </div>
          </div>
          <div>
            <strong>Terms Count:</strong>
            <div className="mt-1">{terms.length} terms loaded</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Current Term:</strong>
            <div className="mt-1">
              {currentTerm ? (
                <Badge variant="outline">{currentTerm.name}</Badge>
              ) : (
                <span className="text-muted-foreground">None detected</span>
              )}
            </div>
          </div>
          <div>
            <strong>Next Term:</strong>
            <div className="mt-1">
              {nextTerm ? (
                <Badge variant="outline">{nextTerm.name}</Badge>
              ) : (
                <span className="text-muted-foreground">None detected</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <strong>Function Results:</strong>
          <div className="mt-1 space-x-2">
            <Badge>Current: {getCurrentTermName()}</Badge>
            <Badge>Next: {getNextTermName()}</Badge>
          </div>
        </div>

        <div>
          <strong>Available Terms for Creation:</strong>
          <div className="mt-1 flex flex-wrap gap-1">
            {getAvailableTerms().map((term) => (
              <Badge key={term.id} variant="secondary" className="text-xs">
                {term.name}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <strong>All Terms (Ordered):</strong>
          <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
            {getOrderedTerms().map((term) => {
              const startDate = new Date(term.startDate);
              const endDate = new Date(term.endDate);
              const now = new Date();
              const isCurrent = now >= startDate && now <= endDate;
              const isFuture = startDate > now;
              
              return (
                <div
                  key={term.id}
                  className={`p-2 rounded border ${
                    isCurrent
                      ? "bg-green-50 border-green-200"
                      : isFuture
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="font-medium">{term.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </div>
                  {isCurrent && (
                    <Badge className="text-xs mt-1" variant="default">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};