# Kareo / 長照一點通 — System Architecture

Version: v0.1  
Status: LOCKED FOR MVP  
Owner: Jerry

> Kareo 目前作為專案代號使用。

---

# 1. 架構目標

本專案採用：

**Independent Development + Central Integration / 獨立開發 + Jerry 中心整合**

```text
                    Jerry
          產品規格 / 架構 / 整合
                     │
        ┌────────────┼────────────┐
        │            │            │
        A            B            C
     資料整理       後端          前端
```

核心原則：

- A / B / C 可以同時工作
- A / B / C 不直接整合彼此程式
- 不修改其他人的 Ownership
- 所有人遵守同一份 Spec
- 所有跨模組整合由 Jerry 完成

---

# 2. 整體系統

```text
使用者
  │
  ▼
Frontend Web（Engineer C）
  │
  │ API Contract
  ▼
Backend API（Engineer B）
  │
  ├───────────────┐
  │               │
  ▼               ▼
Provider DB    Knowledge DB
  │               │
  │               ▼
  │          Knowledge Crawler
  │
  ▼
Recommendation Engine
  │
  ▼
Top 3 Provider
```

交通需求另外走：

```text
TRANSPORTATION
      │
      ▼
External Link
      │
      ▼
taiwanjcare
```

taiwanjcare 不內嵌、不共用 Backend、不共用 Database。

---

# 3. Repository Structure

```text
/
├── AGENTS.md
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── API_CONTRACT.md
│   └── GIT_RULES.md
├── contracts/
│   ├── schemas/
│   └── mock/
├── tasks/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   ├── recommendation/
│   ├── knowledge/
│   └── crawler/
├── data/
│   └── providers/
├── tests/
└── .github/
```

---

# 4. Ownership

## Jerry

主要負責：

```text
/docs/**
/contracts/**
/tasks/**
/.github/**
```

中文：

- 產品規格
- 系統架構
- 資料模型
- API 規格
- Mock Data 標準
- 任務分配
- PR Review
- 最終整合
- Merge / Deploy

A / B / C 不得自行修改這些區域，除非 Task 明確授權。

## Engineer A / 工程師 A

主要負責：

```text
/data/providers/**
```

中文：

- Provider 原始資料
- 名稱、地址、電話整理
- 服務類別
- 服務範圍
- Google Maps URL
- 重複與缺漏資料清理
- Mock Provider Data
- 基本 QA

資料流程：

```text
原始 Provider 資料
↓
Engineer A 清洗
↓
data/providers/staging/
↓
Jerry Review
↓
Engineer B 匯入正式 Provider DB
```

A 不直接操作 Production Database。

## Engineer B / 工程師 B

主要負責：

```text
/apps/api/**
/services/recommendation/**
/services/knowledge/**
/services/crawler/**
```

中文：

- 後端 API
- Database
- Provider Backend
- Recommendation Engine
- Ranking
- Lead Backend
- Knowledge Database
- Knowledge Crawler
- Knowledge Change / Version

B 不修改前端 UI。

## Engineer C / 工程師 C

主要負責：

```text
/apps/web/**
```

中文：

- 首頁
- Consent / Disclaimer UI
- Assessment UI
- 初評結果
- Provider Top 3
- Provider Detail
- Google Maps CTA
- taiwanjcare CTA
- Lead Form
- Loading / Empty / Error
- RWD

C 不修改後端 Schema 或 Recommendation Logic。

---

# 5. Frontend 與 Backend 分離

Engineer C 不等待 Engineer B。

C 使用：

```text
/contracts/mock/**
```

中的 Mock Data 完成 UI。

Engineer B 只需依：

```text
docs/API_CONTRACT.md
```

完成正式 API。

最後由 Jerry 將 Mock API 替換為 Real API。

---

# 6. Recommendation Architecture

```text
Assessment
↓
CareNeedProfile
↓
Service Type
↓
Provider Filter
↓
Service Area Match
├─ 精確位置 → Distance Ranking
└─ 行政區   → Stable Rotation
↓
Top 3
```

AI 不直接選 Provider。

---

# 7. AI Architecture

正確流程：

```text
使用者資訊
↓
Assessment Service
↓
AI Adapter
↓
CareNeedProfile
↓
Recommendation Engine
↓
Provider DB
```

AI Provider 必須透過 Adapter 隔離，避免模型供應商被寫死在產品核心。

---

# 8. Knowledge Architecture

```text
Official Source
↓
Crawler
↓
Raw Snapshot
↓
Content Hash
↓
Compare
↓
KnowledgeChange
↓
AI Summary
↓
NEEDS_REVIEW
↓
Jerry / Admin Review
↓
APPROVED
↓
KnowledgeVersion
↓
PUBLISHED
```

只有 `PUBLISHED` 版本可供正式 Assessment 使用。

---

# 9. Knowledge 更新排程

Timezone：

```text
Asia/Taipei
```

建議每日：

```text
00:10
```

白名單來源：

- 衛生福利部
- 1966 / 長照專區
- 全國法規資料庫
- 臺北市政府
- 新北市政府

Crawler 發現變動時，只能建立 `KnowledgeChange`，不得直接改正式規則。

如果抓取失敗，繼續使用 Last Published Knowledge Version。

---

# 10. taiwanjcare Architecture

```text
CareNeedProfile
↓
TRANSPORTATION
↓
Frontend CTA
↓
Open New Tab
↓
taiwanjcare
```

MVP 禁止：

- iframe
- Backend Integration
- Database Integration
- Authentication Integration

---

# 11. Consent Architecture

正式 Assessment 前必須存在有效 Consent：

```text
Session
↓
Consent
├─ disclaimerVersion
├─ privacyVersion
└─ termsVersion
```

沒有 Consent 時，Backend 回傳：

```text
CONSENT_REQUIRED
```

---

# 12. Provider DB 與 Knowledge DB 分離

Provider DB 回答：

```text
可以找誰？
```

Knowledge DB 回答：

```text
目前制度怎麼規定？
```

兩者邏輯與資料模型必須分開。

---

# 13. Environment

至少分為：

```text
LOCAL
PREVIEW
PRODUCTION
```

A / B / C 不直接操作 Production。

Production Merge / Deploy 由 Jerry 負責。

---

# 14. Secret Rule

禁止將以下內容 Commit：

- API Key
- Database Secret
- Token
- Private Key

只能放 Environment Variables。

Frontend 不得包含 AI API Key。

---

# 15. Cross-module Rule

如果任何工程師發現需要修改其他模組：

```text
建立 Issue
↓
Jerry 判斷
↓
建立新的 Task
↓
對應 Owner 修改
```

不得直接跨 Ownership 修改。

---

# 16. Testing Boundary

Engineer A：Provider Data / 基本 QA  
Engineer B：API / Recommendation / Knowledge / Crawler  
Engineer C：UI / Flow / RWD / Loading / Empty / Error  
Jerry：Integration / End-to-End / Preview / Production

---

# 17. Definition of Integration

只有當：

```text
A Provider Data
+
B Backend
+
C Frontend
+
Knowledge
+
API Contract
+
Jerry Integration Test
```

全部通過後，才叫 `Integrated`。

個別工程師只能宣稱：

```text
Module Complete
```

---

# 18. Source of Truth

```text
PRODUCT_SPEC.md
↓
ARCHITECTURE.md
↓
DATA_MODEL.md
↓
API_CONTRACT.md
↓
GIT_RULES.md
↓
TASK
↓
Code
```

若衝突，停止修改並交由 Jerry 決定。
