import { FormEvent, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, isSessionProblem } from "../api";
import { DraftBadge } from "../components/DraftBadge";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import type { LeadSelection } from "../components/ProviderCard";
import { SessionProblem } from "../components/SessionProblem";
import { NAME_MAX_LENGTH, normalizePhone, validateLeadForm, type LeadFormErrors, type LeadFormValues } from "../lead/leadForm";
import { useMockState } from "../session/useMockState";
import type { LeadResponse, RecommendationServiceType } from "../types/api";

const serviceLabels: Record<RecommendationServiceType, string> = {
  HOME_CARE: "居家照顧",
  HOME_MEDICAL_NURSING: "居家醫療與護理",
  ASSISTIVE_DEVICE: "輔具",
};

// PRIVACY_AND_RETENTION §3.4 / §8 (DRAFT): consent wording shown verbatim, never pre-checked.
const CONTACT_CONSENT_TEXT = "我同意 Kareo 服務人員以上述電話聯繫我，並在我同意後將需求轉告服務單位。";

const emptyValues: LeadFormValues = { name: "", phone: "", contactConsent: false };

function isLeadSelection(value: unknown): value is LeadSelection {
  if (typeof value !== "object" || value === null) return false;
  const selection = value as Record<string, unknown>;
  return typeof selection.providerId === "string" && typeof selection.recommendationId === "string"
    && typeof selection.providerName === "string" && typeof selection.serviceType === "string"
    && selection.serviceType in serviceLabels;
}

interface Props {
  sessionId: string;
  assessmentId: string | null;
}

export function LeadPage({ sessionId, assessmentId }: Props) {
  const location = useLocation();
  const mockState = useMockState();
  const selection = isLeadSelection(location.state) ? location.state : null;
  const [values, setValues] = useState<LeadFormValues>(emptyValues);
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [failure, setFailure] = useState<unknown>(null);
  const [lead, setLead] = useState<LeadResponse | null>(null);
  const submitting = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  if (!assessmentId || !sessionId || !selection) {
    return (
      <main id="main-content" className="content">
        <p className="eyebrow">我要媒合</p>
        <h1>請先選擇服務單位</h1>
        <p>媒合需求需要連結您的初步評估與推薦結果。請完成評估後，從推薦結果中的「我要媒合」進入。</p>
        <Link className="button primary" to={assessmentId ? "/result" : "/consent"}>{assessmentId ? "返回初步結果" : "開始評估"}</Link>
      </main>
    );
  }
  const current = selection;

  function update<K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Synchronous guard: a double click must not send two requests even before React re-renders.
    if (submitting.current || status === "success") return;
    const found = validateLeadForm(values);
    setErrors(found);
    if (found.name) return nameRef.current?.focus();
    if (found.phone) return phoneRef.current?.focus();
    if (found.contactConsent) return consentRef.current?.focus();

    submitting.current = true;
    setStatus("submitting");
    setFailure(null);
    try {
      const response = await api.createLead({
        sessionId,
        assessmentId: assessmentId!,
        recommendationId: current.recommendationId,
        providerId: current.providerId,
        serviceType: current.serviceType,
        contact: { name: values.name.trim(), phone: normalizePhone(values.phone) },
        contactConsent: true,
      }, mockState);
      setLead(response);
      // Contact details are no longer needed on screen once the backend has them.
      setValues(emptyValues);
      setStatus("success");
    } catch (reason) {
      // Keep what the user typed so a retry does not require re-entering it.
      setFailure(reason);
      setStatus("error");
    } finally {
      submitting.current = false;
    }
  }

  if (status === "success" && lead) {
    return (
      <main id="main-content" className="content">
        <p className="eyebrow">我要媒合</p>
        <h1 tabIndex={-1} ref={(heading) => heading?.focus()}>需求已送出</h1>
        <section className="panel" role="status">
          <p>
            {lead.duplicate
              ? "您先前已送出相同服務單位與服務的需求，本次沿用原本的案件，不會重複建立。"
              : "我們已收到您的媒合需求。"}
          </p>
          <p>案件編號：<strong>{lead.leadId}</strong>（需要查詢或刪除資料時可提供此編號）</p>
          <h2>接下來 <DraftBadge>後續處理說明為草案</DraftBadge></h2>
          <ul>
            <li>Kareo 服務人員會以您留下的電話與您聯繫，確認需求。</li>
            <li>在您同意後，才會將需求轉告服務單位；服務單位不會自動取得您的資料。</li>
            <li>送出需求不代表服務單位已接案，也不代表媒合已完成。</li>
          </ul>
        </section>
        <div className="button-row">
          <Link className="button secondary" to={current.from.startsWith("/recommendations/") ? current.from : "/result"}>返回推薦結果</Link>
          <Link className="button secondary" to="/result">返回初步結果</Link>
        </div>
        <FormalAssessmentReminder compact />
      </main>
    );
  }

  const failureMessage = failure instanceof Error ? failure.message : "媒合需求暫時無法送出，請稍後再試。";
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <main id="main-content" className="content">
      <p className="eyebrow">我要媒合</p>
      <h1>留下聯絡方式</h1>
      <section className="panel" aria-label="媒合對象">
        <dl className="provider-details">
          <div><dt>服務單位</dt><dd>{current.providerName}</dd></div>
          <div><dt>服務</dt><dd>{serviceLabels[current.serviceType]}</dd></div>
          {current.district && <div><dt>所在地區</dt><dd>{current.district}</dd></div>}
        </dl>
        <p className="field-hint">只需要稱呼與電話。請勿填寫身分證字號、病歷或其他不必要的資料。</p>
      </section>

      <form className="stack lead-form" onSubmit={handleSubmit} noValidate aria-busy={status === "submitting"}>
        {errorCount > 0 && <p className="error" role="alert">有 {errorCount} 個欄位需要修正，請查看下方說明。</p>}
        <label>
          稱呼
          <input
            ref={nameRef}
            name="name"
            autoComplete="name"
            maxLength={NAME_MAX_LENGTH + 10}
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "lead-name-error" : "lead-name-hint"}
          />
          <span className="field-hint" id="lead-name-hint">例如「王先生」「林小姐」，不需要全名。</span>
          {errors.name && <span className="field-error" id="lead-name-error">{errors.name}</span>}
        </label>
        <label>
          聯絡電話
          <input
            ref={phoneRef}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "lead-phone-error" : undefined}
          />
          {errors.phone && <span className="field-error" id="lead-phone-error">{errors.phone}</span>}
        </label>
        <div>
          <label className="checkbox">
            <input
              ref={consentRef}
              type="checkbox"
              checked={values.contactConsent}
              onChange={(event) => update("contactConsent", event.target.checked)}
              aria-invalid={Boolean(errors.contactConsent)}
              aria-describedby={errors.contactConsent ? "lead-consent-error" : undefined}
            />
            <span>{CONTACT_CONSENT_TEXT}</span>
          </label>
          <DraftBadge />
          {errors.contactConsent && <p className="field-error" id="lead-consent-error">{errors.contactConsent}</p>}
        </div>

        {status === "error" && (isSessionProblem(failure)
          ? <SessionProblem message={failureMessage} />
          : <p className="error" role="alert">{failureMessage} 需求尚未送出，您填寫的內容仍保留，可以再試一次。</p>)}
        {status === "submitting" && <p className="loading" role="status">正在送出需求，請稍候，不需要重複點擊。</p>}
        <button className="button primary" disabled={status === "submitting"}>
          {status === "submitting" ? "正在送出…" : status === "error" ? "再試一次送出" : "送出媒合需求"}
        </button>
      </form>
      <FormalAssessmentReminder compact />
    </main>
  );
}
