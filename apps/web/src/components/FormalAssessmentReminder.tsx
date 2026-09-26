// PRODUCT_SPEC §34: the formal-assessment reminder appears before the assessment, on the result, next to
// subsidy information, on recommendations and in the footer. One wording keeps every page consistent.
export const FORMAL_ASSESSMENT_REMINDER =
  "本平台提供的結果僅為初步預估，不代表正式長照資格、長照等級或補助核定結果。實際資格、服務內容與補助，仍應由 1966 或所在地長期照顧管理中心進行正式評估確認。";

export function FormalAssessmentReminder({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "footer-reminder" : "formal-reminder"}>
      <strong>正式評估提醒：</strong>
      {FORMAL_ASSESSMENT_REMINDER}
    </p>
  );
}
