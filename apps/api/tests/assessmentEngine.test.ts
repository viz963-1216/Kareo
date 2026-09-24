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

  it("T9: all UNKNOWN, empty freeText → empty; S-NONE + S-ELIG-UNKNOWN (+ S-LOCAL-NOCITY) + S-NEXT", async () => {
    const r = await run(input());
    expect(r.profile.careNeeds).toEqual([]);
    expect(r.ruleTrace.templateIds).toEqual(["S-NONE", "S-ELIG-UNKNOWN", "S-LOCAL-NOCITY", "S-NEXT"]);
    expect(r.lines[1]).toBe(
      "是否符合申請條件，需依年滿 65 歲、具原住民身分且年滿 55 歲、領有身心障礙證明、有失智症或屬急性後期整合照護計畫收案對象等情況由照管專員評估。"
    );
    expect(r.lines[3]).toBe("下一步可撥打長照專線 1966（週一至週五 8:30–12:00、13:30–17:30）申請到府評估。");
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
      "臺北市的地方補助資訊目前尚未收錄於平台，請洽 1966 或臺北市長期照顧管理中心確認；平台不會以其他縣市的規定代替。"
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
    for (const id of ["S-LOCAL-SUBSIDY", "S-LOCAL-MISSING", "S-LOCAL-CENTER"]) expect(r.ruleTrace.templateIds).not.toContain(id);
  });

  it("T18: PUBLISHED version without BENEFIT_AMOUNTS → every amount sentence omitted, no default numbers", async () => {
    const knowledge = fixtureSnapshot((rs) => rs.filter((r) => r.ruleData.type !== "BENEFIT_AMOUNTS"));
    const r = await run(input({ ageRange: "75_84", location: NTPC("三重區"), caregiverSituation: "FAMILY_LIMITED", needs: ALL("YES") }), knowledge);
    expect(r.ruleTrace.templateIds.filter((t) => t.startsWith("S-SUB-"))).toEqual([]);
    expect(r.profile.summary).not.toContain("元");
    expect(r.ruleTrace.templateIds).toEqual(["S-NEEDS", "S-ELIG-AGE", "S-LOCAL-MISSING", "S-NEXT"]);
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
});

describe("summary matches the J-002-r4 contract example (contracts/mock/assessments/WITH-SUBSIDY-NEW_TAIPEI.json)", () => {
  it("reproduces the mock summary line by line from the fixture knowledge", async () => {
    // 逐字取自 PR #31 的 Mock（數值來自 KP-2026-09-23-001，仍為 NEEDS_REVIEW；此處只驗證模板組裝）。
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
      "新北市的地方補助資訊目前尚未收錄於平台，請洽 1966 或新北市長期照顧管理中心確認；平台不會以其他縣市的規定代替。",
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
  const localSubsidy = (jurisdiction: "TAIPEI" | "NEW_TAIPEI", packRecordId: string): KnowledgeSnapshotRecord => ({
    id: `KREC-${packRecordId}`,
    packRecordId,
    title: `合成地方補助 ${jurisdiction}`,
    category: "BENEFIT",
    jurisdiction,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    summary: `合成${jurisdiction}地方補助摘要。`,
    ruleData: { type: "LOCAL_SUBSIDY_SYNTHETIC" },
    authority: jurisdiction === "TAIPEI" ? "TAIPEI_GOV" : "NEW_TAIPEI_GOV",
  });

  it("a 臺北市 user only sees 臺北市 local records; a 新北市 user never gets 臺北市 rules as substitute", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      rs.push(localSubsidy("TAIPEI", "KR-SYN-TPE"));
    });
    const tpe = await run(input({ location: TAIPEI_DISTRICT }), knowledge);
    expect(tpe.lines).toContain(
      "臺北市地方補助：合成TAIPEI地方補助摘要（依據：臺北市政府〈合成地方補助 TAIPEI〉，2026-01-01 起適用）。"
    );
    expect(tpe.ruleTrace.templateIds).not.toContain("S-LOCAL-MISSING");

    const ntpc = await run(input({ location: NTPC("板橋區") }), knowledge);
    expect(ntpc.profile.summary).not.toContain("合成TAIPEI");
    expect(ntpc.ruleTrace.templateIds).toContain("S-LOCAL-MISSING");
    expect(ntpc.ruleTrace.knowledgeRecordIds).not.toContain("KREC-KR-SYN-TPE");
  });

  it("a 新北市 record is never shown to 臺北市 or no-location users", async () => {
    const knowledge = fixtureSnapshot((rs) => {
      rs.push(localSubsidy("NEW_TAIPEI", "KR-SYN-NTPC"));
    });
    for (const location of [TAIPEI_DISTRICT, { city: null, district: null, precision: "NONE" as const, lat: null, lng: null }]) {
      const r = await run(input({ location }), knowledge);
      expect(r.profile.summary).not.toContain("合成NEW_TAIPEI");
    }
    const ntpc = await run(input({ location: NTPC(null) }), knowledge);
    expect(ntpc.ruleTrace.templateIds).toContain("S-LOCAL-SUBSIDY");
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
