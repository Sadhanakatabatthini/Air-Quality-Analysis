import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import {
  Activity,
  Building2,
  Calendar,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  Wind,
  RefreshCw,
  X
} from 'lucide-react';

import { AirQualityRecord, AQIStandard, AuditReport } from './types';
import { INITIAL_DATASET } from './data/sampleData';
import { PROJECT_FILES, ProjectFile } from './data/projectFiles';
import {
  classifyAQI,
  calculateDashboardKPIs,
  computeCityComparison,
  computePollutionTrends,
  computeCategoryDistribution,
  CPCB_CATEGORIES,
  US_EPA_CATEGORIES
} from './utils/analysis';
import { parseAndValidateCSV } from './utils/csvParser';
import { SQL_CATALOG, executeQueryOnDataset } from './utils/sqlSimulator';

type NavSection =
  | 'overview'
  | 'comparison'
  | 'trends'
  | 'categories'
  | 'explorer'
  | 'sql_lab'
  | 'code_hub'
  | 'portfolio_guide';

export default function App() {
  // Navigation & configuration state
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [aqiStandard, setAqiStandard] = useState<AQIStandard>('CPCB');

  // Working dataset state
  const [records, setRecords] = useState<AirQualityRecord[]>(INITIAL_DATASET);

  // Global filters
  const allAvailableCities = useMemo(() => {
    return Array.from(new Set(records.map(r => r.city))).sort();
  }, [records]);

  const [selectedCities, setSelectedCities] = useState<string[]>(allAvailableCities);

  // Synchronize selected cities if dataset changes
  React.useEffect(() => {
    setSelectedCities(allAvailableCities);
  }, [allAvailableCities]);

  const [dateFilterMin, setDateFilterMin] = useState<string>('2024-01-01');
  const [dateFilterMax, setDateFilterMax] = useState<string>('2024-12-31');

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const cityMatch = selectedCities.length === 0 || selectedCities.includes(r.city);
      const dateMatch =
        (!dateFilterMin || r.record_date >= dateFilterMin) &&
        (!dateFilterMax || r.record_date <= dateFilterMax);
      return cityMatch && dateMatch;
    });
  }, [records, selectedCities, dateFilterMin, dateFilterMax]);

  // Dashboard KPI metrics
  const kpis = useMemo(() => calculateDashboardKPIs(filteredRecords), [filteredRecords]);

  // Category analysis
  const categoryAnalysis = useMemo(
    () => computeCategoryDistribution(filteredRecords, aqiStandard),
    [filteredRecords, aqiStandard]
  );

  // City comparison state
  const [compareCities, setCompareCities] = useState<string[]>(['Delhi', 'Mumbai', 'Bengaluru', 'Kolkata']);
  const comparisonData = useMemo(
    () => computeCityComparison(filteredRecords, compareCities),
    [filteredRecords, compareCities]
  );

  // Trends
  const trendData = useMemo(() => computePollutionTrends(filteredRecords), [filteredRecords]);

  // Data Explorer search & filters
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerMinAqi, setExplorerMinAqi] = useState<number>(0);
  const [explorerMaxAqi, setExplorerMaxAqi] = useState<number>(500);
  const [explorerSortBy, setExplorerSortBy] = useState<'aqi_desc' | 'aqi_asc' | 'date_desc'>('aqi_desc');

  const explorerRecords = useMemo(() => {
    let result = filteredRecords.filter(r => {
      const matchSearch = r.city.toLowerCase().includes(explorerSearch.toLowerCase());
      const matchAqi = r.aqi >= explorerMinAqi && r.aqi <= explorerMaxAqi;
      return matchSearch && matchAqi;
    });

    if (explorerSortBy === 'aqi_desc') result.sort((a, b) => b.aqi - a.aqi);
    else if (explorerSortBy === 'aqi_asc') result.sort((a, b) => a.aqi - b.aqi);
    else if (explorerSortBy === 'date_desc') result.sort((a, b) => b.record_date.localeCompare(a.record_date));

    return result;
  }, [filteredRecords, explorerSearch, explorerMinAqi, explorerMaxAqi, explorerSortBy]);

  // CSV Ingestion state
  const [uploadAudit, setUploadAudit] = useState<AuditReport | null>(null);
  const [pendingParsedRecords, setPendingParsedRecords] = useState<AirQualityRecord[]>([]);

  // SQL Lab state
  const [selectedSqlId, setSelectedSqlId] = useState<number>(1);
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: any[] } | null>(null);

  // Code Hub state
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [copiedResume, setCopiedResume] = useState<boolean>(false);

  // Copy utility
  const copyToClipboard = (text: string, type: 'file' | 'resume') => {
    navigator.clipboard.writeText(text);
    if (type === 'file') {
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    } else {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2000);
    }
  };

  // 1-Click ZIP Download
  const downloadProjectZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder('air-quality-analysis') || zip;

    PROJECT_FILES.forEach(file => {
      folder.file(file.name, file.content);
    });

    const sqlFolder = folder.folder('sql');
    if (sqlFolder) {
      const schemaFile = PROJECT_FILES.find(f => f.name === 'schema.sql');
      const queryFile = PROJECT_FILES.find(f => f.name === 'queries.sql');
      if (schemaFile) sqlFolder.file('schema.sql', schemaFile.content);
      if (queryFile) sqlFolder.file('queries.sql', queryFile.content);
    }

    const dataFolder = folder.folder('data');
    if (dataFolder) {
      const csvFile = PROJECT_FILES.find(f => f.name === 'sample_air_quality.csv');
      if (csvFile) dataFolder.file('sample_air_quality.csv', csvFile.content);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'air-quality-analysis-project.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download filtered CSV
  const downloadFilteredCSV = () => {
    const header = 'City,Date,AQI,PM2.5,PM10\n';
    const rows = explorerRecords
      .map(r => `${r.city},${r.record_date},${r.aqi},${r.pm25 ?? ''},${r.pm10 ?? ''}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'filtered_air_quality_records.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle local CSV upload file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      const { records: parsed, audit } = parseAndValidateCSV(text);
      setPendingParsedRecords(parsed);
      setUploadAudit(audit);
    };
    reader.readAsText(file);
  };

  // Execute active SQL query
  const runActiveSqlQuery = () => {
    const res = executeQueryOnDataset(selectedSqlId, records);
    setSqlResult(res);
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedCities(allAvailableCities);
    setDateFilterMin('2024-01-01');
    setDateFilterMax('2024-12-31');
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-800 font-sans antialiased overflow-hidden">
      {/* =========================================================================
          SIMPLE SIDEBAR
          ========================================================================= */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-gray-900 leading-tight">
              Air Quality
            </h1>
            <p className="text-xs text-gray-500">Python · MySQL · Streamlit</p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="p-3 border-b border-gray-100">
          <p className="px-2 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Dashboard
          </p>
          <nav className="space-y-0.5 text-xs">
            <button
              onClick={() => setActiveSection('overview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'overview'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveSection('comparison')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'comparison'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>City Comparison</span>
            </button>

            <button
              onClick={() => setActiveSection('trends')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'trends'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Pollution Trends</span>
            </button>

            <button
              onClick={() => setActiveSection('categories')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'categories'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>AQI Categories</span>
            </button>

            <button
              onClick={() => setActiveSection('explorer')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'explorer'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Data Explorer & CSV</span>
            </button>

            <button
              onClick={() => setActiveSection('sql_lab')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'sql_lab'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>SQL Queries Lab (15)</span>
            </button>
          </nav>

          <p className="px-2 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Portfolio Code
          </p>
          <nav className="space-y-0.5 text-xs">
            <button
              onClick={() => setActiveSection('code_hub')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'code_hub'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Code2 className="w-4 h-4 text-emerald-600" />
              <span>Python & MySQL Code</span>
            </button>

            <button
              onClick={() => setActiveSection('portfolio_guide')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors text-left ${
                activeSection === 'portfolio_guide'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Setup & Resume Guide</span>
            </button>
          </nav>
        </div>

        {/* Simple Filters Section */}
        <div className="p-3 flex-1 overflow-y-auto space-y-3.5 text-xs">
          {/* AQI Standard Selector */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">AQI Standard</label>
            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-0.5 rounded border border-gray-200">
              <button
                onClick={() => setAqiStandard('CPCB')}
                className={`py-1 text-center font-medium rounded transition-colors text-xs ${
                  aqiStandard === 'CPCB' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                CPCB (India)
              </button>
              <button
                onClick={() => setAqiStandard('US_EPA')}
                className={`py-1 text-center font-medium rounded transition-colors text-xs ${
                  aqiStandard === 'US_EPA' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                US EPA
              </button>
            </div>
          </div>

          {/* City Filter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-gray-600">Filter Cities</label>
              <button
                onClick={() => setSelectedCities(selectedCities.length === allAvailableCities.length ? [] : allAvailableCities)}
                className="text-[11px] text-emerald-700 hover:underline"
              >
                {selectedCities.length === allAvailableCities.length ? 'Clear' : 'Select All'}
              </button>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 bg-gray-50 p-2 rounded border border-gray-200 text-xs">
              {allAvailableCities.map(city => {
                const checked = selectedCities.includes(city);
                return (
                  <label key={city} className="flex items-center gap-2 cursor-pointer hover:text-gray-900">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) setSelectedCities(selectedCities.filter(c => c !== city));
                        else setSelectedCities([...selectedCities, city]);
                      }}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700">{city}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">Date Range</label>
            <div className="space-y-1">
              <input
                type="date"
                value={dateFilterMin}
                onChange={e => setDateFilterMin(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 text-xs"
              />
              <input
                type="date"
                value={dateFilterMax}
                onChange={e => setDateFilterMax(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 text-xs"
              />
            </div>
            <div className="flex justify-between items-center mt-1 text-[11px] text-gray-500">
              <span>{filteredRecords.length} records</span>
              <button onClick={resetFilters} className="text-gray-500 hover:text-gray-800 underline">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: ZIP Download Button */}
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={downloadProjectZip}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-3 rounded text-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Project (.ZIP)</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MAIN CONTENT AREA
          ========================================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        {/* Simple Top Header */}
        <header className="h-14 border-b border-gray-200 px-6 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {activeSection === 'overview' && 'Overview Dashboard'}
              {activeSection === 'comparison' && 'City Comparison'}
              {activeSection === 'trends' && 'Pollution Trends'}
              {activeSection === 'categories' && 'AQI Categories'}
              {activeSection === 'explorer' && 'Data Explorer & CSV Ingestion'}
              {activeSection === 'sql_lab' && 'SQL Queries Lab (15 Queries)'}
              {activeSection === 'code_hub' && 'Project Files & Code'}
              {activeSection === 'portfolio_guide' && 'Setup Guide & Resume Points'}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">
              {filteredRecords.length} records across {kpis.uniqueCities} cities
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Standard: {aqiStandard}</span>
            <button
              onClick={downloadProjectZip}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs px-2.5 py-1.5 rounded border border-gray-300 transition"
              title="Download all Python, MySQL, and config files in a zip"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Project ZIP</span>
            </button>
          </div>
        </header>

        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* =====================================================================
              SECTION A: OVERVIEW DASHBOARD
              ===================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Air Quality Overview
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Summary metrics and pollutant readings across monitored locations.
                </p>
              </div>

              {/* 6 Clean KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-2xs">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Total Records</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{kpis.totalRecords.toLocaleString()}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Readings logged</div>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-2xs">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Cities</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{kpis.uniqueCities}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Monitored areas</div>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-2xs">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Average AQI</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: classifyAQI(kpis.avgAqi, aqiStandard).color }}>
                    {kpis.avgAqi}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5 font-medium">
                    {classifyAQI(kpis.avgAqi, aqiStandard).label}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-2xs">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Peak AQI</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{kpis.maxAqi}</div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                    {kpis.maxAqiCity} ({kpis.maxAqiDate})
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-2xs">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Avg PM2.5</div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">{kpis.avgPm25}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">µg/m³ (Fine)</div>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-2xs">
                  <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Avg PM10</div>
                  <div className="text-2xl font-bold text-gray-800 mt-1">{kpis.avgPm10}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">µg/m³ (Coarse)</div>
                </div>
              </div>

              {/* City Averages & Category Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* City-wise bar chart */}
                <div className="lg:col-span-3 bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">City-wise Average AQI</h3>
                    <span className="text-[11px] text-gray-500">Sorted cleanest to most polluted</span>
                  </div>

                  <div className="space-y-2.5">
                    {comparisonData
                      .slice()
                      .sort((a, b) => a.avgAqi - b.avgAqi)
                      .map(city => {
                        const cat = classifyAQI(city.avgAqi, aqiStandard);
                        const widthPct = Math.min(100, Math.max(10, (city.avgAqi / 450) * 100));
                        return (
                          <div key={city.city} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-gray-800">{city.city}</span>
                              <span className="font-mono text-gray-600">
                                AQI {city.avgAqi} · <span className="font-medium" style={{ color: cat.color }}>{cat.label}</span>
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${widthPct}%`, backgroundColor: cat.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Categories Breakdown */}
                <div className="lg:col-span-2 bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Category Distribution</h3>
                    <span className="text-[11px] text-gray-500">{aqiStandard} Standard</span>
                  </div>

                  <div className="space-y-2">
                    {categoryAnalysis.distribution.map(cat => (
                      <div key={cat.category} className="flex items-center justify-between text-xs py-1 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-gray-800 font-medium">{cat.category}</span>
                        </div>
                        <div className="text-right font-mono text-gray-700">
                          {cat.records} <span className="text-gray-500">({cat.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 p-2.5 bg-gray-50 rounded border border-gray-200 text-[11px] text-gray-600 leading-relaxed">
                    Categories are calculated mathematically from standard breakpoint thresholds.
                  </div>
                </div>
              </div>

              {/* Historical Trend Chart */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Historical Daily AQI Trend</h3>
                  <span className="text-[11px] text-gray-500">Network daily average trajectory</span>
                </div>

                {trendData.daily.length > 0 ? (
                  <div className="h-36 w-full flex items-end gap-1 pt-6 pb-2 px-1 border-b border-gray-200 overflow-x-auto">
                    {trendData.daily.map(d => {
                      const heightPct = Math.min(100, Math.max(8, (d.avgAqi / 450) * 100));
                      const cat = classifyAQI(d.avgAqi, aqiStandard);
                      return (
                        <div key={d.date} className="flex-1 min-w-[18px] group relative flex flex-col items-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-gray-900 text-[10px] text-white py-1 px-2 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                            <strong>{d.date}</strong>: AQI {d.avgAqi} ({cat.label})
                          </div>
                          <div
                            className="w-full rounded-t transition-all hover:opacity-80"
                            style={{ height: `${heightPct}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No records found for current filters.</p>
                )}
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>{trendData.daily[0]?.date || 'Start'}</span>
                  <span>Timeline</span>
                  <span>{trendData.daily[trendData.daily.length - 1]?.date || 'End'}</span>
                </div>
              </div>

              {/* Key Findings */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Key Findings Summary</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700 leading-relaxed">
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-emerald-700 font-semibold block mb-0.5">Cleanest vs. Most Polluted</span>
                    Across monitored stations,{' '}
                    <strong className="text-gray-900">
                      {comparisonData[comparisonData.length - 1]?.city || 'Bengaluru'}
                    </strong>{' '}
                    recorded the lowest average AQI of{' '}
                    <strong className="text-gray-900">
                      {comparisonData[comparisonData.length - 1]?.avgAqi || 'N/A'}
                    </strong>
                    , while{' '}
                    <strong className="text-gray-900">
                      {comparisonData[0]?.city || 'Delhi'}
                    </strong>{' '}
                    averaged the highest at{' '}
                    <strong className="text-gray-900">{comparisonData[0]?.avgAqi || 'N/A'}</strong>.
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-amber-700 font-semibold block mb-0.5">Particulate Matter Composition</span>
                    The network average PM2.5 concentration is{' '}
                    <strong className="text-gray-900">{kpis.avgPm25} µg/m³</strong> compared to PM10 at{' '}
                    <strong className="text-gray-900">{kpis.avgPm10} µg/m³</strong>, yielding a fine-to-coarse ratio of{' '}
                    <strong className="text-gray-900">
                      {kpis.avgPm10 > 0 ? (kpis.avgPm25 / kpis.avgPm10).toFixed(2) : 'N/A'}
                    </strong>
                    , indicative of combustion and traffic emissions.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION B: CITY COMPARISON
              ===================================================================== */}
          {activeSection === 'comparison' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">City Comparison</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Benchmark pollutant levels and variability (standard deviation) between selected cities.
                </p>
              </div>

              {/* City Selection Pills */}
              <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-2xs flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600 font-medium">Select cities to compare:</span>
                {allAvailableCities.map(city => {
                  const isSelected = compareCities.includes(city);
                  return (
                    <button
                      key={city}
                      onClick={() => {
                        if (isSelected) {
                          if (compareCities.length > 2) setCompareCities(compareCities.filter(c => c !== city));
                        } else {
                          setCompareCities([...compareCities, city]);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded font-medium border transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:text-gray-900'
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>

              {/* Summary Table */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-900">Statistical Comparison Table</h3>
                  <span className="text-xs text-gray-500">{compareCities.length} cities selected</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">City</th>
                        <th className="py-2.5 px-4 font-semibold">Records</th>
                        <th className="py-2.5 px-4 font-semibold">Average AQI</th>
                        <th className="py-2.5 px-4 font-semibold">Min AQI</th>
                        <th className="py-2.5 px-4 font-semibold">Max AQI</th>
                        <th className="py-2.5 px-4 font-semibold">Std Dev (Volatility)</th>
                        <th className="py-2.5 px-4 font-semibold">Avg PM2.5</th>
                        <th className="py-2.5 px-4 font-semibold">Avg PM10</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {comparisonData.map(c => {
                        const cat = classifyAQI(c.avgAqi, aqiStandard);
                        return (
                          <tr key={c.city} className="hover:bg-gray-50/80">
                            <td className="py-2.5 px-4 font-sans font-medium text-gray-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                              {c.city}
                            </td>
                            <td className="py-2.5 px-4 text-gray-700">{c.count}</td>
                            <td className="py-2.5 px-4 font-bold" style={{ color: cat.color }}>
                              {c.avgAqi}
                            </td>
                            <td className="py-2.5 px-4 text-gray-700">{c.minAqi}</td>
                            <td className="py-2.5 px-4 text-red-600 font-semibold">{c.maxAqi}</td>
                            <td className="py-2.5 px-4 text-amber-700">±{c.stdAqi}</td>
                            <td className="py-2.5 px-4 text-gray-700">{c.avgPm25 ?? 'N/A'}</td>
                            <td className="py-2.5 px-4 text-gray-700">{c.avgPm10 ?? 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Side-by-side Visual Benchmarks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Average AQI Benchmark</h3>
                  <div className="space-y-3">
                    {comparisonData.map(c => {
                      const cat = classifyAQI(c.avgAqi, aqiStandard);
                      const pct = Math.min(100, Math.max(10, (c.avgAqi / 450) * 100));
                      return (
                        <div key={c.city} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-800 font-medium">{c.city}</span>
                            <span className="font-mono text-gray-600">
                              {c.avgAqi} ({cat.label})
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Particulate Matter (PM2.5 vs PM10)</h3>
                  <div className="space-y-2.5">
                    {comparisonData.map(c => (
                      <div key={c.city} className="bg-gray-50 p-2.5 rounded border border-gray-200 text-xs">
                        <div className="flex justify-between font-medium text-gray-800 mb-1">
                          <span>{c.city}</span>
                          <span className="text-gray-500 font-mono text-[11px]">
                            PM2.5/PM10 Ratio: {c.avgPm10 && c.avgPm25 ? (c.avgPm25 / c.avgPm10).toFixed(2) : 'N/A'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="bg-white border border-gray-200 p-1.5 rounded">
                            <span className="text-amber-700 block text-[10px] font-sans">PM2.5 (Fine)</span>
                            <span className="text-gray-900 font-bold">{c.avgPm25 ?? 'N/A'} µg/m³</span>
                          </div>
                          <div className="bg-white border border-gray-200 p-1.5 rounded">
                            <span className="text-gray-600 block text-[10px] font-sans">PM10 (Coarse)</span>
                            <span className="text-gray-900 font-bold">{c.avgPm10 ?? 'N/A'} µg/m³</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION C: POLLUTION TRENDS
              ===================================================================== */}
          {activeSection === 'trends' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Pollution Trends</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Analyze monthly seasonal patterns and top recorded pollution episodes.
                </p>
              </div>

              {/* Monthly Aggregation Cards */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Monthly Average AQI (Seasonality)</h3>
                  <span className="text-xs text-gray-500">Winter peaks vs summer/monsoon moderation</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {trendData.monthly.map(m => {
                    const cat = classifyAQI(m.avgAqi, aqiStandard);
                    return (
                      <div key={m.month} className="bg-gray-50 p-3 rounded border border-gray-200 text-center">
                        <span className="text-xs text-gray-500 block font-mono">{m.month}</span>
                        <div className="text-xl font-bold mt-1 font-mono" style={{ color: cat.color }}>
                          {m.avgAqi}
                        </div>
                        <span className="text-[10px] text-gray-600 block mt-0.5">{cat.label}</span>
                        {m.avgPm25 && (
                          <div className="text-[10px] text-gray-500 font-mono mt-1 pt-1 border-t border-gray-200">
                            PM2.5: {m.avgPm25}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Peak Pollution Episodes */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-900">Top 10 Peak Pollution Episodes</h3>
                  <span className="text-xs text-red-600 font-medium">Highest recorded readings</span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">City</th>
                      <th className="py-2.5 px-4 font-semibold">Date</th>
                      <th className="py-2.5 px-4 font-semibold">AQI</th>
                      <th className="py-2.5 px-4 font-semibold">Classification</th>
                      <th className="py-2.5 px-4 font-semibold">PM2.5 (µg/m³)</th>
                      <th className="py-2.5 px-4 font-semibold">PM10 (µg/m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {filteredRecords
                      .slice()
                      .sort((a, b) => b.aqi - a.aqi)
                      .slice(0, 10)
                      .map((r, i) => {
                        const cat = classifyAQI(r.aqi, aqiStandard);
                        return (
                          <tr key={`${r.city}-${r.record_date}-${i}`} className="hover:bg-gray-50/80">
                            <td className="py-2.5 px-4 font-sans font-medium text-gray-900">{r.city}</td>
                            <td className="py-2.5 px-4 text-gray-700">{r.record_date}</td>
                            <td className="py-2.5 px-4 font-bold text-red-600">{r.aqi}</td>
                            <td className="py-2.5 px-4 font-sans">
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-medium"
                                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                              >
                                {cat.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-gray-700">{r.pm25 ?? 'N/A'}</td>
                            <td className="py-2.5 px-4 text-gray-700">{r.pm10 ?? 'N/A'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION D: AQI CATEGORY ANALYSIS
              ===================================================================== */}
          {activeSection === 'categories' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">AQI Category Analysis</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Standardized breakpoint classification under the <strong>{aqiStandard}</strong> standard.
                </p>
              </div>

              {/* Simple Info Note */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Standard Breakpoints:</strong> Categories are calculated directly from standard numerical breakpoints
                  ({aqiStandard === 'CPCB' ? 'India CPCB National Air Quality Index' : 'US EPA Clean Air Act Standard'}).
                  For Indian cities, CPCB breakpoints accurately mirror localized health guidelines.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Distribution Overview */}
                <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Overall Category Proportions</h3>
                  <div className="space-y-2.5">
                    {categoryAnalysis.distribution.map(cat => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-800 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.category} ({cat.min}–{cat.max < 1000 ? cat.max : '400+'})
                          </span>
                          <span className="font-mono text-gray-700">
                            {cat.records} records ({cat.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cities with highest proportion of Poor readings */}
                <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Cities with Highest {categoryAnalysis.thresholdLabel}
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-3">Proportion of high pollution days per city</p>

                  <div className="space-y-2">
                    {categoryAnalysis.severeCities.map(city => (
                      <div key={city.city} className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200 text-xs">
                        <span className="font-medium text-gray-900">{city.city}</span>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-gray-500 text-[11px]">
                            {city.severeCount} of {city.total} days
                          </span>
                          <span className="text-red-600 font-bold">{city.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reference Table */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {aqiStandard === 'CPCB' ? 'CPCB (India)' : 'US EPA'} Breakpoints Reference
                  </h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Category</th>
                      <th className="py-2.5 px-4 font-semibold">AQI Range</th>
                      <th className="py-2.5 px-4 font-semibold">Health Impact Advisory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(aqiStandard === 'CPCB' ? CPCB_CATEGORIES : US_EPA_CATEGORIES).map(c => (
                      <tr key={c.label}>
                        <td className="py-2.5 px-4 font-medium flex items-center gap-2" style={{ color: c.color }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.label}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-gray-700">
                          {c.min} – {c.max < 1000 ? c.max : '400+'}
                        </td>
                        <td className="py-2.5 px-4 text-gray-600">{c.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION E: DATA EXPLORER & CSV INGESTION
              ===================================================================== */}
          {activeSection === 'explorer' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Data Explorer & CSV Ingestion</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Search, filter, export datasets, or upload custom air quality files.
                </p>
              </div>

              {/* Upload Card */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Upload CSV Dataset</span>
                  </h3>
                  <span className="text-[11px] text-gray-500">Required: City, Date, AQI · Optional: PM2.5, PM10</span>
                </div>

                {/* Dataset Download & Quick Load helpers */}
                <div className="mb-3.5 p-3 bg-emerald-50/60 rounded border border-emerald-200/80 text-xs">
                  <div className="font-semibold text-emerald-900 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Ready-to-Upload Test Datasets (Click to download or load)</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-normal">Free & Validated</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mb-2.5">
                    Download any of these formatted CSV files to test uploading, or click "Load Sample" to instantly test the upload parser.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const csvContent = PROJECT_FILES.find(f => f.name === 'test_upload_dataset.csv')?.content || '';
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'test_upload_dataset.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded text-xs font-medium transition shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Download test_upload_dataset.csv (7 Cities)</span>
                    </button>

                    <button
                      onClick={() => {
                        const csvContent = PROJECT_FILES.find(f => f.name === 'sample_air_quality.csv')?.content || '';
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sample_air_quality.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded text-xs font-medium transition shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Download sample_air_quality.csv (Metros)</span>
                    </button>

                    <button
                      onClick={() => {
                        const csvContent = PROJECT_FILES.find(f => f.name === 'test_upload_dataset.csv')?.content || '';
                        const { records: parsed, audit } = parseAndValidateCSV(csvContent);
                        setPendingParsedRecords(parsed);
                        setUploadAudit(audit);
                      }}
                      className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded text-xs font-medium transition shadow-2xs ml-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Quick Test: Simulate File Upload</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700 font-medium">Choose file to upload:</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                    />
                  </div>
                  {pendingParsedRecords.length > 0 && (
                    <button
                      onClick={() => {
                        setRecords(pendingParsedRecords);
                        alert(`Successfully activated ${pendingParsedRecords.length} validated records into the dashboard!`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded font-medium transition shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply Cleaned Data ({pendingParsedRecords.length} rows)</span>
                    </button>
                  )}
                </div>

                {/* Audit Report */}
                {uploadAudit && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-xs space-y-1">
                    <div className="font-semibold text-gray-800">Validation Audit Report:</div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <div>Initial Rows: {uploadAudit.initial_row_count}</div>
                      <div className="text-emerald-700">Valid Rows: {uploadAudit.valid_row_count}</div>
                      <div className="text-red-600">Dropped Rows: {uploadAudit.dropped_rows}</div>
                    </div>
                    {uploadAudit.warnings.length > 0 && (
                      <div className="text-amber-800 text-[11px]">
                        Warnings: {uploadAudit.warnings.join(' ')}
                      </div>
                    )}
                    {uploadAudit.errors.length > 0 && (
                      <div className="text-red-600 text-[11px]">
                        Errors: {uploadAudit.errors.join(' ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Search, Filter & Table */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="p-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search city..."
                      value={explorerSearch}
                      onChange={e => setExplorerSearch(e.target.value)}
                      className="bg-white border border-gray-300 text-xs px-2.5 py-1.5 rounded w-full text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">AQI:</span>
                    <input
                      type="number"
                      value={explorerMinAqi}
                      onChange={e => setExplorerMinAqi(Number(e.target.value))}
                      className="w-16 bg-white border border-gray-300 px-2 py-1 rounded text-center text-gray-800"
                      min={0}
                    />
                    <span className="text-gray-400">–</span>
                    <input
                      type="number"
                      value={explorerMaxAqi}
                      onChange={e => setExplorerMaxAqi(Number(e.target.value))}
                      className="w-16 bg-white border border-gray-300 px-2 py-1 rounded text-center text-gray-800"
                      max={2000}
                    />

                    <select
                      value={explorerSortBy}
                      onChange={e => setExplorerSortBy(e.target.value as any)}
                      className="bg-white border border-gray-300 px-2 py-1.5 rounded text-gray-700"
                    >
                      <option value="aqi_desc">Highest AQI</option>
                      <option value="aqi_asc">Lowest AQI</option>
                      <option value="date_desc">Latest Date</option>
                    </select>

                    <button
                      onClick={downloadFilteredCSV}
                      className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded border border-gray-300 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">City</th>
                        <th className="py-2.5 px-4 font-semibold">Date</th>
                        <th className="py-2.5 px-4 font-semibold">AQI</th>
                        <th className="py-2.5 px-4 font-semibold">Category</th>
                        <th className="py-2.5 px-4 font-semibold">PM2.5</th>
                        <th className="py-2.5 px-4 font-semibold">PM10</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {explorerRecords.map((r, i) => {
                        const cat = classifyAQI(r.aqi, aqiStandard);
                        return (
                          <tr key={`${r.city}-${r.record_date}-${i}`} className="hover:bg-gray-50/70">
                            <td className="py-2 px-4 font-sans font-medium text-gray-900">{r.city}</td>
                            <td className="py-2 px-4 text-gray-700">{r.record_date}</td>
                            <td className="py-2 px-4 font-bold" style={{ color: cat.color }}>
                              {r.aqi}
                            </td>
                            <td className="py-2 px-4 font-sans">
                              <span
                                className="px-1.5 py-0.5 rounded text-[11px] font-medium"
                                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                              >
                                {cat.label}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-gray-600">{r.pm25 ?? 'NULL'}</td>
                            <td className="py-2 px-4 text-gray-600">{r.pm10 ?? 'NULL'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 flex justify-between">
                  <span>Showing {explorerRecords.length} records</span>
                  <span>Missing PM2.5: {explorerRecords.filter(r => r.pm25 === null).length} rows</span>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION F: SQL QUERIES LAB
              ===================================================================== */}
          {activeSection === 'sql_lab' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">SQL Queries Lab (15 Queries)</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Portfolio SQL queries demonstrating aggregations, window functions (DENSE_RANK), and CASE expressions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {SQL_CATALOG.map(q => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setSelectedSqlId(q.id);
                        setSqlResult(null);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition ${
                        selectedSqlId === q.id
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-900">Query {q.id}</span>
                        <span className="text-[10px] text-gray-500 uppercase">{q.category}</span>
                      </div>
                      <div className="truncate text-gray-600">{q.title}</div>
                    </button>
                  ))}
                </div>

                <div className="md:col-span-2 space-y-4">
                  {(() => {
                    const activeQ = SQL_CATALOG.find(q => q.id === selectedSqlId)!;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-gray-900">
                              Query {activeQ.id}: {activeQ.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{activeQ.description}</p>
                          </div>
                          <button
                            onClick={runActiveSqlQuery}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-1.5 rounded transition shadow-xs flex items-center gap-1.5"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Run Query</span>
                          </button>
                        </div>

                        {/* SQL Code View */}
                        <div className="bg-gray-900 p-3 rounded font-mono text-xs text-emerald-300 border border-gray-800 overflow-x-auto">
                          <pre>{activeQ.sql}</pre>
                        </div>

                        {/* Query Execution Result */}
                        {sqlResult && (
                          <div className="mt-3 border-t border-gray-200 pt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span className="font-medium">Output Result</span>
                              <span>{sqlResult.rows.length} rows returned</span>
                            </div>
                            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 sticky top-0 text-gray-600 border-b border-gray-200">
                                  <tr>
                                    {sqlResult.columns.map(col => (
                                      <th key={col} className="py-2 px-3 font-semibold">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-mono">
                                  {sqlResult.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      {sqlResult.columns.map(col => (
                                        <td key={col} className="py-1.5 px-3 text-gray-800">
                                          {String(row[col])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION G: CODE HUB
              ===================================================================== */}
          {activeSection === 'code_hub' && (
            <div className="space-y-6 max-w-6xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Python & MySQL Code Repository</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    View, copy, or download every file in the exact project structure.
                  </p>
                </div>
                <button
                  onClick={downloadProjectZip}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 rounded font-medium transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Project (.ZIP)</span>
                </button>
              </div>

              {/* Code File Explorer */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-1 bg-white border border-gray-200 p-2 rounded-lg max-h-[520px] overflow-y-auto shadow-2xs">
                  <div className="text-[11px] font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider">
                    Project Files ({PROJECT_FILES.length})
                  </div>
                  {PROJECT_FILES.map((file, idx) => (
                    <button
                      key={file.name}
                      onClick={() => setSelectedFileIdx(idx)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between ${
                        selectedFileIdx === idx
                          ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="truncate">{file.name}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{file.language}</span>
                    </button>
                  ))}
                </div>

                <div className="md:col-span-3 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-2xs">
                  {(() => {
                    const currentFile = PROJECT_FILES[selectedFileIdx];
                    return (
                      <>
                        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                          <div>
                            <span className="font-mono text-xs font-semibold text-gray-900">{currentFile.path}</span>
                            <p className="text-[11px] text-gray-500 mt-0.5">{currentFile.description}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(currentFile.content, 'file')}
                            className="flex items-center gap-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded transition border border-gray-300"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedFile ? 'Copied!' : 'Copy Code'}</span>
                          </button>
                        </div>
                        <div className="p-4 bg-gray-900 text-gray-100 overflow-x-auto max-h-[460px] font-mono text-xs leading-relaxed">
                          <pre>{currentFile.content}</pre>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION H: SETUP GUIDE & RESUME POINTS
              ===================================================================== */}
          {activeSection === 'portfolio_guide' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Setup Guide & Portfolio Points</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Beginner-friendly Windows guide and resume bullet points.
                </p>
              </div>

              {/* Resume Points Box */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Two Resume Bullet Points for Your Portfolio</span>
                  </h3>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `• Engineered an end-to-end data analytics dashboard in Streamlit to analyze historical air quality telemetry across 6+ metropolitan cities, computing CPCB-standard AQI classifications, PM2.5/PM10 particulate ratios, and multi-city comparative trends.\n• Architected a MySQL relational database with composite unique constraints and parameterized UPSERT logic to eliminate duplicate records during CSV ingestion, and authored 15 analytical SQL queries utilizing window functions, conditional aggregations, and subqueries.`,
                        'resume'
                      )
                    }
                    className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs px-2.5 py-1 rounded border border-gray-300 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedResume ? 'Copied!' : 'Copy Bullets'}</span>
                  </button>
                </div>

                <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3.5 rounded border border-gray-200 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-bold shrink-0">•</span>
                    <span>
                      <strong>Air Quality Analytics & Pollution Insights Dashboard (Python, MySQL, Streamlit):</strong> Engineered an end-to-end data analytics dashboard in Streamlit to analyze historical air quality telemetry across 6+ metropolitan cities, computing CPCB-standard AQI classifications, PM2.5/PM10 particulate ratios, and multi-city comparative trends.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-bold shrink-0">•</span>
                    <span>
                      <strong>Relational Architecture & SQL Aggregations:</strong> Architected a MySQL relational database with composite unique constraints and parameterized UPSERT logic to eliminate duplicate records during CSV ingestion, and authored 15 analytical SQL queries utilizing window functions, conditional aggregations, and subqueries.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Setup Guide */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-2xs space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Step-by-Step Local Setup Guide</h3>

                <div className="space-y-3 text-xs">
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                    <span className="font-semibold text-emerald-800">Step 1: Download & Extract</span>
                    <p className="text-gray-700">Click the "Download Project (.ZIP)" button to download the files, then extract them on your computer.</p>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                    <span className="font-semibold text-emerald-800">Step 2: Create Virtual Environment (Windows)</span>
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded font-mono text-[11px] overflow-x-auto">
                      cd air-quality-analysis{'\n'}python -m venv venv{'\n'}venv\Scripts\activate
                    </pre>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                    <span className="font-semibold text-emerald-800">Step 3: Install Requirements</span>
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded font-mono text-[11px]">
                      pip install -r requirements.txt
                    </pre>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                    <span className="font-semibold text-emerald-800">Step 4: Execute SQL Schema in MySQL Workbench</span>
                    <p className="text-gray-700">Open MySQL Workbench, load <code>sql/schema.sql</code>, and click the Lightning icon to create <code>air_quality_db</code>.</p>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                    <span className="font-semibold text-emerald-800">Step 5: Setup .env File</span>
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded font-mono text-[11px]">
                      DB_HOST=localhost{'\n'}DB_PORT=3306{'\n'}DB_USER=root{'\n'}DB_PASSWORD=your_mysql_password{'\n'}DB_NAME=air_quality_db
                    </pre>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1">
                    <span className="font-semibold text-emerald-800">Step 6: Run Streamlit Application</span>
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded font-mono text-[11px]">
                      streamlit run app.py
                    </pre>
                    <p className="text-gray-500 text-[11px]">The application will open automatically at <code>http://localhost:8501</code>.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
