import { useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { mockApi } from "./api/mockAdapter";
import { ScrollToTop } from "./components/ScrollToTop";
import type { AssessmentRequest, AssessmentResponse } from "./types/api";
import { AssessmentPage } from "./pages/AssessmentPage";
import { ConsentPage } from "./pages/ConsentPage";
import { HomePage } from "./pages/HomePage";
import { ResultPage } from "./pages/ResultPage";
import { RecommendationPage } from "./pages/RecommendationPage";
import { ProviderDetailPage } from "./pages/ProviderDetailPage";

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<AssessmentResponse | null>(null);

  async function acceptConsent() {
    const session = await mockApi.createSession();
    await mockApi.acceptConsent({
      sessionId: session.sessionId,
      disclaimerVersion: "MOCK-1.0",
      privacyVersion: "MOCK-1.0",
      termsVersion: "MOCK-1.0",
      accepted: true,
    });
    setSessionId(session.sessionId);
    setHasConsent(true);
  }

  async function submitAssessment(request: AssessmentRequest) {
    const response = await mockApi.submitAssessment(request);
    setResult(response);
  }

  return (
    <BrowserRouter>
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
          element={hasConsent ? <AssessmentPage sessionId={sessionId} onSubmit={submitAssessment} /> : <Navigate to="/consent" replace />}
        />
        <Route path="/result" element={<ResultPage result={result} />} />
        <Route path="/providers/:providerId" element={<ProviderDetailPage />} />
        <Route
          path="/recommendations/:serviceType"
          element={<RecommendationPage assessmentId={result?.assessmentId ?? null} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer>
        本平台提供初步預估與資訊導引，不代表正式長照資格、長照等級或補助核定。
      </footer>
    </BrowserRouter>
  );
}
