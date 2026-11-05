import { AirQualityRecord, SQLQueryCatalogItem } from '../types';

export const SQL_CATALOG: SQLQueryCatalogItem[] = [
  {
    id: 1,
    title: 'Display All Air-Quality Records',
    category: 'Basic DQL',
    description: 'Retrieves all recorded air quality rows sorted chronologically by date descending and city.',
    sql: `SELECT 
    id, city, record_date, aqi, pm25, pm10 
FROM air_quality_records 
ORDER BY record_date DESC, city ASC;`
  },
  {
    id: 2,
    title: 'Find the Highest AQI Reading',
    category: 'Subqueries & Extremes',
    description: 'Uses an aggregate subquery to locate the exact peak pollution event recorded in the dataset.',
    sql: `SELECT 
    city, record_date, aqi, pm25, pm10 
FROM air_quality_records 
WHERE aqi = (SELECT MAX(aqi) FROM air_quality_records);`
  },
  {
    id: 3,
    title: 'Calculate Average AQI by City',
    category: 'Group By Aggregations',
    description: 'Calculates mean, minimum, and maximum AQI grouped by city, ordered from most polluted to cleanest.',
    sql: `SELECT 
    city, 
    ROUND(AVG(aqi), 2) AS avg_aqi, 
    MIN(aqi) AS min_aqi, 
    MAX(aqi) AS max_aqi, 
    COUNT(*) AS total_records 
FROM air_quality_records 
GROUP BY city 
ORDER BY avg_aqi DESC;`
  },
  {
    id: 4,
    title: 'Cities with Average AQI > 150',
    category: 'HAVING Filter',
    description: 'Demonstrates post-aggregation filtering using the HAVING clause for cities exceeding threshold 150.',
    sql: `SELECT 
    city, 
    ROUND(AVG(aqi), 2) AS avg_aqi, 
    COUNT(*) AS sample_size 
FROM air_quality_records 
GROUP BY city 
HAVING AVG(aqi) > 150 
ORDER BY avg_aqi DESC;`
  },
  {
    id: 5,
    title: 'Calculate Average PM2.5 by City',
    category: 'Particulate Analysis',
    description: 'Computes fine particulate matter (PM2.5) concentrations per city while properly ignoring null values.',
    sql: `SELECT 
    city, 
    ROUND(AVG(pm25), 2) AS avg_pm25, 
    MIN(pm25) AS min_pm25, 
    MAX(pm25) AS max_pm25, 
    COUNT(pm25) AS non_null_readings 
FROM air_quality_records 
GROUP BY city 
ORDER BY avg_pm25 DESC;`
  },
  {
    id: 6,
    title: 'Calculate Average PM10 by City',
    category: 'Particulate Analysis',
    description: 'Aggregates coarse particulate matter (PM10) concentrations per municipal monitoring area.',
    sql: `SELECT 
    city, 
    ROUND(AVG(pm10), 2) AS avg_pm10, 
    MIN(pm10) AS min_pm10, 
    MAX(pm10) AS max_pm10, 
    COUNT(pm10) AS non_null_readings 
FROM air_quality_records 
GROUP BY city 
ORDER BY avg_pm10 DESC;`
  },
  {
    id: 7,
    title: 'Count Records by AQI Category',
    category: 'CASE Expressions',
    description: 'Categorizes individual readings into India CPCB breakpoints using conditional CASE WHEN logic.',
    sql: `SELECT 
    CASE 
        WHEN aqi BETWEEN 0 AND 50 THEN 'Good (0-50)'
        WHEN aqi BETWEEN 51 AND 100 THEN 'Satisfactory (51-100)'
        WHEN aqi BETWEEN 101 AND 200 THEN 'Moderate (101-200)'
        WHEN aqi BETWEEN 201 AND 300 THEN 'Poor (201-300)'
        WHEN aqi BETWEEN 301 AND 400 THEN 'Very Poor (301-400)'
        ELSE 'Severe (>400)'
    END AS aqi_category,
    COUNT(*) AS record_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM air_quality_records), 2) AS percentage_of_total
FROM air_quality_records 
GROUP BY aqi_category 
ORDER BY MIN(aqi) ASC;`
  },
  {
    id: 8,
    title: 'Top 10 Most Polluted Recorded Dates',
    category: 'Network Temporal Peaks',
    description: 'Ranks the worst network-wide calendar days based on multi-city daily averages.',
    sql: `SELECT 
    record_date, 
    ROUND(AVG(aqi), 2) AS daily_network_avg_aqi, 
    MAX(aqi) AS highest_single_city_aqi, 
    COUNT(DISTINCT city) AS cities_reporting 
FROM air_quality_records 
GROUP BY record_date 
ORDER BY daily_network_avg_aqi DESC 
LIMIT 10;`
  },
  {
    id: 9,
    title: 'Daily Average AQI Trends',
    category: 'Time Series',
    description: 'Builds a day-by-day time series trajectory of AQI and particulate metrics across the monitoring network.',
    sql: `SELECT 
    record_date, 
    ROUND(AVG(aqi), 2) AS avg_aqi, 
    ROUND(AVG(pm25), 2) AS avg_pm25, 
    ROUND(AVG(pm10), 2) AS avg_pm10, 
    COUNT(*) AS records_logged 
FROM air_quality_records 
GROUP BY record_date 
ORDER BY record_date ASC;`
  },
  {
    id: 10,
    title: 'Monthly Average AQI & Seasonality',
    category: 'Date Formatting',
    description: 'Groups telemetry by Year-Month using DATE_FORMAT to analyze winter peaks vs monsoon cleaner air.',
    sql: `SELECT 
    DATE_FORMAT(record_date, '%Y-%m') AS year_month, 
    ROUND(AVG(aqi), 2) AS monthly_avg_aqi, 
    ROUND(AVG(pm25), 2) AS monthly_avg_pm25, 
    ROUND(AVG(pm10), 2) AS monthly_avg_pm10, 
    MIN(aqi) AS lowest_aqi, 
    MAX(aqi) AS peak_aqi, 
    COUNT(*) AS total_monthly_readings 
FROM air_quality_records 
GROUP BY DATE_FORMAT(record_date, '%Y-%m') 
ORDER BY year_month ASC;`
  },
  {
    id: 11,
    title: 'Compare Pollutant Levels & PM2.5/PM10 Ratio',
    category: 'Multi-Metric Ratios',
    description: 'Evaluates the ratio of fine combustion particulates (PM2.5) to total coarse particulates (PM10).',
    sql: `SELECT 
    city, 
    ROUND(AVG(aqi), 1) AS avg_aqi, 
    ROUND(AVG(pm25), 1) AS avg_pm25, 
    ROUND(AVG(pm10), 1) AS avg_pm10, 
    ROUND(AVG(pm25) / NULLIF(AVG(pm10), 0), 2) AS pm25_to_pm10_ratio 
FROM air_quality_records 
GROUP BY city 
ORDER BY avg_aqi DESC;`
  },
  {
    id: 12,
    title: 'Records Exceeding Critical Health Threshold (AQI > 200)',
    category: 'Health Alerts',
    description: 'Filters all historical occurrences where air quality crossed into Poor, Very Poor, or Severe zones.',
    sql: `SELECT 
    city, 
    record_date, 
    aqi, 
    pm25, 
    pm10,
    CASE 
        WHEN aqi > 400 THEN 'Severe'
        WHEN aqi > 300 THEN 'Very Poor'
        ELSE 'Poor'
    END AS severity_label
FROM air_quality_records 
WHERE aqi > 200 
ORDER BY aqi DESC, record_date DESC;`
  },
  {
    id: 13,
    title: 'Rank Cities by Average AQI (Window Function)',
    category: 'Window Functions',
    description: 'Applies DENSE_RANK() OVER (ORDER BY AVG(aqi) DESC) to assign analytical ranking positions.',
    sql: `SELECT 
    DENSE_RANK() OVER (ORDER BY AVG(aqi) DESC) AS pollution_rank, 
    city, 
    ROUND(AVG(aqi), 2) AS avg_aqi, 
    ROUND(AVG(pm25), 2) AS avg_pm25, 
    ROUND(AVG(pm10), 2) AS avg_pm10, 
    COUNT(*) AS total_readings 
FROM air_quality_records 
GROUP BY city 
ORDER BY pollution_rank ASC;`
  },
  {
    id: 14,
    title: 'Percentage of Records > 200 AQI per City',
    category: 'Conditional Math',
    description: 'Calculates the proportion of unsafe readings per city using conditional SUM(CASE ...).',
    sql: `SELECT 
    city, 
    COUNT(*) AS total_records, 
    SUM(CASE WHEN aqi > 200 THEN 1 ELSE 0 END) AS poor_or_worse_records, 
    ROUND(
        SUM(CASE WHEN aqi > 200 THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 
        2
    ) AS pct_poor_or_worse 
FROM air_quality_records 
GROUP BY city 
ORDER BY pct_poor_or_worse DESC, total_records DESC;`
  },
  {
    id: 15,
    title: 'Cities with Greatest AQI Variation & Volatility',
    category: 'Statistical Variance',
    description: 'Uses STDDEV() and Range (MAX - MIN) to measure seasonal volatility and environmental instability.',
    sql: `SELECT 
    city, 
    ROUND(STDDEV(aqi), 2) AS aqi_standard_deviation, 
    (MAX(aqi) - MIN(aqi)) AS aqi_range, 
    MIN(aqi) AS cleanest_reading, 
    MAX(aqi) AS dirtiest_reading, 
    ROUND(AVG(aqi), 2) AS baseline_avg_aqi 
FROM air_quality_records 
GROUP BY city 
ORDER BY aqi_standard_deviation DESC;`
  }
];

export function executeQueryOnDataset(queryId: number, data: AirQualityRecord[]): { columns: string[]; rows: any[] } {
  if (data.length === 0) {
    return { columns: ['Notice'], rows: [{ Notice: 'No active data rows in memory.' }] };
  }

  switch (queryId) {
    case 1: {
      const sorted = [...data].sort((a, b) => b.record_date.localeCompare(a.record_date) || a.city.localeCompare(b.city));
      return {
        columns: ['city', 'record_date', 'aqi', 'pm25', 'pm10'],
        rows: sorted.slice(0, 50).map(r => ({
          city: r.city,
          record_date: r.record_date,
          aqi: r.aqi,
          pm25: r.pm25 !== null ? r.pm25 : 'NULL',
          pm10: r.pm10 !== null ? r.pm10 : 'NULL',
        }))
      };
    }
    case 2: {
      const maxAqi = Math.max(...data.map(d => d.aqi));
      const matches = data.filter(d => d.aqi === maxAqi);
      return {
        columns: ['city', 'record_date', 'aqi', 'pm25', 'pm10'],
        rows: matches.map(r => ({
          city: r.city,
          record_date: r.record_date,
          aqi: r.aqi,
          pm25: r.pm25,
          pm10: r.pm10
        }))
      };
    }
    case 3: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city];
        const avg = Math.round((list.reduce((a, b) => a + b.aqi, 0) / list.length) * 100) / 100;
        const min = Math.min(...list.map(r => r.aqi));
        const max = Math.max(...list.map(r => r.aqi));
        return { city, avg_aqi: avg, min_aqi: min, max_aqi: max, total_records: list.length };
      }).sort((a, b) => b.avg_aqi - a.avg_aqi);
      return { columns: ['city', 'avg_aqi', 'min_aqi', 'max_aqi', 'total_records'], rows };
    }
    case 4: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city];
        const avg = Math.round((list.reduce((a, b) => a + b.aqi, 0) / list.length) * 100) / 100;
        return { city, avg_aqi: avg, sample_size: list.length };
      }).filter(r => r.avg_aqi > 150).sort((a, b) => b.avg_aqi - a.avg_aqi);
      return { columns: ['city', 'avg_aqi', 'sample_size'], rows };
    }
    case 5: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city].filter(r => r.pm25 !== null && !isNaN(r.pm25 as number));
        const avg = list.length > 0 ? Math.round((list.reduce((a, b) => a + (b.pm25 as number), 0) / list.length) * 100) / 100 : 0;
        const min = list.length > 0 ? Math.min(...list.map(r => r.pm25 as number)) : 0;
        const max = list.length > 0 ? Math.max(...list.map(r => r.pm25 as number)) : 0;
        return { city, avg_pm25: avg, min_pm25: min, max_pm25: max, non_null_readings: list.length };
      }).sort((a, b) => b.avg_pm25 - a.avg_pm25);
      return { columns: ['city', 'avg_pm25', 'min_pm25', 'max_pm25', 'non_null_readings'], rows };
    }
    case 6: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city].filter(r => r.pm10 !== null && !isNaN(r.pm10 as number));
        const avg = list.length > 0 ? Math.round((list.reduce((a, b) => a + (b.pm10 as number), 0) / list.length) * 100) / 100 : 0;
        const min = list.length > 0 ? Math.min(...list.map(r => r.pm10 as number)) : 0;
        const max = list.length > 0 ? Math.max(...list.map(r => r.pm10 as number)) : 0;
        return { city, avg_pm10: avg, min_pm10: min, max_pm10: max, non_null_readings: list.length };
      }).sort((a, b) => b.avg_pm10 - a.avg_pm10);
      return { columns: ['city', 'avg_pm10', 'min_pm10', 'max_pm10', 'non_null_readings'], rows };
    }
    case 7: {
      const cats = ['Good (0-50)', 'Satisfactory (51-100)', 'Moderate (101-200)', 'Poor (201-300)', 'Very Poor (301-400)', 'Severe (>400)'];
      const counts: Record<string, number> = {};
      cats.forEach(c => { counts[c] = 0; });
      data.forEach(r => {
        if (r.aqi <= 50) counts['Good (0-50)']++;
        else if (r.aqi <= 100) counts['Satisfactory (51-100)']++;
        else if (r.aqi <= 200) counts['Moderate (101-200)']++;
        else if (r.aqi <= 300) counts['Poor (201-300)']++;
        else if (r.aqi <= 400) counts['Very Poor (301-400)']++;
        else counts['Severe (>400)']++;
      });
      const rows = cats.map(cat => ({
        aqi_category: cat,
        record_count: counts[cat],
        percentage_of_total: Math.round((counts[cat] / data.length) * 10000) / 100
      }));
      return { columns: ['aqi_category', 'record_count', 'percentage_of_total'], rows };
    }
    case 8: {
      const dates: Record<string, { aqiSum: number; maxAqi: number; cities: Set<string>; count: number }> = {};
      data.forEach(r => {
        if (!dates[r.record_date]) dates[r.record_date] = { aqiSum: 0, maxAqi: 0, cities: new Set(), count: 0 };
        const d = dates[r.record_date];
        d.aqiSum += r.aqi;
        d.count++;
        d.cities.add(r.city);
        if (r.aqi > d.maxAqi) d.maxAqi = r.aqi;
      });
      const rows = Object.keys(dates).map(date => {
        const item = dates[date];
        return {
          record_date: date,
          daily_network_avg_aqi: Math.round((item.aqiSum / item.count) * 100) / 100,
          highest_single_city_aqi: item.maxAqi,
          cities_reporting: item.cities.size
        };
      }).sort((a, b) => b.daily_network_avg_aqi - a.daily_network_avg_aqi).slice(0, 10);
      return { columns: ['record_date', 'daily_network_avg_aqi', 'highest_single_city_aqi', 'cities_reporting'], rows };
    }
    case 9: {
      const dates: Record<string, { aqiSum: number; pm25Sum: number; pm25Cnt: number; pm10Sum: number; pm10Cnt: number; count: number }> = {};
      data.forEach(r => {
        if (!dates[r.record_date]) dates[r.record_date] = { aqiSum: 0, pm25Sum: 0, pm25Cnt: 0, pm10Sum: 0, pm10Cnt: 0, count: 0 };
        const d = dates[r.record_date];
        d.aqiSum += r.aqi;
        d.count++;
        if (r.pm25 !== null) { d.pm25Sum += r.pm25; d.pm25Cnt++; }
        if (r.pm10 !== null) { d.pm10Sum += r.pm10; d.pm10Cnt++; }
      });
      const rows = Object.keys(dates).sort().map(date => {
        const d = dates[date];
        return {
          record_date: date,
          avg_aqi: Math.round((d.aqiSum / d.count) * 100) / 100,
          avg_pm25: d.pm25Cnt > 0 ? Math.round((d.pm25Sum / d.pm25Cnt) * 100) / 100 : 'NULL',
          avg_pm10: d.pm10Cnt > 0 ? Math.round((d.pm10Sum / d.pm10Cnt) * 100) / 100 : 'NULL',
          records_logged: d.count
        };
      });
      return { columns: ['record_date', 'avg_aqi', 'avg_pm25', 'avg_pm10', 'records_logged'], rows };
    }
    case 10: {
      const months: Record<string, { aqiSum: number; pm25Sum: number; pm25Cnt: number; pm10Sum: number; pm10Cnt: number; min: number; max: number; count: number }> = {};
      data.forEach(r => {
        const ym = r.record_date.substring(0, 7);
        if (!months[ym]) months[ym] = { aqiSum: 0, pm25Sum: 0, pm25Cnt: 0, pm10Sum: 0, pm10Cnt: 0, min: r.aqi, max: r.aqi, count: 0 };
        const m = months[ym];
        m.aqiSum += r.aqi;
        m.count++;
        if (r.aqi < m.min) m.min = r.aqi;
        if (r.aqi > m.max) m.max = r.aqi;
        if (r.pm25 !== null) { m.pm25Sum += r.pm25; m.pm25Cnt++; }
        if (r.pm10 !== null) { m.pm10Sum += r.pm10; m.pm10Cnt++; }
      });
      const rows = Object.keys(months).sort().map(ym => {
        const m = months[ym];
        return {
          year_month: ym,
          monthly_avg_aqi: Math.round((m.aqiSum / m.count) * 100) / 100,
          monthly_avg_pm25: m.pm25Cnt > 0 ? Math.round((m.pm25Sum / m.pm25Cnt) * 100) / 100 : 'NULL',
          monthly_avg_pm10: m.pm10Cnt > 0 ? Math.round((m.pm10Sum / m.pm10Cnt) * 100) / 100 : 'NULL',
          lowest_aqi: m.min,
          peak_aqi: m.max,
          total_monthly_readings: m.count
        };
      });
      return { columns: ['year_month', 'monthly_avg_aqi', 'monthly_avg_pm25', 'monthly_avg_pm10', 'lowest_aqi', 'peak_aqi', 'total_monthly_readings'], rows };
    }
    case 11: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city];
        const avgAqi = Math.round((list.reduce((a, b) => a + b.aqi, 0) / list.length) * 10) / 10;
        const p25 = list.filter(r => r.pm25 !== null).map(r => r.pm25 as number);
        const p10 = list.filter(r => r.pm10 !== null).map(r => r.pm10 as number);
        const avg25 = p25.length > 0 ? p25.reduce((a, b) => a + b, 0) / p25.length : 0;
        const avg10 = p10.length > 0 ? p10.reduce((a, b) => a + b, 0) / p10.length : 0;
        const ratio = avg10 > 0 ? Math.round((avg25 / avg10) * 100) / 100 : 0;
        return {
          city,
          avg_aqi: avgAqi,
          avg_pm25: Math.round(avg25 * 10) / 10,
          avg_pm10: Math.round(avg10 * 10) / 10,
          pm25_to_pm10_ratio: ratio
        };
      }).sort((a, b) => b.avg_aqi - a.avg_aqi);
      return { columns: ['city', 'avg_aqi', 'avg_pm25', 'avg_pm10', 'pm25_to_pm10_ratio'], rows };
    }
    case 12: {
      const filtered = data.filter(r => r.aqi > 200).sort((a, b) => b.aqi - a.aqi);
      return {
        columns: ['city', 'record_date', 'aqi', 'pm25', 'pm10', 'severity_label'],
        rows: filtered.map(r => ({
          city: r.city,
          record_date: r.record_date,
          aqi: r.aqi,
          pm25: r.pm25,
          pm10: r.pm10,
          severity_label: r.aqi > 400 ? 'Severe' : r.aqi > 300 ? 'Very Poor' : 'Poor'
        }))
      };
    }
    case 13: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const aggregated = Object.keys(groups).map(city => {
        const list = groups[city];
        const avg = Math.round((list.reduce((a, b) => a + b.aqi, 0) / list.length) * 100) / 100;
        const p25 = list.filter(r => r.pm25 !== null).map(r => r.pm25 as number);
        const p10 = list.filter(r => r.pm10 !== null).map(r => r.pm10 as number);
        const avg25 = p25.length > 0 ? Math.round((p25.reduce((a, b) => a + b, 0) / p25.length) * 100) / 100 : 'NULL';
        const avg10 = p10.length > 0 ? Math.round((p10.reduce((a, b) => a + b, 0) / p10.length) * 100) / 100 : 'NULL';
        return { city, avg_aqi: avg, avg_pm25: avg25, avg_pm10: avg10, total_readings: list.length };
      }).sort((a, b) => (b.avg_aqi as number) - (a.avg_aqi as number));

      const rows = aggregated.map((item, idx) => ({
        pollution_rank: idx + 1,
        ...item
      }));
      return { columns: ['pollution_rank', 'city', 'avg_aqi', 'avg_pm25', 'avg_pm10', 'total_readings'], rows };
    }
    case 14: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city];
        const severeCount = list.filter(r => r.aqi > 200).length;
        const pct = Math.round((severeCount / list.length) * 10000) / 100;
        return {
          city,
          total_records: list.length,
          poor_or_worse_records: severeCount,
          pct_poor_or_worse: pct
        };
      }).sort((a, b) => b.pct_poor_or_worse - a.pct_poor_or_worse);
      return { columns: ['city', 'total_records', 'poor_or_worse_records', 'pct_poor_or_worse'], rows };
    }
    case 15: {
      const groups: Record<string, AirQualityRecord[]> = {};
      data.forEach(r => { (groups[r.city] = groups[r.city] || []).push(r); });
      const rows = Object.keys(groups).map(city => {
        const list = groups[city];
        const avg = list.reduce((a, b) => a + b.aqi, 0) / list.length;
        const variance = list.reduce((a, b) => a + Math.pow(b.aqi - avg, 2), 0) / list.length;
        const std = Math.round(Math.sqrt(variance) * 100) / 100;
        const min = Math.min(...list.map(r => r.aqi));
        const max = Math.max(...list.map(r => r.aqi));
        return {
          city,
          aqi_standard_deviation: std,
          aqi_range: max - min,
          cleanest_reading: min,
          dirtiest_reading: max,
          baseline_avg_aqi: Math.round(avg * 100) / 100
        };
      }).sort((a, b) => b.aqi_standard_deviation - a.aqi_standard_deviation);
      return { columns: ['city', 'aqi_standard_deviation', 'aqi_range', 'cleanest_reading', 'dirtiest_reading', 'baseline_avg_aqi'], rows };
    }
    default:
      return { columns: ['Result'], rows: [{ Result: 'Select a valid query ID.' }] };
  }
}
