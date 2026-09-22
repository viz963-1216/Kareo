import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AssessmentRequest, YesNoUnknown } from "../types/api";

interface Props {
  sessionId: string;
  onSubmit: (request: AssessmentRequest) => Promise<void>;
}

const option = (value: string, label: string) => <option key={value} value={value}>{label}</option>;

export function AssessmentPage({ sessionId, onSubmit }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ageRange: "75_84" as AssessmentRequest["ageRange"], city: "新北市", district: "三重區", livingSituation: "WITH_FAMILY" as AssessmentRequest["livingSituation"], caregiverSituation: "FAMILY_LIMITED" as AssessmentRequest["caregiverSituation"], mobilityLevel: "NEEDS_ASSISTANCE" as AssessmentRequest["mobilityLevel"], dailyLivingLevel: "PARTIAL_ASSISTANCE" as AssessmentRequest["dailyLivingLevel"], homeCare: "YES" as YesNoUnknown, medicalNursing: "UNKNOWN" as YesNoUnknown, assistiveDevice: "YES" as YesNoUnknown, transportation: "YES" as YesNoUnknown, freeText: "" });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      await onSubmit({
        sessionId,
        ageRange: form.ageRange,
        location: {
          city: form.city.trim(),
          district: form.district.trim(),
          precision: "DISTRICT",
          lat: null,
          lng: null,
        },
        livingSituation: form.livingSituation,
        caregiverSituation: form.caregiverSituation,
        mobilityLevel: form.mobilityLevel,
        dailyLivingLevel: form.dailyLivingLevel,
        needs: {
          homeCare: form.homeCare,
          medicalNursing: form.medicalNursing,
          assistiveDevice: form.assistiveDevice,
          transportation: form.transportation,
        },
        freeText: form.freeText.trim(),
      });
      navigate("/result");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "評估暫時無法完成，請稍後再試或聯絡 1966。");
    }
  }
  const select = (label: string, key: keyof typeof form, values: [string, string][]) => (
    <label>
      {label}
      <select value={form[key]} onChange={(event) => set(key, event.target.value)}>
        {values.map(([value, text]) => option(value, text))}
      </select>
    </label>
  );
  const yesNo: [string, string][] = [["YES", "是"], ["NO", "否"], ["UNKNOWN", "不確定"]];
  return <main id="main-content" className="content"><p className="eyebrow">免費初步評估</p><h1>告訴我們目前的照護情況</h1><p>請依目前狀況填寫；不確定的題目可選擇「不確定」。</p>
    <form className="assessment-form" onSubmit={handleSubmit} aria-busy={status === "loading"}>
      <fieldset><legend>基本狀況</legend>{select("年齡範圍", "ageRange", [["UNDER_50", "未滿 50 歲"], ["50_64", "50–64 歲"], ["65_74", "65–74 歲"], ["75_84", "75–84 歲"], ["85_PLUS", "85 歲以上"], ["UNKNOWN", "不確定"]])}<label>縣市<input required value={form.city} onChange={(event) => set("city", event.target.value)} /></label><label>行政區<input required value={form.district} onChange={(event) => set("district", event.target.value)} /></label>{select("居住情況", "livingSituation", [["ALONE", "獨居"], ["WITH_FAMILY", "與家人同住"], ["WITH_CAREGIVER", "與照顧者同住"], ["INSTITUTION", "機構居住"], ["OTHER", "其他"], ["UNKNOWN", "不確定"]])}{select("照顧者情況", "caregiverSituation", [["NO_CAREGIVER", "目前沒有照顧者"], ["FAMILY_AVAILABLE", "家人可協助"], ["FAMILY_LIMITED", "家人協助有限"], ["PAID_CAREGIVER", "有付費照顧者"], ["OTHER", "其他"], ["UNKNOWN", "不確定"]])}</fieldset>
      <fieldset><legend>日常活動</legend>{select("行動狀況", "mobilityLevel", [["INDEPENDENT", "可自行行動"], ["NEEDS_ASSISTANCE", "需要協助"], ["WHEELCHAIR", "使用輪椅"], ["BEDRIDDEN", "長時間臥床"], ["UNKNOWN", "不確定"]])}{select("日常生活協助程度", "dailyLivingLevel", [["INDEPENDENT", "可自行完成"], ["PARTIAL_ASSISTANCE", "部分需要協助"], ["HIGH_ASSISTANCE", "大部分需要協助"], ["FULL_ASSISTANCE", "完全需要協助"], ["UNKNOWN", "不確定"]])}</fieldset>
      <fieldset><legend>可能需要的服務</legend>{select("居家照顧", "homeCare", yesNo)}{select("居家醫療／護理", "medicalNursing", yesNo)}{select("輔具", "assistiveDevice", yesNo)}{select("長照交通", "transportation", yesNo)}</fieldset>
      <label>其他想補充的情況（選填）<textarea value={form.freeText} onChange={(event) => set("freeText", event.target.value)} rows={4} /></label>
      {status === "error" && <p className="error" role="alert">{error}</p>}
      {status === "loading" && <p className="loading" role="status">正在依目前資料整理初步結果，請稍候。</p>}
      <button className="button primary" disabled={status === "loading"}>{status === "loading" ? "正在整理初步結果…" : "查看初步結果"}</button>
    </form></main>;
}
