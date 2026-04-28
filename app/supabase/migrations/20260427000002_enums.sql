-- Migration 02: Enums and types
-- All enum types used across the schema. Defined upfront so subsequent
-- migrations can reference them without ordering issues.

CREATE TYPE user_role AS ENUM (
  'admin',
  'sourcing',
  'warehouse',
  'fulfiller',
  'ksa_operator'
);

CREATE TYPE region_code AS ENUM ('US', 'EU', 'KSA', 'GLOBAL');

CREATE TYPE currency_code AS ENUM ('SAR', 'USD', 'EUR', 'GBP', 'AED');

CREATE TYPE notification_severity AS ENUM ('critical', 'warning', 'info', 'success');

CREATE TYPE invoice_language AS ENUM ('en', 'ar', 'bilingual');

CREATE TYPE ai_confidence AS ENUM ('high', 'medium', 'low', 'failed');

CREATE TYPE invoice_status AS ENUM ('draft', 'pending_review', 'approved', 'sent', 'rejected');

CREATE TYPE ocr_state AS ENUM ('uploaded', 'extracting', 'extracted', 'mapped', 'failed');
