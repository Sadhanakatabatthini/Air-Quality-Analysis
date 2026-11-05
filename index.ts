export interface AirQualityRecord {
  id?: number;
  city: string;
  record_date: string; // YYYY-MM-DD
  aqi: number;
  pm25: number | null;
  pm10: number | null;
}

export type AQIStandard = 'CPCB' | 'US_EPA';

export interface AQICategoryDefinition {
  label: string;
  min: number;
  max: number;
  color: string;
  description: string;
}

export interface AuditReport {
  initial_row_count: number;
  valid_row_count: number;
  dropped_rows: number;
  missing_columns: string[];
  duplicate_rows_detected: number;
  invalid_dates_count: number;
  invalid_aqi_count: number;
  missing_pm25_count: number;
  missing_pm10_count: number;
  warnings: string[];
  errors: string[];
}

export interface SQLQueryCatalogItem {
  id: number;
  title: string;
  category: string;
  description: string;
  sql: string;
}
