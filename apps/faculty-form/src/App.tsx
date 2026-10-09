import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NewSubmission from "./pages/NewSubmission";
import SubmissionEditor from "./pages/SubmissionEditor"
import SubmissionDetail from "./pages/SubmissionDetail";
import ClonePrevious from "./pages/ClonePrevious";
import CloneEditor from "./pages/CloneEditor";
import CloneMatchingTest from "./pages/CloneMatchingTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
        <Routes>
          {/* Auth-only route - redirects to / if authenticated */}
          <Route path="/auth" element={
            <ProtectedRoute authOnly>
              <Auth />
            </ProtectedRoute>
          } />
          
          {/* Protected routes - require authentication */}
          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/new-submission" element={
            <ProtectedRoute>
              <NewSubmission />
            </ProtectedRoute>
          } />
          <Route path="/submission/:id/edit" element={
            <ProtectedRoute>
              <SubmissionEditor />
            </ProtectedRoute>
          } />
          <Route path="/submission/:id" element={
            <ProtectedRoute>
              <SubmissionDetail />
            </ProtectedRoute>
          } />
          <Route path="/clone-previous" element={
            <ProtectedRoute>
              <ClonePrevious />
            </ProtectedRoute>
          } />
          <Route path="/clone-editor" element={
            <ProtectedRoute>
              <CloneEditor />
            </ProtectedRoute>
          } />
          <Route path="/clone-matching-test" element={
            <ProtectedRoute>
              <CloneMatchingTest />
            </ProtectedRoute>
          } />
          
          {/* 404 - public */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
