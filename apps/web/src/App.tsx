import { useCallback, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import { FormalAssessmentReminder } from "./components/FormalAssessmentReminder";
import { ScrollToTop } from "./components/ScrollToTop";
import type { AssessmentLocation, AssessmentResponse } from "./types/api";
import { AssessmentPage, defaultAssessmentForm, type AssessmentForm, type AssessmentSubmission } from "./pages/AssessmentPage";
import { ConsentPage } from "./pages/ConsentPage";
import { HomePage } from "./pages/HomePage";
import { LeadPage } from "./pages/LeadPage";
import { ResultPage, type SessionClosure } from "./pages/ResultPage";
import { RecommendationPage } from "./pages/RecommendationPage";
import { ProviderDetailPage } from "./pages/ProviderDetailPage";
import { SessionEndedPage } from "./pages/SessionEndedPage";
import { SessionContext } from "./session/SessionContext";

// All answers, results and contact details live only in this component's memory (never URL or
// localStorage). The session token is kept in sessionStorage by the real API adapter (API_CONTRACT §6).
function AppRoutes() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [location, setLocation] = useState<AssessmentLocation | null>(null);
  const [form, setForm] = useState<AssessmentForm>(defaultAssessmentForm);

  const clearState = useCallback(() => {
    api.forgetLocalSession();
    setSessionId("");
    setHasConsent(false);
    setResult(null);
    setLocation(null);
    setForm(defaultAssessmentForm);
  }, []);

  const session = useMemo(() => ({
    restart() {
      clearState();
      navigate("/session-ended", { state: { kind: "restarted" } });
    },
  }), [clearState, navigate]);

  async function acceptConsent() {
    const created = await api.createSession();
    await api.acceptConsent(created.sessionId);
    setSessionId(created.sessionId);
    setHasConsent(true);
  }

  async function submitAssessment({ request, form: submittedForm, mockState }: AssessmentSubmission) {
    // A failed submission keeps the previous result hidden: no stale or placeholder result is shown.
    setResult(null);
    setForm(submittedForm);
    const response = await api.submitAssessment(request, mockState);
    setLocation(request.location);
    setResult(response);
  }

  // Only called after the backend confirmed the deletion or withdrawal.
  function sessionClosed(closure: SessionClosure) {
    clearState();
    navigate("/session-ended", { state: closure });
  }

  return (
    <SessionContext.Provider value={session}>
      <ScrollToTop />
      <a className="skip-link" href="#main-content">跳到主要內容</a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Kareo 長照一點通首頁">
          Kareo <span>長照一點通</span>
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/consent" element={<ConsentPage onAccept={acceptConsent} />} />
        <Route
          path="/assessment"
          element={hasConsent ? <AssessmentPage sessionId={sessionId} initialForm={form} onSubmit={submitAssessment} /> : <Navigate to="/consent" replace />}
        />
        <Route path="/result" element={<ResultPage result={result} location={location} onSessionClosed={sessionClosed} />} />
        <Route path="/providers/:providerId" element={<ProviderDetailPage />} />
        <Route
          path="/recommendations/:serviceType"
          element={<RecommendationPage assessmentId={result?.assessmentId ?? null} locationPrecision={location?.precision ?? null} />}
        />
        <Route path="/match" element={<LeadPage sessionId={sessionId} assessmentId={result?.assessmentId ?? null} />} />
        <Route path="/session-ended" element={<SessionEndedPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer>
        <FormalAssessmentReminder compact />
        <p>本平台不提供醫療診斷。長照交通服務 Kareocar 為外部平台，只以新分頁開啟。</p>
      </footer>
    </SessionContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
