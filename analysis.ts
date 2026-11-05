import { AirQualityRecord, AQIStandard, AQICategoryDefinition } from '../types';

export const CPCB_CATEGORIES: AQICategoryDefinition[] = [
  { label: 'Good', min: 0, max: 50, color: '#16a34a', description: 'Minimal health impact' },
  { label: 'Satisfactory', min: 51, max: 100, color: '#65a30d', description: 'Minor breathing discomfort to sensitive people' },
  { label: 'Moderate', min: 101, max: 200, color: '#d97706', description: 'Breathing discomfort to people with lungs/heart disease' },
  { label: 'Poor', min: 201, max: 300, color: '#ea580c', description: 'Breathing discomfort to most people on prolonged exposure' },
  { label: 'Very Poor', min: 301, max: 400, color: '#dc2626', description: 'Respiratory illness on prolonged exposure' },
  { label: 'Severe', min: 401, max: 2000, color: '#7f1d1d', description: 'Affects healthy people and seriously impacts vulnerable groups' },
];

export const US_EPA_CATEGORIES: AQICategoryDefinition[] = [
  { label: 'Good', min: 0, max: 50, color: '#16a34a', description: 'Air quality is satisfactory; little or no risk' },
  { label: 'Moderate', min: 51, max: 100, color: '#ca8a04', description: 'Air quality acceptable; risk for few sensitive individuals' },
  { label: 'Unhealthy for Sensitive Groups', min: 101, max: 150, color: '#ea580c', description: 'Members of sensitive groups may experience health effects' },
  { label: 'Unhealthy', min: 151, max: 200, color: '#dc2626', description: 'Everyone may begin to experience adverse health effects' },
  { label: 'Very Unhealthy', min: 201, max: 300, color: '#9333ea', description: 'Health alert: increased risk of health effects for all' },
  { label: 'Hazardous', min: 301, max: 2000, color: '#881337', description: 'Health warnings of emergency conditions; entire population affected' },
];

export function classifyAQI(aqi: number, standard: AQIStandard = 'CPCB'): AQICategoryDefinition {
  const cats = standard === 'CPCB' ? CPCB_CATEGORIES : US_EPA_CATEGORIES;
  for (const cat of cats) {
    if (aqi >= cat.min && aqi <= cat.max) {
      return cat;
    }
  }
  return cats[cats.length - 1];
}

export function calculateDashboardKPIs(records: AirQualityRecord[]) {
  if (records.length === 0) {
    return {
      totalRecords: 0,
      uniqueCities: 0,
      avgAqi: 0,
      maxAqi: 0,
      maxAqiCity: 'N/A',
      maxAqiDate: 'N/A',
      minAqi: 0,
      avgPm25: 0,
      avgPm10: 0,
    };
  }

  const cities = new Set(records.map(r => r.city));
  const totalAqi = records.reduce((acc, r) => acc + r.aqi, 0);
  const avgAqi = Math.round((totalAqi / records.length) * 10) / 10;

  let peak = records[0];
  let minVal = records[0].aqi;

  let pm25Sum = 0;
  let pm25Count = 0;
  let pm10Sum = 0;
  let pm10Count = 0;

  for (const r of records) {
    if (r.aqi > peak.aqi) peak = r;
    if (r.aqi < minVal) minVal = r.aqi;
    if (r.pm25 !== null && !isNaN(r.pm25)) {
      pm25Sum += r.pm25;
      pm25Count++;
    }
    if (r.pm10 !== null && !isNaN(r.pm10)) {
      pm10Sum += r.pm10;
      pm10Count++;
    }
  }

  const avgPm25 = pm25Count > 0 ? Math.round((pm25Sum / pm25Count) * 10) / 10 : 0;
  const avgPm10 = pm10Count > 0 ? Math.round((pm10Sum / pm10Count) * 10) / 10 : 0;

  return {
    totalRecords: records.length,
    uniqueCities: cities.size,
    avgAqi,
    maxAqi: peak.aqi,
    maxAqiCity: peak.city,
    maxAqiDate: peak.record_date,
    minAqi: minVal,
    avgPm25,
    avgPm10,
  };
}

export function computeCityComparison(records: AirQualityRecord[], selectedCities: string[]) {
  const filtered = records.filter(r => selectedCities.includes(r.city));
  const groups: { [city: string]: AirQualityRecord[] } = {};

  for (const r of filtered) {
    if (!groups[r.city]) groups[r.city] = [];
    groups[r.city].push(r);
  }

  return Object.keys(groups).map(city => {
    const list = groups[city];
    const aqiSum = list.reduce((a, b) => a + b.aqi, 0);
    const avgAqi = Math.round((aqiSum / list.length) * 10) / 10;
    const minAqi = Math.min(...list.map(r => r.aqi));
    const maxAqi = Math.max(...list.map(r => r.aqi));

    // Standard deviation
    const variance = list.reduce((a, b) => a + Math.pow(b.aqi - avgAqi, 2), 0) / list.length;
    const stdAqi = Math.round(Math.sqrt(variance) * 10) / 10;

    const validPm25 = list.filter(r => r.pm25 !== null).map(r => r.pm25 as number);
    const avgPm25 = validPm25.length > 0
      ? Math.round((validPm25.reduce((a, b) => a + b, 0) / validPm25.length) * 10) / 10
      : null;

    const validPm10 = list.filter(r => r.pm10 !== null).map(r => r.pm10 as number);
    const avgPm10 = validPm10.length > 0
      ? Math.round((validPm10.reduce((a, b) => a + b, 0) / validPm10.length) * 10) / 10
      : null;

    return {
      city,
      count: list.length,
      avgAqi,
      minAqi,
      maxAqi,
      stdAqi,
      avgPm25,
      avgPm10,
    };
  }).sort((a, b) => b.avgAqi - a.avgAqi);
}

export function computePollutionTrends(records: AirQualityRecord[]) {
  // Daily trends
  const dailyMap: { [date: string]: { sumAqi: number; sumPm25: number; countPm25: number; sumPm10: number; countPm10: number; count: number } } = {};

  for (const r of records) {
    if (!dailyMap[r.record_date]) {
      dailyMap[r.record_date] = { sumAqi: 0, sumPm25: 0, countPm25: 0, sumPm10: 0, countPm10: 0, count: 0 };
    }
    const item = dailyMap[r.record_date];
    item.sumAqi += r.aqi;
    item.count += 1;
    if (r.pm25 !== null) { item.sumPm25 += r.pm25; item.countPm25 += 1; }
    if (r.pm10 !== null) { item.sumPm10 += r.pm10; item.countPm10 += 1; }
  }

  const daily = Object.keys(dailyMap).sort().map(d => {
    const item = dailyMap[d];
    return {
      date: d,
      avgAqi: Math.round((item.sumAqi / item.count) * 10) / 10,
      avgPm25: item.countPm25 > 0 ? Math.round((item.sumPm25 / item.countPm25) * 10) / 10 : null,
      avgPm10: item.countPm10 > 0 ? Math.round((item.sumPm10 / item.countPm10) * 10) / 10 : null,
      recordCount: item.count
    };
  });

  // Monthly trends
  const monthlyMap: { [month: string]: { sumAqi: number; count: number; sumPm25: number; countPm25: number } } = {};
  for (const r of records) {
    const m = r.record_date.substring(0, 7); // YYYY-MM
    if (!monthlyMap[m]) monthlyMap[m] = { sumAqi: 0, count: 0, sumPm25: 0, countPm25: 0 };
    monthlyMap[m].sumAqi += r.aqi;
    monthlyMap[m].count += 1;
    if (r.pm25 !== null) { monthlyMap[m].sumPm25 += r.pm25; monthlyMap[m].countPm25 += 1; }
  }

  const monthly = Object.keys(monthlyMap).sort().map(m => {
    const item = monthlyMap[m];
    return {
      month: m,
      avgAqi: Math.round((item.sumAqi / item.count) * 10) / 10,
      avgPm25: item.countPm25 > 0 ? Math.round((item.sumPm25 / item.countPm25) * 10) / 10 : null,
      count: item.count
    };
  });

  return { daily, monthly };
}

export function computeCategoryDistribution(records: AirQualityRecord[], standard: AQIStandard = 'CPCB') {
  const cats = standard === 'CPCB' ? CPCB_CATEGORIES : US_EPA_CATEGORIES;
  const counts: { [label: string]: number } = {};
  cats.forEach(c => { counts[c.label] = 0; });

  for (const r of records) {
    const cat = classifyAQI(r.aqi, standard);
    counts[cat.label] = (counts[cat.label] || 0) + 1;
  }

  const total = records.length;
  const distribution = cats.map(c => {
    const count = counts[c.label] || 0;
    return {
      category: c.label,
      records: count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      color: c.color,
      description: c.description,
      min: c.min,
      max: c.max,
    };
  });

  // Severe cities proportion
  const threshold = standard === 'CPCB' ? 200 : 150;
  const cityTotals: { [city: string]: { total: number; severe: number } } = {};

  for (const r of records) {
    if (!cityTotals[r.city]) cityTotals[r.city] = { total: 0, severe: 0 };
    cityTotals[r.city].total += 1;
    if (r.aqi > threshold) {
      cityTotals[r.city].severe += 1;
    }
  }

  const severeCities = Object.keys(cityTotals).map(city => {
    const item = cityTotals[city];
    const pct = item.total > 0 ? Math.round((item.severe / item.total) * 1000) / 10 : 0;
    return {
      city,
      total: item.total,
      severeCount: item.severe,
      percentage: pct
    };
  }).sort((a, b) => b.percentage - a.percentage);

  return {
    distribution,
    severeCities,
    thresholdLabel: standard === 'CPCB' ? 'Poor or Worse (AQI > 200)' : 'Unhealthy or Worse (AQI > 150)'
  };
}
