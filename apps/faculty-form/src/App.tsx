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
import NotFound from "./pages/NotFound";
import ManageDesignees from "./pages/ManageDesignees";
import AcceptProxyInvitation from "./pages/AcceptProxyInvitation";
import { RouteActingForBanner } from "./components/RouteActingForBanner";
import { ProxyInvitationResume } from "./components/ProxyInvitationResume";
import { ProxyAccessSync } from "./components/ProxyAccessSync";
import { STICKY_HEADER_ROUTES } from "./components/stickyHeaderRoutes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
        <ProxyInvitationResume />
        <ProxyAccessSync />
        <RouteActingForBanner />
        <Routes>
          {/* Auth-only route - redirects to / if authenticated */}
          <Route path="/auth" element={
            <ProtectedRoute authOnly>
              <Auth />
            </ProtectedRoute>
          } />
          
          {/* Protected routes - require authentication */}
          <Route path={STICKY_HEADER_ROUTES.dashboard} element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/designees" element={
            <ProtectedRoute>
              <ManageDesignees />
            </ProtectedRoute>
          } />
          <Route path="/faculty/accept-proxy-invitation/:token" element={<AcceptProxyInvitation />} />
          <Route path={STICKY_HEADER_ROUTES.newSubmission} element={
            <ProtectedRoute>
              <NewSubmission />
            </ProtectedRoute>
          } />
          <Route path={STICKY_HEADER_ROUTES.submissionEdit} element={
            <ProtectedRoute>
              <SubmissionEditor />
            </ProtectedRoute>
          } />
          <Route path={STICKY_HEADER_ROUTES.addMaterialsRecord} element={
            <ProtectedRoute>
              <SubmissionEditor />
            </ProtectedRoute>
          } />
          <Route path={STICKY_HEADER_ROUTES.addMaterials} element={
            <ProtectedRoute>
              <SubmissionEditor />
            </ProtectedRoute>
          } />
          <Route path={STICKY_HEADER_ROUTES.submissionDetail} element={
            <ProtectedRoute>
              <SubmissionDetail />
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
