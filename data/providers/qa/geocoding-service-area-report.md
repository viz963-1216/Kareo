# A-003 Provider Geocoding + Service Area QA Report

## Overview

This report documents the second-round QA for the A-002 Provider Dataset.

Scope:

- Provider geocoding verification
- Provider address / city / district consistency
- Provider Service Area verification
- Google Maps URL usability
- Unverifiable data tracking

Dataset:

- Provider count: 30
- Service Area count: 81

## 1. Address Consistency QA

- Providers checked: 30
- Address / City / District mismatch: 0
- Result: PASS

All 30 Provider records have addresses consistent with their `city` and `district` fields.

## 2. Geocoding QA

- Providers checked: 30
- Providers with verified coordinates: 0
- Providers with unverifiable coordinates: 30

All Provider `lat` and `lng` values remain `null`.

Coordinates were not inferred or guessed. Only coordinates from a traceable and verifiable source may be added to the Provider dataset.

The NLSC address service was reviewed as a potential official geocoding source, but no verified address-to-coordinate workflow was established during this QA pass. Therefore, no coordinates were added.

## 3. Service Area QA

### Referential Integrity

- Service Area records checked: 81
- Missing Provider references: 0
- Result: PASS

All Provider Service Area records reference an existing Provider.

### Taipei HOME_CARE Verification

- Providers checked: 10
- Service Area records checked: 61
- Source: SRC-001
- Official source field: 特約服務區域
- Address-derived Service Areas: 0
- Result: PASS

The 61 Service Area records for the 10 Taipei HOME_CARE Providers were checked against the official Taipei source.

The number and districts of the Service Area records matched the official `特約服務區域` information.

Provider physical addresses were not used to infer Service Areas.

### New Taipei HOME_CARE

- Service Area records currently present: 20
- Source registry reference: SRC-002
- Verification status: PENDING

The official source is registered in `source-registry.md`, but a complete local source artifact was not available during this QA pass for independent verification of all district-level Service Areas.

Existing Service Area records were therefore not expanded or modified based on Provider addresses.

`NTPC-HC-003` remains without district-level Service Area records because the available source information only identifies New Taipei City-level coverage.

### HOME_MEDICAL_NURSING

No district-level Provider Service Area records were created because the available official source does not provide Provider-specific district-level coverage.

### ASSISTIVE_DEVICE

No Provider Service Area records were created for assistive-device Providers when the official source did not provide Provider-specific district-level coverage.

Provider physical addresses were not used to infer service coverage.

## 4. Google Maps URL QA

- Providers checked: 30
- Providers with Google Maps URL: 30
- Missing Google Maps URL: 0
- URL format: Google Maps Search URL
- Result: PASS

Google Maps search URLs were generated from each Provider's existing address using the same URL pattern already used by the Provider sample dataset.

A manual usability check was performed for `TP-HC-001`, and the generated URL successfully opened the corresponding address in Google Maps.

No Provider coordinates were inferred from Google Maps search results.