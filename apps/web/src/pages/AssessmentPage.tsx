import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isSessionProblem, preciseLocationEnabled } from "../api";
import type { MockState } from "../api/mockScenarios";
import { DraftBadge } from "../components/DraftBadge";
import { FormalAssessmentReminder } from "../components/FormalAssessmentReminder";
import { SessionProblem } from "../components/SessionProblem";
import { buildLocation, DISTRICTS, isServiceCity, SERVICE_CITIES, type Coordinates } from "../location/location";
import { useGeolocation } from "../location/useGeolocation";
import { useMockState } from "../session/useMockState";
import type { AssessmentRequest, YesNoUnknown } from "../types/api";

export interface AssessmentForm {
  ageRange: AssessmentRequest["ageRange"];
  /** "" = 其他縣市／不提供位置 */
  city: string;
  /** "" = 只提供縣市 */
  district: string;
  coords: Coordinates | null;
  livingSituation: AssessmentRequest["livingSituation"];
  caregiverSituation: AssessmentRequest["caregiverSituation"];
  mobilityLevel: AssessmentRequest["mobilityLevel"];
  dailyLivingLevel: AssessmentRequest["dailyLivingLevel"];
  homeCare: YesNoUnknown;
  medicalNursing: YesNoUnknown;
  assistiveDevice: YesNoUnknown;
  transportation: YesNoUnknown;
  freeText: string;
}

// Location starts empty: it is optional and never pre-filled for the user (PRODUCT_SPEC §24).
export const defaultAssessmentForm: AssessmentForm = {
  ageRange: "75_84",
  city: "",
  district: "",
  coords: null,
  livingSituation: "WITH_FAMILY",
  caregiverSituation: "FAMILY_LIMITED",
  mobilityLevel: "NEEDS_ASSISTANCE",
  dailyLivingLevel: "PARTIAL_ASSISTANCE",
  homeCare: "YES",
  medicalNursing: "UNKNOWN",
  assistiveDevice: "YES",
  transportation: "YES",
  freeText: "",
};

export interface AssessmentSubmission {
  request: AssessmentRequest;
  form: AssessmentForm;
  mockState?: MockState;
}

interface Props {
  sessionId: string;
  initialForm: AssessmentForm;
  onSubmit: (submission: AssessmentSubmission) => Promise<void>;
}

type FormKey = Exclude<keyof AssessmentForm, "coords">;
type LocationErrors = Partial<Record<"city" | "district", string>>;

const option = (value: string, label: string) => <option key={value} value={value}>{label}</option>;
const FREE_TEXT_MAX = 500;

export function AssessmentPage({ sessionId, initialForm, onSubmit }: Props) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const mockState = useMockState();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState<AssessmentForm>(initialForm);
  const [locationErrors, setLocationErrors] = useState<LocationErrors>({});
  const [showLocationNotice, setShowLocationNotice] = useState(false);
  const geolocation = useGeolocation();
  const cityRef = useRef<HTMLSelectElement>(null);
  const districtRef = useRef<HTMLSelectElement>(null);
  const submitting = useRef(false);

  const set = (key: FormKey, value: string) => setForm((current) => ({ ...current, [key]: value }));

  // 「補充位置」 on the result/recommendation page returns here with the answers kept (D-13b).
  useEffect(() => {
    if ((routerLocation.state as { focus?: string } | null)?.focus === "location") cityRef.current?.focus();
  }, [routerLocation.state]);

  useEffect(() => {
    if (geolocation.state.status === "success") {
      const { coords } = geolocation.state;
      setForm((current) => ({ ...current, coords }));
    }
  }, [geolocation.state]);

  function changeCity(city: string) {
    setLocationErrors({});
    setForm((current) => ({
      ...current,
      city,
      district: isServiceCity(city) && DISTRICTS[city].includes(current.district) ? current.district : "",
    }));
  }

  function stopUsingCurrentLocation() {
    geolocation.clear();
    setShowLocationNotice(false);
    setLocationErrors({});
    setForm((current) => ({ ...current, coords: null }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const built = buildLocation({ city: form.city, district: form.district, coords: form.coords });
    if (!built.ok) {
      setLocationErrors({ [built.field]: built.message });
      (built.field === "city" ? cityRef : districtRef).current?.focus();
      return;
    }
    setLocationErrors({});
    submitting.current = true;
    setStatus("loading");
    setError(null);
    try {
      await onSubmit({
        request: {
          sessionId,
          ageRange: form.ageRange,
          location: built.location,
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
        },
        form,
        mockState,
      });
      navigate("/result");
    } catch (reason) {
      setStatus("error");
      setError(reason);
    } finally {
      submitting.current = false;
    }
  }

  const select = (label: string, key: FormKey, values: [string, string][]) => (
    <label>
      {label}
      <select value={form[key]} onChange={(event) => set(key, event.target.value)}>
        {values.map(([value, text]) => option(value, text))}
      </select>
    </label>
  );
  const yesNo: [string, string][] = [["YES", "是"], ["NO", "否"], ["UNKNOWN", "不確定"]];
  const districts = isServiceCity(form.city) ? DISTRICTS[form.city] : [];
  const geo = geolocation.state;
  const errorMessage = error instanceof Error ? error.message : "評估暫時無法完成，請稍後再試或聯絡 1966。";

  return (
    <main id="main-content" className="content">
      <p className="eyebrow">免費初步評估</p>
      <h1>告訴我們目前的照護情況</h1>
      <p>請依目前狀況填寫；不確定的題目可選擇「不確定」。</p>
      <FormalAssessmentReminder />
      <form className="assessment-form" onSubmit={handleSubmit} aria-busy={status === "loading"} noValidate>
        <fieldset>
          <legend>基本狀況</legend>
          {select("年齡範圍", "ageRange", [["UNDER_50", "未滿 50 歲"], ["50_64", "50–64 歲"], ["65_74", "65–74 歲"], ["75_84", "75–84 歲"], ["85_PLUS", "85 歲以上"], ["UNKNOWN", "不確定"]])}
          {select("居住情況", "livingSituation", [["ALONE", "獨居"], ["WITH_FAMILY", "與家人同住"], ["WITH_CAREGIVER", "與照顧者同住"], ["INSTITUTION", "機構居住"], ["OTHER", "其他"], ["UNKNOWN", "不確定"]])}
          {select("照顧者情況", "caregiverSituation", [["NO_CAREGIVER", "目前沒有照顧者"], ["FAMILY_AVAILABLE", "家人可協助"], ["FAMILY_LIMITED", "家人協助有限"], ["PAID_CAREGIVER", "有付費照顧者"], ["OTHER", "其他"], ["UNKNOWN", "不確定"]])}
        </fieldset>

        <fieldset className="location-fieldset" id="location">
          <legend>所在位置（選填）</legend>
          <p className="field-hint full-row" id="location-hint">
            提供縣市與行政區，可取得服務範圍相符的推薦；不提供也能完成評估並看到服務建議。平台目前收錄臺北市、新北市，其他縣市請選「其他縣市／不提供位置」。
          </p>
          <label>
            縣市
            <select
              ref={cityRef}
              value={form.city}
              onChange={(event) => changeCity(event.target.value)}
              aria-describedby={locationErrors.city ? "city-error location-hint" : "location-hint"}
              aria-invalid={Boolean(locationErrors.city)}
            >
              {option("", "其他縣市／不提供位置")}
              {SERVICE_CITIES.map((city) => option(city, city))}
            </select>
            {locationErrors.city && <span className="field-error" id="city-error">{locationErrors.city}</span>}
          </label>
          <label>
            行政區
            <select
              ref={districtRef}
              value={form.district}
              disabled={!districts.length}
              onChange={(event) => { setLocationErrors({}); set("district", event.target.value); }}
              aria-describedby={locationErrors.district ? "district-error" : undefined}
              aria-invalid={Boolean(locationErrors.district)}
            >
              {option("", districts.length ? "不選行政區（只提供縣市）" : "請先選擇縣市")}
              {districts.map((district) => option(district, district))}
            </select>
            {locationErrors.district && <span className="field-error" id="district-error">{locationErrors.district}</span>}
          </label>

          {preciseLocationEnabled && (
            <div className="gps-box full-row">
              {form.coords ? (
                <>
                  <p role="status">已取得目前位置，只用來計算與服務單位的直線距離。仍請選擇縣市與行政區，用來比對服務範圍。</p>
                  <button type="button" className="button secondary" onClick={stopUsingCurrentLocation}>不使用目前位置</button>
                </>
              ) : geo.status === "requesting" ? (
                <p className="loading" role="status">正在向瀏覽器取得位置，請在瀏覽器提示中選擇是否允許。</p>
              ) : showLocationNotice ? (
                <section className="location-notice" aria-labelledby="location-notice-heading">
                  <h3 id="location-notice-heading">使用目前位置前請先確認 <DraftBadge /></h3>
                  <ul>
                    <li>提供目前位置是選填。我們只用它計算您與服務單位的直線距離，讓推薦依距離排序。</li>
                    <li>您也可以只選縣市與行政區，或完全不提供位置；仍然可以完成評估並看到服務建議。</li>
                    <li>位置會取約略值（約 100 公尺範圍）保存，與評估資料一起在最後使用後 90 天刪除，不會提供給服務單位或其他公司。</li>
                    <li>您可以隨時在瀏覽器設定中關閉定位權限。</li>
                  </ul>
                  <div className="button-row">
                    <button type="button" className="button primary" onClick={() => { setShowLocationNotice(false); geolocation.request(); }}>我了解，取得目前位置</button>
                    <button type="button" className="button secondary" onClick={() => setShowLocationNotice(false)}>先不要</button>
                  </div>
                </section>
              ) : (
                <>
                  {"message" in geo && <p className="error" role="alert">{geo.message}</p>}
                  <button type="button" className="button secondary" onClick={() => setShowLocationNotice(true)}>
                    {geo.status === "idle" ? "使用目前位置（選填）" : "再試一次使用目前位置"}
                  </button>
                </>
              )}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>日常活動</legend>
          {select("行動狀況", "mobilityLevel", [["INDEPENDENT", "可自行行動"], ["NEEDS_ASSISTANCE", "需要協助"], ["WHEELCHAIR", "使用輪椅"], ["BEDRIDDEN", "長時間臥床"], ["UNKNOWN", "不確定"]])}
          {select("日常生活協助程度", "dailyLivingLevel", [["INDEPENDENT", "可自行完成"], ["PARTIAL_ASSISTANCE", "部分需要協助"], ["HIGH_ASSISTANCE", "大部分需要協助"], ["FULL_ASSISTANCE", "完全需要協助"], ["UNKNOWN", "不確定"]])}
        </fieldset>
        <fieldset>
          <legend>可能需要的服務</legend>
          {select("居家照顧", "homeCare", yesNo)}
          {select("居家醫療／護理", "medicalNursing", yesNo)}
          {select("輔具", "assistiveDevice", yesNo)}
          {select("長照交通", "transportation", yesNo)}
        </fieldset>
        <label>
          其他想補充的情況（選填，最多 {FREE_TEXT_MAX} 字）
          <textarea value={form.freeText} maxLength={FREE_TEXT_MAX} onChange={(event) => set("freeText", event.target.value)} rows={4} aria-describedby="free-text-hint" />
          <span className="field-hint" id="free-text-hint">請勿填寫身分證字號、病歷或金融資料。</span>
        </label>
        {status === "error" && (isSessionProblem(error)
          ? <SessionProblem message={errorMessage} />
          : <p className="error" role="alert">{errorMessage} 您填寫的內容仍保留，可以直接再送出一次。</p>)}
        {status === "loading" && <p className="loading" role="status">正在依目前資料整理初步結果，請稍候。</p>}
        <button className="button primary" disabled={status === "loading"}>{status === "loading" ? "正在整理初步結果…" : "查看初步結果"}</button>
      </form>
    </main>
  );
}
