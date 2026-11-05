import { AirQualityRecord, AuditReport } from '../types';

const COLUMN_ALIASES: Record<string, string> = {
  city: 'city',
  location: 'city',
  station_city: 'city',
  place: 'city',

  date: 'record_date',
  record_date: 'record_date',
  timestamp: 'record_date',
  datetime: 'record_date',
  day: 'record_date',

  aqi: 'aqi',
  air_quality_index: 'aqi',
  overall_aqi: 'aqi',

  pm25: 'pm25',
  'pm2.5': 'pm25',
  pm2_5: 'pm25',
  pm_25: 'pm25',
  'pm_2.5': 'pm25',

  pm10: 'pm10',
  pm_10: 'pm10',
};

export function parseAndValidateCSV(csvText: string): { records: AirQualityRecord[]; audit: AuditReport } {
  const audit: AuditReport = {
    initial_row_count: 0,
    valid_row_count: 0,
    dropped_rows: 0,
    missing_columns: [],
    duplicate_rows_detected: 0,
    invalid_dates_count: 0,
    invalid_aqi_count: 0,
    missing_pm25_count: 0,
    missing_pm10_count: 0,
    warnings: [],
    errors: [],
  };

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    audit.errors.push('CSV file is empty or does not contain header and data rows.');
    return { records: [], audit };
  }

  // Parse header
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const headerMap: { [normalized: string]: number } = {};

  rawHeaders.forEach((h, index) => {
    const clean = h.toLowerCase();
    if (COLUMN_ALIASES[clean]) {
      headerMap[COLUMN_ALIASES[clean]] = index;
    } else {
      headerMap[clean] = index;
    }
  });

  const required = ['city', 'record_date', 'aqi'];
  const missing = required.filter(r => headerMap[r] === undefined);
  if (missing.length > 0) {
    audit.missing_columns = missing;
    audit.errors.push(`Missing required column(s): ${missing.join(', ')}. Required columns: City, Date, and AQI.`);
    return { records: [], audit };
  }

  const dataRows = lines.slice(1);
  audit.initial_row_count = dataRows.length;

  const validRecords: AirQualityRecord[] = [];
  const seenCityDate = new Set<string>();

  dataRows.forEach((rowStr) => {
    // Simple CSV row parser handling quotes
    const cells: string[] = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        cells.push(currentCell.trim().replace(/^["']|["']$/g, ''));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim().replace(/^["']|["']$/g, ''));

    const city = cells[headerMap['city']]?.trim();
    const rawDate = cells[headerMap['record_date']]?.trim();
    const rawAqi = cells[headerMap['aqi']]?.trim();

    // 1. City check
    if (!city || city.toLowerCase() === 'nan' || city.toLowerCase() === 'null') {
      audit.dropped_rows++;
      return;
    }

    // 2. Date parse check
    const dateObj = new Date(rawDate);
    if (isNaN(dateObj.getTime())) {
      audit.invalid_dates_count++;
      audit.dropped_rows++;
      return;
    }
    const isoDate = dateObj.toISOString().split('T')[0];

    // 3. AQI numeric check
    const aqiNum = parseFloat(rawAqi);
    if (isNaN(aqiNum) || aqiNum < 0 || aqiNum > 2000) {
      audit.invalid_aqi_count++;
      audit.dropped_rows++;
      return;
    }

    // 4. Check duplicates
    const key = `${city.toLowerCase()}|${isoDate}`;
    if (seenCityDate.has(key)) {
      audit.duplicate_rows_detected++;
      // We will replace with the latest occurrence
      const existingIdx = validRecords.findIndex(r => r.city.toLowerCase() === city.toLowerCase() && r.record_date === isoDate);
      if (existingIdx !== -1) {
        validRecords.splice(existingIdx, 1);
      }
    }
    seenCityDate.add(key);

    // 5. Parse PM2.5 and PM10
    let pm25Val: number | null = null;
    if (headerMap['pm25'] !== undefined) {
      const rawPm25 = cells[headerMap['pm25']]?.trim();
      if (rawPm25 && rawPm25 !== '' && !isNaN(parseFloat(rawPm25)) && parseFloat(rawPm25) >= 0) {
        pm25Val = parseFloat(rawPm25);
      } else {
        audit.missing_pm25_count++;
      }
    }

    let pm10Val: number | null = null;
    if (headerMap['pm10'] !== undefined) {
      const rawPm10 = cells[headerMap['pm10']]?.trim();
      if (rawPm10 && rawPm10 !== '' && !isNaN(parseFloat(rawPm10)) && parseFloat(rawPm10) >= 0) {
        pm10Val = parseFloat(rawPm10);
      } else {
        audit.missing_pm10_count++;
      }
    }

    validRecords.push({
      city,
      record_date: isoDate,
      aqi: Math.round(aqiNum),
      pm25: pm25Val,
      pm10: pm10Val,
    });
  });

  if (audit.duplicate_rows_detected > 0) {
    audit.warnings.push(`Detected ${audit.duplicate_rows_detected} duplicate (city, date) entries. Retained latest row per unique day.`);
  }

  if (audit.dropped_rows > 0) {
    audit.warnings.push(`Sanitized dataset: dropped ${audit.dropped_rows} unparseable, blank or out-of-range rows.`);
  }

  audit.valid_row_count = validRecords.length;
  return { records: validRecords, audit };
}
