import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RuleBasedAssessmentEngine,
  matchesKeyword,
  normalizeFreeText,
} from "../src/assessment/ruleBasedAssessmentEngine.js";
import { formatHotlineHours } from "../src/assessment/summaryComposer.js";
import { RULES_VERSION } from "../src/assessment/rules.js";
import type { KnowledgeSnapshot, KnowledgeSnapshotRecord } from "../src/assessment/knowledgeSnapshot.js";
import type { CreateAssessmentInput } from "../src/types/index.js";
import { ALL, FIXTURE_TODAY, byType, fixtureSnapshot, input } from "./fixtures/knowledgeFixture.js";

// ASSESSMENT_RULES §9（RULES-2026-09-23-r2）T1–T23。知識一律使用 tests/fixtures 的合成快照（FIXTURE）。
const engine = new RuleBasedAssessmentEngine();

async function run(i: CreateAssessmentInput, knowledge: KnowledgeSnapshot = fixtureSnapshot(), today = FIXTURE_TODAY) {
  const result = await engine.generateCareNeedProfile(i, { knowledge, today });
  return { ...result, lines: result.profile.summary.split("\n") };
}

const TAIPEI_DISTRICT = { city: "臺北市", district: "大安區", precision: "DISTRICT" as const, lat: null, lng: null };
const NTPC = (district: string | null) =>
  district
    ? { city: "新北市", district, precision: "DISTRICT" as const, lat: null, lng: null }
    : { city: "新北市", district: null, precision: "CITY" as const, lat: null, lng: null };

describe("ASSESSMENT_RULES §9 required cases", () => {
  it("T1: needs all YES → four needs, priority in fixed order", async () => {
    const r = await run(input({ needs: ALL("YES") }));
    expect(r.profile.careNeeds).toEqual(["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE", "TRANSPORTATION"]);
    expect(r.profile.priority).toEqual(["HOME_CARE", "HOME_MEDICAL_NURSING", "ASSISTIVE_DEVICE", "TRANSPORTATION"]);
    expect(r.ruleTrace.needs.every((n) => n.basis === "USER_YES")).toBe(true);
  });

  it("T2: needs all NO + BEDRIDDEN → empty (user answer wins), summary S-NONE", async () => {
    const r = await run(input({ needs: ALL("NO"), mobilityLevel: "BEDRIDDEN", freeText: "需要輪椅、要洗腎、傷口換藥" }));
    expect(r.profile.careNeeds).toEqual([]);
    expect(r.profile.priority).toEqual([]);
    expect(r.ruleTrace.templateIds[0]).toBe("S-NONE");
    expect(r.lines[0]).toBe("依您目前提供的資訊，尚未看出明確的長照服務需求。若狀況改變或仍有疑問，建議撥打 1966 詢問。");
  });

  it("T3: all UNKNOWN + PARTIAL_ASSISTANCE → only HOME_CARE via HC-R1", async () => {
    const r = await run(input({ dailyLivingLevel: "PARTIAL_ASSISTANCE" }));
    expect(r.profile.careNeeds).toEqual(["HOME_CARE"]);
    expect(r.ruleTrace.needs).toEqual([{ need: "HOME_CARE", basis: "STRUCTURED_RULE", ruleIds: ["HC-R1"] }]);
  });

  it("T4: all UNKNOWN + WHEELCHAIR → ASSISTIVE_DEVICE (AD-R1), TRANSPORTATION (TR-R1)", async () => {
    const r = await run(input({ mobilityLevel: "WHEELCHAIR" }));
    expect(r.profile.careNeeds).toEqual(["ASSISTIVE_DEVICE", "TRANSPORTATION"]);
    expect(r.ruleTrace.needs).toEqual([
      { need: "ASSISTIVE_DEVICE", basis: "STRUCTURED_RULE", ruleIds: ["AD-R1"] },
      { need: "TRANSPORTATION", basis: "STRUCTURED_RULE", ruleIds: ["TR-R1"] },
    ]);
  });

  it("T5: BEDRIDDEN + FULL_ASSISTANCE → four needs, HOME_CARE and HOME_MEDICAL_NURSING first", async () => {
    const r = await run(input({ mobilityLevel: "BEDRIDDEN", dailyLivingLevel: "FULL_ASSISTANCE" }));
    expect(r.profile.careNeeds).toHaveLength(4);
    expect(r.profile.priority.slice(0, 2)).toEqual(["HOME_CARE", "HOME_MEDICAL_NURSING"]);
    // HC 2+2=4、MN 2+2=4、TR 2+1=3、AD 2+0=2（§5）
    expect(r.profile.priority).toEqual(["HOME_CARE", "HOME_MEDICAL_NURSING", "TRANSPORTATION", "ASSISTIVE_DEVICE"]);
  });

  it("T6: assistiveDevice UNKNOWN + 「最近上下樓很容易跌倒」 → ASSISTIVE_DEVICE via KW-AD", async () => {
    const r = await run(input({ freeText: "最近上下樓很容易跌倒" }));
    expect(r.profile.careNeeds).toContain("ASSISTIVE_DEVICE");
    expect(r.ruleTrace.needs).toContainEqual({ need: "ASSISTIVE_DEVICE", basis: "KEYWORD", ruleIds: ["KW-AD"] });
  });

  it("T7: 「目前不需要輪椅」 → no ASSISTIVE_DEVICE (negation)", async () => {
    const r = await run(input({ freeText: "目前不需要輪椅" }));
    expect(r.profile.careNeeds).not.toContain("ASSISTIVE_DEVICE");
  });

  it("T8: transportation NO + 「每週要洗腎」 → no TRANSPORTATION (NO wins)", async () => {
    const r = await run(input({ needs: { transportation: "NO" }, freeText: "每週要洗腎" }));
    expect(r.profile.careNeeds).not.toContain("TRANSPORTATION");
  });

  it("T9: all UNKNOWN, empty freeText → empty; S-NONE + S-ELIG-UNKNOWN (+ S-DIS-HINT + S-LOCAL-NOCITY) + S-NEXT", async () => {
    const r = await run(input());
    expect(r.profile.careNeeds).toEqual([]);
    expect(r.ruleTrace.templateIds).toEqual(["S-NONE", "S-ELIG-UNKNOWN", "S-DIS-HINT", "S-LOCAL-NOCITY", "S-NEXT"]);
    expect(r.lines[1]).toBe(
      "是否符合申請條件，需依年滿 65 歲、具原住民身分且年滿 55 歲、領有身心障礙證明、有失智症或屬急性後期整合照護計畫收案對象等情況由照管專員評估。"
    );
    expect(r.lines[4]).toBe("下一步可撥打長照專線 1966（週一至週五 8:30–12:00、13:30–17:30）申請到府評估。");
  });

  it("T10 (engine part): a PUBLISHED version without APPLICATION_CHANNELS cannot produce S-NEXT → KNOWLEDGE_UNAVAILABLE", async () => {
    const knowledge = fixtureSnapshot((rs) => rs.filter((r) => r.ruleData.type !== "APPLICATION_CHANNELS"));
    await expect(run(input(), knowledge)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    await expect(run(input(), { version: "KB-EMPTY", records: [] })).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("T11: same input + same rules/knowledge version → identical output 100 times", async () => {
    const i = input({
      ageRange: "75_84",
      location: NTPC("三重區"),
      caregiverSituation: "FAMILY_LIMITED",
      mobilityLevel: "WHEELCHAIR",
      dailyLivingLevel: "HIGH_ASSISTANCE",
      needs: { homeCare: "YES" },
      freeText: "傷口要換藥，每週回診",
    });
    const first = JSON.stringify(await run(i));
    for (let n = 0; n < 100; n++) expect(JSON.stringify(await run(i))).toBe(first);
  });

  it("T12: INSTITUTION + NO_CAREGIVER + INDEPENDENT → no HC-R2/HC-R3, includes S-INSTITUTION", async () => {
    const r = await run(
      input({ livingSituation: "INSTITUTION", caregiverSituation: "NO_CAREGIVER", dailyLivingLevel: "INDEPENDENT" })
    );
    expect(r.profile.careNeeds).not.toContain("HOME_CARE");
    expect(r.ruleTrace.templateIds).toContain("S-INSTITUTION");
    // INSTITUTION 時即使 dailyLivingLevel 需要協助也不套用 HC-R3（只剩 HC-R1）
    const r2 = await run(
      input({ livingSituation: "INSTITUTION", caregiverSituation: "NO_CAREGIVER", dailyLivingLevel: "PARTIAL_ASSISTANCE" })
    );
    expect(r2.ruleTrace.needs.find((n) => n.need === "HOME_CARE")?.ruleIds).toEqual(["HC-R1"]);
  });

  it("T13: no summary ever contains official-determination wording; warnings always present", async () => {
    const forbidden = ["您已核定", "已核定", "確定符合", "CMS 第", "您可獲得", "您的額度為"];
    const locations = [
      { city: null, district: null, precision: "NONE" as const, lat: null, lng: null },
      TAIPEI_DISTRICT,
      NTPC(null),
      NTPC("烏來區"),
    ];
    for (const ageRange of ["UNDER_50", "65_74", "UNKNOWN"] as const)
      for (const answer of ["YES", "NO", "UNKNOWN"] as const)
        for (const location of locations)
          for (const caregiverSituation of ["FAMILY_LIMITED", "NO_CAREGIVER"] as const) {
            const r = await run(
              input({ ageRange, location, caregiverSituation, mobilityLevel: "WHEELCHAIR", needs: ALL(answer), livingSituation: "INSTITUTION" })
            );
            for (const word of forbidden) expect(r.profile.summary).not.toContain(word);
            expect(r.profile.warnings).toEqual(["本結果僅為初步預估。", "實際資格、長照等級與補助仍需由正式長照評估確認。"]);
            expect(Object.keys(r.profile).sort()).toEqual(["careNeeds", "priority", "summary", "warnings"]);
          }
  });

  it("T14: 臺北市＋行政區, transportation YES → zone 1 amount from knowledge, 臺北市 S-LOCAL-MISSING + S-LOCAL-CENTER", async () => {
    const r = await run(input({ location: TAIPEI_DISTRICT, needs: { transportation: "YES" } }));
    expect(r.lines).toContain("交通接送服務：臺北市大安區屬交通接送第 1 區，每月額度 1,680 元，限用於就醫、復健或透析治療。");
    expect(r.lines).toContain(
      "臺北市的地方規定與資源目前尚未收錄於平台，請洽 1966 或臺北市長期照顧管理中心確認；平台不會以其他縣市的規定代替。"
    );
    expect(r.lines).toContain("臺北市長期照顧管理中心：臺北市中山區錦州街233號，電話 1966。");
    expect(r.profile.summary).not.toContain("新北市的地方補助");
    expect(r.profile.summary).not.toContain("新北市長期照顧管理中心");
  });

  it("T15: 新北市烏來區 → district override zone 4; never shows 臺北市 center", async () => {
    const r = await run(input({ location: NTPC("烏來區"), needs: { transportation: "YES" } }));
    expect(r.lines).toContain("交通接送服務：新北市烏來區屬交通接送第 4 區，每月額度 2,400 元，限用於就醫、復健或透析治療。");
    expect(r.profile.summary).not.toContain("臺北市長期照顧管理中心");
    expect(r.ruleTrace.templateIds).not.toContain("S-LOCAL-CENTER");
    expect(r.ruleTrace.templateIds).toContain("S-LOCAL-MISSING");
  });

  it("T16: 新北市 precision CITY → 「多數行政區…部分行政區…」 description", async () => {
    const r = await run(input({ location: NTPC(null), needs: { transportation: "YES" } }));
    expect(r.lines).toContain(
      "交通接送服務：新北市多數行政區屬第 2 區（每月 1,840 元），部分行政區屬第 4 區（每月 2,400 元），提供行政區後可確認，限用於就醫、復健或透析治療。"
    );
  });

  it("T17: precision NONE, transportation YES → amount range, S-LOCAL-NOCITY, no city-specific local sentence", async () => {
    const r = await run(input({ needs: { transportation: "YES" } }));
    expect(r.lines).toContain(
      "交通接送服務：每月額度依居住地分區為 1,680 至 2,400 元，提供縣市與行政區後可確認所屬分區，限用於就醫、復健或透析治療。"
    );
    expect(r.ruleTrace.templateIds).toContain("S-LOCAL-NOCITY");
    for (const id of ["S-LOCAL-INFO", "S-LOCAL-MISSING", "S-LOCAL-CENTER"]) expect(r.ruleTrace.templateIds).not.toContain(id);
  });

  it("T24: 新北市, careNeeds 不含 TRANSPORTATION／ASSISTIVE_DEVICE → only LOCAL_APPLICATION's S-LOCAL-INFO shows", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      rs.push(
        {
          id: "KREC-KR-2026-012",
          packRecordId: "KR-2026-012",
          title: "新北市申請長照服務的管道",
          category: "APPLICATION",
          jurisdiction: "NEW_TAIPEI",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          summary: "新北市可透過長照專線 1966 或線上申請。",
          ruleData: { type: "LOCAL_APPLICATION", city: "新北市" },
          authority: "NEW_TAIPEI_GOV",
        },
        {
          id: "KREC-KR-2026-014",
          packRecordId: "KR-2026-014",
          title: "新北市長照交通接送服務使用規則",
          category: "TRANSPORTATION",
          jurisdiction: "NEW_TAIPEI",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          summary: "新北市交通接送限往返居所與醫院。",
          ruleData: { type: "LOCAL_TRANSPORT_RULES", city: "新北市" },
          authority: "NEW_TAIPEI_GOV",
        }
      );
    });
    const r = await run(input({ location: NTPC("板橋區"), needs: { homeCare: "YES" } }), knowledge);
    expect(r.lines).toContain(
      "新北市：新北市可透過長照專線 1966 或線上申請（依據：新北市政府〈新北市申請長照服務的管道〉，2026-01-01 起適用）。"
    );
    expect(r.profile.summary).not.toContain("新北市交通接送限往返居所與醫院");
    expect(r.ruleTrace.templateIds.filter((t) => t === "S-LOCAL-INFO")).toHaveLength(1);
    expect(r.ruleTrace.templateIds).not.toContain("S-LOCAL-MISSING");
  });

  it("T18: PUBLISHED version without BENEFIT_AMOUNTS → every amount sentence omitted, no default numbers", async () => {
    const knowledge = fixtureSnapshot((rs) => rs.filter((r) => r.ruleData.type !== "BENEFIT_AMOUNTS"));
    const r = await run(input({ ageRange: "75_84", location: NTPC("三重區"), caregiverSituation: "FAMILY_LIMITED", needs: ALL("YES") }), knowledge);
    expect(r.ruleTrace.templateIds.filter((t) => t.startsWith("S-SUB-"))).toEqual([]);
    expect(r.profile.summary).not.toContain("元");
    expect(r.ruleTrace.templateIds).toEqual(["S-NEEDS", "S-ELIG-AGE", "S-DIS-HINT", "S-LOCAL-MISSING", "S-NEXT"]);
  });

  it("T19: records/criteria whose effectiveFrom is after today are not used", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      byType(rs, "LOCAL_CENTER").effectiveFrom = "2026-12-01";
      const criteria = byType(rs, "ELIGIBILITY_ANY_OF").ruleData.criteria as Array<Record<string, unknown>>;
      criteria.find((c) => c.code === "DEMENTIA")!.effectiveFrom = "2027-01-01";
    });
    const r = await run(input({ location: TAIPEI_DISTRICT }), knowledge);
    expect(r.ruleTrace.templateIds).not.toContain("S-LOCAL-CENTER");
    expect(r.profile.summary).not.toContain("有失智症");
    expect(r.profile.summary).toContain("領有身心障礙證明");
  });

  it("T19b: records whose effectiveTo has passed are not used; amounts with future effectiveFrom are not listed", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      byType(rs, "LOCAL_CENTER").effectiveTo = "2026-09-23";
      const ad = byType(rs, "BENEFIT_AMOUNTS").ruleData.assistiveDevice3Years as Record<string, unknown>;
      (ad.GROUP_2 as Record<string, unknown>).effectiveFrom = "2026-10-01";
    });
    const r = await run(input({ location: TAIPEI_DISTRICT, needs: { assistiveDevice: "YES" } }), knowledge);
    expect(r.ruleTrace.templateIds).not.toContain("S-LOCAL-CENTER");
    expect(r.lines).toContain("輔具及居家無障礙環境改善服務：每 3 年給付一次，額度依核定組別為第一組 40,000 元。");
  });

  it("T20 sentinel: every policy value in the summary comes from knowledge (nothing hardcoded)", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      const channels = byType(rs, "APPLICATION_CHANNELS").ruleData;
      channels.hotline = { number: "0999-777", hours: "Tue-Thu 07:07-09:09" };
      byType(rs, "LEVEL_RANGE").ruleData.benefitEligibleMin = 97;
      const amounts = byType(rs, "BENEFIT_AMOUNTS").ruleData;
      amounts.careAndProfessionalMonthly = { "91": 111111, "93": 333333 };
      amounts.respiteYearly = { "91": 444444, "92": 555555 };
      amounts.assistiveDevice3Years = { GROUP_1: 666666 };
      amounts.transportationMonthlyByZone = { "71": 777777, "72": 888888 };
      byType(rs, "TRANSPORT_ZONE").ruleData.zones = { 臺北市: { default: 71 }, 新北市: { default: 72 } };
      byType(rs, "COPAY_RATES").ruleData.rates = { CARE_AND_PROFESSIONAL: { "1": 61, "2": 62, "3": 63 } };
      const elig = byType(rs, "ELIGIBILITY_ANY_OF").ruleData;
      elig.criteria = [{ code: "SENTINEL_AGE_CODE" }, { code: "DISABILITY_CERTIFICATE" }];
      Object.assign(byType(rs, "LOCAL_CENTER").ruleData, { address: "哨兵路 1 號", phone: "0999-888" });
    });
    const r = await run(
      input({ ageRange: "75_84", location: TAIPEI_DISTRICT, caregiverSituation: "FAMILY_AVAILABLE", needs: ALL("YES") }),
      knowledge
    );
    const s = r.profile.summary;
    for (const sentinel of [
      "0999-777",
      "週二至週四 7:07–9:09",
      "第 97 級",
      "111,111 至 333,333 元（第 91 至第 93 級）",
      "444,444 至 555,555 元",
      "第一組 666,666 元",
      "第 71 區，每月額度 777,777 元",
      "第一類（低收入戶、中低收入戶等）61%、第二類 62%、第三類（一般戶）63%",
      "哨兵路 1 號，電話 0999-888",
    ])
      expect(s).toContain(sentinel);
    for (const original of ["1966", "10,020", "36,180", "32,340", "48,510", "40,000", "60,000", "1,680", "16%", "8:30", "第 2 級", "錦州街"])
      expect(s).not.toContain(original);
    // 年齡 code 被換成對照表沒有的哨兵 code → 年齡句不出現（不自行猜測年齡門檻）
    expect(r.ruleTrace.templateIds).not.toContain("S-ELIG-AGE");
  });

  it("T21: two effective PUBLISHED records with the same type+jurisdiction → sentences omitted and conflict logged", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      const dup = structuredClone(byType(rs, "BENEFIT_AMOUNTS"));
      rs.push({ ...dup, id: "KREC-DUP", packRecordId: "KR-2026-904" });
    });
    const r = await run(input({ location: NTPC("三重區"), needs: ALL("YES") }), knowledge);
    expect(r.ruleTrace.templateIds.filter((t) => t.startsWith("S-SUB-"))).toEqual([]);
    expect(r.diagnostics).toContainEqual({
      event: "KNOWLEDGE_CONFLICT",
      ruleDataType: "BENEFIT_AMOUNTS",
      jurisdiction: "TAIWAN",
      knowledgeVersion: "KB-FIXTURE-001",
    });
  });

  it("T22: criteria code missing from the display table → item omitted and flagged for table update", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      (byType(rs, "ELIGIBILITY_ANY_OF").ruleData.criteria as unknown[]).push({ code: "NEW_UNMAPPED_CODE" });
    });
    const r = await run(input(), knowledge);
    expect(r.lines[1]).toBe(
      "是否符合申請條件，需依年滿 65 歲、具原住民身分且年滿 55 歲、領有身心障礙證明、有失智症或屬急性後期整合照護計畫收案對象等情況由照管專員評估。"
    );
    expect(r.diagnostics).toContainEqual({
      event: "UNMAPPED_CODE",
      ruleDataType: "ELIGIBILITY_ANY_OF",
      code: "NEW_UNMAPPED_CODE",
      knowledgeVersion: "KB-FIXTURE-001",
    });
  });

  it("T23: HOME_CARE + NO_CAREGIVER → no S-SUB-RESPITE", async () => {
    const r = await run(input({ caregiverSituation: "NO_CAREGIVER", needs: { homeCare: "YES" } }));
    expect(r.ruleTrace.templateIds).toContain("S-SUB-CARE");
    expect(r.ruleTrace.templateIds).not.toContain("S-SUB-RESPITE");
  });

  it("T25: disabilityCertificate not provided → treated as UNKNOWN, shows S-DIS-HINT, no VALIDATION_ERROR", async () => {
    const r = await run(input());
    expect(r.ruleTrace.templateIds).toContain("S-DIS-HINT");
  });

  it("T26: disabilityCertificate = NO → no S-DIS-* and no S-ELIG-DIS", async () => {
    const r = await run(input({ disabilityCertificate: "NO", ageRange: "50_64" }));
    for (const id of ["S-DIS-HINT", "S-DIS-INTRO", "S-DIS-MED", "S-DIS-AD-LOCAL", "S-DIS-SOURCE", "S-ELIG-DIS"]) {
      expect(r.ruleTrace.templateIds).not.toContain(id);
    }
  });

  it("T27: YES, ageRange = 50_64 → S-ELIG-DIS shows, not S-ELIG-OTHER", async () => {
    const r = await run(input({ disabilityCertificate: "YES", ageRange: "50_64" }));
    expect(r.ruleTrace.templateIds).toContain("S-ELIG-DIS");
    expect(r.ruleTrace.templateIds).not.toContain("S-ELIG-OTHER");
    expect(r.profile.summary).toContain("您表示領有身心障礙證明，依規定可能符合長照服務的申請條件，實際仍需經照管專員評估。");
  });

  it("T28: YES, 新北市, careNeeds 含 ASSISTIVE_DEVICE 與 HOME_MEDICAL_NURSING → S-DIS-INTRO+MED+AD-LOCAL+SOURCE, amounts from knowledge only", async () => {
    const r = await run(
      input({
        disabilityCertificate: "YES",
        location: NTPC("板橋區"),
        needs: { assistiveDevice: "YES", medicalNursing: "YES" },
      })
    );
    expect(r.ruleTrace.templateIds).toEqual(
      expect.arrayContaining(["S-DIS-INTRO", "S-DIS-MED", "S-DIS-AD-LOCAL", "S-DIS-SOURCE"])
    );
    expect(r.lines).toContain(
      "居家使用的醫療輔具補助：例如電動拍痰器 15,000／11,300／7,500 元、非蓄電式抽痰機 5,000／3,800／2,500 元、蓄電式（交直流兩用）抽痰機 10,000／7,500／5,000 元（低收／中低收／一般戶），共 10 項，每項上限依身分別而定；需三個月內的專科醫師診斷證明。"
    );
    expect(r.lines).toContain(
      "新北市身心障礙者輔具加碼補助：例如人工電子耳耗材 5,000 元、義肢護套 3,000 元、特製手搖三輪車 10,000 元；標示項目不論身分別皆可補助至上限。"
    );
    expect(r.lines).toContain(
      "身心障礙福利補助依據：全國法規資料庫〈身心障礙者醫療輔具補助標準（呼吸類）〉（2022-01-01 起適用）、新北市政府社會局〈新北市身心障礙者輔具費用補助（新北市加碼項目）〉（2026-09-24 起適用）；實際補助以主管機關核定為準。"
    );
  });

  it("T29: YES, 臺北市, careNeeds 含 ASSISTIVE_DEVICE → no 新北市's S-DIS-AD-LOCAL (local isolation)", async () => {
    const r = await run(
      input({ disabilityCertificate: "YES", location: TAIPEI_DISTRICT, needs: { assistiveDevice: "YES" } })
    );
    expect(r.ruleTrace.templateIds).not.toContain("S-DIS-AD-LOCAL");
    expect(r.profile.summary).not.toContain("新北市身心障礙者輔具加碼補助");
  });

  it("T30: YES, but careNeeds and mobilityLevel don't match S-DIS-MED/S-DIS-AD-LOCAL → no S-DIS-INTRO (no empty heading)", async () => {
    const r = await run(input({ disabilityCertificate: "YES" }));
    expect(r.ruleTrace.templateIds).not.toContain("S-DIS-INTRO");
    expect(r.ruleTrace.templateIds).not.toContain("S-DIS-MED");
    expect(r.ruleTrace.templateIds).not.toContain("S-DIS-AD-LOCAL");
  });

  it("T32: incomeCategory not provided or UNKNOWN → identical to r4 output (no S-EST-*)", async () => {
    const withField = await run(input({ ageRange: "75_84", location: NTPC("三重區"), needs: ALL("YES"), incomeCategory: "UNKNOWN" }));
    const withoutField = await run(input({ ageRange: "75_84", location: NTPC("三重區"), needs: ALL("YES") }));
    expect(withField.lines).toEqual(withoutField.lines);
    expect(withField.ruleTrace.templateIds.some((t) => t.startsWith("S-EST-"))).toBe(false);
  });

  it("T33: GENERAL + HOME_CARE → S-EST-COPAY 16%, S-EST-CARE FLOOR amounts, no three-tier S-SUB-COPAY", async () => {
    const r = await run(input({ incomeCategory: "GENERAL", needs: { homeCare: "YES" } }));
    expect(r.ruleTrace.templateIds).not.toContain("S-SUB-COPAY");
    expect(r.lines).toContain("使用長照服務的自付比例：照顧及專業服務 16%。");
    expect(r.lines).toContain(
      "照顧及專業服務：若核定第 2 級並用滿每月額度 10,020 元，您每月約自付 1,603 元；若核定第 8 級（36,180 元），約自付 5,788 元。"
    );
  });

  it("T34: MIDDLE_LOW_INCOME → tier 1, rate 0% → 可能免自付; disability subsidy uses MIDDLE_LOW_INCOME field", async () => {
    const r = await run(
      input({
        incomeCategory: "MIDDLE_LOW_INCOME",
        disabilityCertificate: "YES",
        location: NTPC("板橋區"),
        needs: { homeCare: "YES", medicalNursing: "YES" },
      })
    );
    expect(r.lines).toContain("使用長照服務的自付比例：照顧及專業服務可能免自付。");
    expect(r.profile.summary).toContain(
      "依您選擇的經濟身分（中低收入戶，長照身分別約為第 1 類），估算如下；實際身分別以主管機關認定為準："
    );
    // DISABILITY_MEDICAL_DEVICE_SUBSIDY.incomeOrder[1] = MIDDLE_LOW_INCOME → items[].max[1]
    expect(r.profile.summary).toContain("電動拍痰器最高補助 11,300 元");
  });

  it("T35: ALLOWANCE, 新北市烏來區, TRANSPORTATION → tier 2, zone 4 rate 7%, 2,400 元 → 168 元", async () => {
    const r = await run(input({ incomeCategory: "ALLOWANCE", location: NTPC("烏來區"), needs: { transportation: "YES" } }));
    expect(r.profile.summary).toContain("長照身分別約為第 2 類");
    expect(r.lines).toContain(
      "交通接送：每趟車資您自付 7%，用滿每月額度 2,400 元時約自付 168 元；超出額度的車資需全額自費。"
    );
  });

  it("T36: GENERAL, disabilityCertificate YES, 新北市, ASSISTIVE_DEVICE → non-※ item uses FLOOR(amount × 50%); ※ items show full amount", async () => {
    // LOCAL_DISABILITY_AD_TOPUP 的正式資料裡，非動力樓梯滑椅（fullAmountAllIncome=false）排在陣列第 8 項，
    // 不在§6.5「取前 3 項」範圍內；這裡用合成快照把它換到最前面，單獨驗證 FLOOR(amount × incomeShareOfMax) 公式
    // 與「※ 項目全額」邏輯本身是否正確，而不是重現正式資料的實際顯示內容。
    const knowledge = fixtureSnapshot((rs) => {
      const topup = rs.find((r) => r.ruleData.type === "LOCAL_DISABILITY_AD_TOPUP")!;
      const items = topup.ruleData.items as Array<Record<string, unknown>>;
      const stairLift = items.find((it) => it.name === "非動力樓梯滑椅")!;
      const starred = items.find((it) => it.fullAmountAllIncome === true)!;
      topup.ruleData.items = [stairLift, starred];
    });
    const r = await run(
      input({
        incomeCategory: "GENERAL",
        disabilityCertificate: "YES",
        location: NTPC("板橋區"),
        needs: { assistiveDevice: "YES" },
      }),
      knowledge
    );
    expect(r.profile.summary).toContain("非動力樓梯滑椅最高補助 10,000 元"); // 20,000 × 50% (FLOOR) = 10,000
    // ※ 項目（fullAmountAllIncome=true）在估算中仍顯示全額，不打折扣。
    const starredAmountText = r.profile.summary.match(/(義肢護套|人工電子耳耗材|特製手搖三輪車)最高補助 ([\d,]+) 元/);
    expect(starredAmountText).not.toBeNull();
  });

  it("T37 sentinel: rates, amounts and disability caps replaced with sentinel values → estimate uses only sentinel values", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      byType(rs, "COPAY_RATES").ruleData.rates = { CARE_AND_PROFESSIONAL: { "1": 71, "2": 72, "3": 73 } };
      byType(rs, "BENEFIT_AMOUNTS").ruleData.careAndProfessionalMonthly = { "91": 100000, "93": 200000 };
      const med = byType(rs, "DISABILITY_MEDICAL_DEVICE_SUBSIDY");
      med.ruleData.items = [{ name: "哨兵輔具", max: [911111, 922222, 933333] }];
    });
    const r = await run(
      input({ incomeCategory: "GENERAL", disabilityCertificate: "YES", needs: { homeCare: "YES", medicalNursing: "YES" } }),
      knowledge
    );
    expect(r.profile.summary).toContain("73%");
    expect(r.profile.summary).toContain("哨兵輔具最高補助 933,333 元");
    // 100,000 × 73% (FLOOR) = 73,000；200,000 × 73% (FLOOR) = 146,000
    expect(r.profile.summary).toContain("您每月約自付 73,000 元");
    expect(r.profile.summary).toContain("約自付 146,000 元");
    for (const original of ["16%", "10,020", "36,180", "7,500", "11,300"]) expect(r.profile.summary).not.toContain(original);
  });
});

describe("summary matches the J-002-r4 contract example (contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json)", () => {
  it("reproduces the mock summary line by line from the fixture knowledge", async () => {
    // 逐字取自 PR #31 的 Mock（數值來自 KP-2026-09-23-001，仍為 NEEDS_REVIEW；此處只驗證模板組裝）。
    // 注意：contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json 早於 D-17（2026-09-24）建立，
    // 未重新產生，因此檔案本身缺少 disabilityCertificate=UNKNOWN 時應出現的 S-DIS-HINT 句
    // （ASSESSMENT_RULES §6.5：「只在 disabilityCertificate = YES 時出現（UNKNOWN 只出現 S-DIS-HINT）」）。
    // 以 ASSESSMENT_RULES.md（較高規格順位）為準，在此手動補上這一句，而不是依賴過時的 Mock 檔案。
    const expected = [
      "依您目前提供的資訊，可能優先需要居家照顧，也可能需要長照交通接送、輔具與居家無障礙。",
      "依年齡，可能符合長照服務的申請條件，實際仍需經照管專員評估。",
      "若經照管專員評估為長照需要等級第 2 級以上，依官方規定可能可使用下列長照給付；以下為官方公告的規則與上限，不是您的核定結果。",
      "照顧及專業服務：每月額度依核定等級約 10,020 至 36,180 元（第 2 至第 8 級），按月給付，以 6 個月為一期。",
      "家庭照顧者喘息服務：每年額度依核定等級約 32,340 至 48,510 元。",
      "輔具及居家無障礙環境改善服務：每 3 年給付一次，額度依核定組別為第一組 40,000 元、第二組 60,000 元。",
      "交通接送服務：新北市三重區屬交通接送第 2 區，每月額度 1,840 元，限用於就醫、復健或透析治療。",
      "使用長照服務需依長照身分別自付部分費用，比率依服務項目不同，例如照顧及專業服務：第一類（低收入戶、中低收入戶等）0%、第二類 5%、第三類（一般戶）16%。身分別由主管機關認定。",
      "以上制度與金額依據：全國法規資料庫〈長照需要等級〉（2025-09-01 起適用）、全國法規資料庫〈長照給付項目與交通接送用途〉（2025-09-01 起適用）、全國法規資料庫〈各長照需要等級的給付額度〉（2025-09-01 起適用）、全國法規資料庫〈交通接送服務分區（臺北市、新北市）〉（2025-09-01 起適用）、全國法規資料庫〈長照身分別與部分負擔比率〉（2025-09-01 起適用）、全國法規資料庫〈給付額度的週期〉（2025-09-01 起適用）；平台知識版本 KB-MOCK-001。",
      "實際長照等級、給付額度與自付金額，須經照管專員評估核定後才確定。",
      "若領有身心障礙證明，另有醫療輔具等身心障礙福利補助可申請，可洽戶籍所在地衛生局或社會局。",
      "新北市的地方規定與資源目前尚未收錄於平台，請洽 1966 或新北市長期照顧管理中心確認；平台不會以其他縣市的規定代替。",
      "下一步可撥打長照專線 1966（週一至週五 8:30–12:00、13:30–17:30）申請到府評估。",
    ];
    const r = await run(
      input({
        ageRange: "75_84",
        location: NTPC("三重區"),
        livingSituation: "WITH_FAMILY",
        caregiverSituation: "FAMILY_LIMITED",
        mobilityLevel: "BEDRIDDEN",
        needs: { homeCare: "YES", medicalNursing: "NO", assistiveDevice: "YES", transportation: "YES" },
      }),
      fixtureSnapshot(undefined, "KB-MOCK-001")
    );
    expect(r.profile.careNeeds).toEqual(["HOME_CARE", "ASSISTIVE_DEVICE", "TRANSPORTATION"]);
    expect(r.profile.priority).toEqual(["HOME_CARE", "TRANSPORTATION", "ASSISTIVE_DEVICE"]);
    expect(r.lines).toEqual(expected);
    expect(r.rulesVersion).toBe(RULES_VERSION);
  });
});

describe("local knowledge isolation (臺北市 / 新北市)", () => {
  const localApplication = (jurisdiction: "TAIPEI" | "NEW_TAIPEI", packRecordId: string): KnowledgeSnapshotRecord => ({
    id: `KREC-${packRecordId}`,
    packRecordId,
    title: `合成地方申請管道 ${jurisdiction}`,
    category: "APPLICATION",
    jurisdiction,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    summary: `合成${jurisdiction}地方申請管道摘要。`,
    ruleData: { type: "LOCAL_APPLICATION" },
    authority: jurisdiction === "TAIPEI" ? "TAIPEI_GOV" : "NEW_TAIPEI_GOV",
  });

  it("a 臺北市 user only sees 臺北市 local records; a 新北市 user never gets 臺北市 rules as substitute", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      rs.push(localApplication("TAIPEI", "KR-SYN-TPE"));
    });
    const tpe = await run(input({ location: TAIPEI_DISTRICT }), knowledge);
    expect(tpe.lines).toContain(
      "臺北市：合成TAIPEI地方申請管道摘要（依據：臺北市政府〈合成地方申請管道 TAIPEI〉，2026-01-01 起適用）。"
    );
    expect(tpe.ruleTrace.templateIds).not.toContain("S-LOCAL-MISSING");

    const ntpc = await run(input({ location: NTPC("板橋區") }), knowledge);
    expect(ntpc.profile.summary).not.toContain("合成TAIPEI");
    expect(ntpc.ruleTrace.templateIds).toContain("S-LOCAL-MISSING");
    expect(ntpc.ruleTrace.knowledgeRecordIds).not.toContain("KREC-KR-SYN-TPE");
  });

  it("a 新北市 record is never shown to 臺北市 or no-location users", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      rs.push(localApplication("NEW_TAIPEI", "KR-SYN-NTPC"));
    });
    for (const location of [TAIPEI_DISTRICT, { city: null, district: null, precision: "NONE" as const, lat: null, lng: null }]) {
      const r = await run(input({ location }), knowledge);
      expect(r.profile.summary).not.toContain("合成NEW_TAIPEI");
    }
    const ntpc = await run(input({ location: NTPC(null) }), knowledge);
    expect(ntpc.ruleTrace.templateIds).toContain("S-LOCAL-INFO");
  });

  it("no location still produces care needs (location is not required for the assessment)", async () => {
    const r = await run(input({ dailyLivingLevel: "HIGH_ASSISTANCE", mobilityLevel: "WHEELCHAIR" }));
    expect(r.profile.careNeeds).toEqual(["HOME_CARE", "ASSISTIVE_DEVICE", "TRANSPORTATION"]);
    expect(r.ruleTrace.templateIds).toContain("S-LOCAL-NOCITY");
  });
});

describe("keyword matching (§4)", () => {
  it("normalizes full-width characters, spaces and punctuation", () => {
    expect(normalizeFreeText("輪　椅，ＡＢＣ １２３！")).toBe("輪椅ABC123");
  });

  it("matches keywords split by spaces/punctuation after normalization", async () => {
    const r = await run(input({ freeText: "家裡需要 輪，椅" }));
    expect(r.profile.careNeeds).toContain("ASSISTIVE_DEVICE");
  });

  it("negation only applies within 4 characters before the keyword", () => {
    expect(matchesKeyword(normalizeFreeText("沒有跌倒"), "跌倒")).toBe(false);
    expect(matchesKeyword(normalizeFreeText("已經不用拐杖"), "拐杖")).toBe(false);
    expect(matchesKeyword(normalizeFreeText("不過最近開始常跌倒"), "跌倒")).toBe(true);
    // 第一次出現被否定、第二次沒有 → 命中
    expect(matchesKeyword(normalizeFreeText("以前不用輪椅，現在出門都坐輪椅"), "輪椅")).toBe(true);
  });

  it("keywords never override YES/NO answers and never trigger when a structured rule already did", async () => {
    const r = await run(input({ mobilityLevel: "WHEELCHAIR", freeText: "需要輪椅" }));
    expect(r.ruleTrace.needs.find((n) => n.need === "ASSISTIVE_DEVICE")).toEqual({
      need: "ASSISTIVE_DEVICE",
      basis: "STRUCTURED_RULE",
      ruleIds: ["AD-R1"],
    });
  });

  it("ruleTrace never contains free text or matched fragments", async () => {
    const secret = "阿嬤獨居常跌倒要洗腎傷口換藥";
    const r = await run(input({ freeText: secret }));
    const trace = JSON.stringify(r.ruleTrace) + JSON.stringify(r.diagnostics);
    for (const fragment of ["獨居", "跌倒", "洗腎", "傷口", "阿嬤"]) expect(trace).not.toContain(fragment);
    expect(r.profile.summary).not.toContain("阿嬤");
    expect(r.ruleTrace.needs.map((n) => n.ruleIds[0])).toEqual(["KW-HC", "KW-MN", "KW-AD", "KW-TR"]);
  });
});

describe("hotline hours formatting (§6.4)", () => {
  it("formats the official hours string and omits unparseable formats", () => {
    expect(formatHotlineHours("Mon-Fri 08:30-12:00,13:30-17:30")).toBe("週一至週五 8:30–12:00、13:30–17:30");
    expect(formatHotlineHours("weekdays")).toBeNull();
    expect(formatHotlineHours(undefined)).toBeNull();
  });
});

describe("no policy values hardcoded in the engine source (ASSESSMENT_RULES §10)", () => {
  it("src/assessment/*.ts contains no amounts, hotline number, service hours or addresses", () => {
    const dir = fileURLToPath(new URL("../src/assessment/", import.meta.url));
    const source = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(dir + f, "utf8"))
      .join("\n");
    for (const value of ["1966", "10020", "10,020", "36180", "1680", "1,680", "1840", "2400", "32340", "48510", "40000", "08:30", "8:30", "錦州街"])
      expect(source).not.toContain(value);
  });
});
