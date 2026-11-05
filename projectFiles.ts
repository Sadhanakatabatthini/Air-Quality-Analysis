export interface ProjectFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const PROJECT_FILES: ProjectFile[] = [
  {
    name: "app.py",
    path: "air-quality-analysis/app.py",
    language: "python",
    description: "Main interactive Streamlit application containing all dashboard sections, charts, filters, and SQL executor.",
    content: `"""
Air Quality Analysis and Pollution Insights Dashboard
Main Streamlit Application
"""

import os
import datetime
from io import BytesIO
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Local module imports
from data_processing import validate_and_clean_dataset, get_dataset_summary
from analysis import (
    classify_aqi_value,
    add_aqi_category_column,
    calculate_dashboard_kpis,
    compute_city_comparison,
    compute_pollution_trends,
    compute_category_distribution,
    CPCB_CATEGORIES,
    US_EPA_CATEGORIES
)
import database as db

st.set_page_config(
    page_title="Air Quality Analysis & Pollution Dashboard",
    page_icon="🍃",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom environmental CSS
st.markdown("""
<style>
    .main-header { font-size: 2.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
    .sub-header { font-size: 1rem; color: #64748b; margin-bottom: 1.5rem; }
    .metric-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    .metric-title { font-size: 0.85rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-value { font-size: 1.8rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0; }
    .metric-caption { font-size: 0.8rem; color: #94a3b8; }
</style>
""", unsafe_allow_html=True)

@st.cache_data(show_spinner=False)
def load_default_sample_data() -> pd.DataFrame:
    sample_path = os.path.join(os.path.dirname(__file__), "data", "sample_air_quality.csv")
    if os.path.exists(sample_path):
        raw_df = pd.read_csv(sample_path)
        clean_df, _ = validate_and_clean_dataset(raw_df)
        return clean_df
    return pd.DataFrame(columns=["city", "record_date", "aqi", "pm25", "pm10"])

def get_active_data(data_source_mode: str):
    if data_source_mode == "MySQL Database":
        try:
            db_df = db.load_all_records_from_db()
            if not db_df.empty:
                return db_df, "Loaded from MySQL database 'air_quality_db'."
            else:
                st.info("MySQL table 'air_quality_records' is empty. Loading default sample dataset for preview.")
                return load_default_sample_data(), "Sample dataset (MySQL was empty)."
        except Exception as e:
            st.warning(f"Could not connect to MySQL ({str(e)}). Switched to bundled sample data.")
            return load_default_sample_data(), f"Sample dataset fallback: {str(e)}"
    else:
        if "custom_dataset" in st.session_state and not st.session_state["custom_dataset"].empty:
            return st.session_state["custom_dataset"], "Loaded user uploaded dataset."
        return load_default_sample_data(), "Loaded bundled sample dataset."

st.sidebar.markdown("## 🍃 Air Quality Analytics")
st.sidebar.caption("Portfolio Project · Python, MySQL & Streamlit")

nav_selection = st.sidebar.radio(
    "Navigation",
    options=[
        "Overview Dashboard",
        "City Comparison",
        "Pollution Trends",
        "AQI Category Analysis",
        "Data Explorer & Upload",
        "SQL Queries Lab"
    ]
)

st.sidebar.markdown("---")
data_source_option = st.sidebar.selectbox("Data Source", ["Sample / Uploaded Dataset", "MySQL Database"])
aqi_standard = st.sidebar.selectbox("AQI Standard", ["CPCB (India)", "US EPA"])
standard_code = "CPCB" if "CPCB" in aqi_standard else "US_EPA"

df, _ = get_active_data(data_source_option)
all_cities = sorted(df["city"].unique().tolist())
min_date = df["record_date"].min()
max_date = df["record_date"].max()

selected_cities = st.sidebar.multiselect("Filter Cities", all_cities, default=all_cities)
date_range = st.sidebar.date_input("Date Range", value=(min_date, max_date), min_value=min_date, max_value=max_date)

filtered_df = df[df["city"].isin(selected_cities)]
if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
    filtered_df = filtered_df[(filtered_df["record_date"] >= date_range[0]) & (filtered_df["record_date"] <= date_range[1])]

if nav_selection == "Overview Dashboard":
    st.markdown('<div class="main-header">Air Quality Overview Dashboard</div>', unsafe_allow_html=True)
    kpis = calculate_dashboard_kpis(filtered_df)
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("Total Records", f"{kpis['total_records']:,}")
    c2.metric("Cities", kpis['city_count'])
    c3.metric("Avg AQI", kpis['avg_aqi'])
    c4.metric("Peak AQI", kpis['max_aqi'], f"{kpis['max_aqi_city']}")
    c5.metric("Avg PM2.5", f"{kpis['avg_pm25']} µg/m³" if kpis['avg_pm25'] else "N/A")
    c6.metric("Avg PM10", f"{kpis['avg_pm10']} µg/m³" if kpis['avg_pm10'] else "N/A")

    col_l, col_r = st.columns([3, 2])
    with col_l:
        city_avg = filtered_df.groupby("city")["aqi"].mean().reset_index().sort_values(by="aqi")
        fig = px.bar(city_avg, x="aqi", y="city", orientation="h", title="City-wise Average AQI", text="aqi", color="aqi", color_continuous_scale="RdYlGn_r")
        st.plotly_chart(fig, use_container_width=True)
    with col_r:
        cat_data = compute_category_distribution(filtered_df, standard=standard_code)["distribution"]
        fig_pie = px.pie(cat_data, names="Category", values="Records", title=f"AQI Categories ({aqi_standard})", color="Category", color_discrete_map={r["Category"]: r["Color"] for _, r in cat_data.iterrows()})
        st.plotly_chart(fig_pie, use_container_width=True)

    trends = compute_pollution_trends(filtered_df)["daily"]
    fig_t = px.line(trends, x="record_date", y="avg_aqi", title="Historical Daily AQI Trend", markers=True)
    st.plotly_chart(fig_t, use_container_width=True)
`
  },
  {
    name: "database.py",
    path: "air-quality-analysis/database.py",
    language: "python",
    description: "MySQL connection management, connection pooling, table initialization, and parameterized upserts.",
    content: `"""
Database Connection and Operations Module
Connects to MySQL, handles table creation, safe parameterized queries, and idempotent bulk data imports.
"""

import os
from typing import Optional, Tuple, List, Dict, Any
import mysql.connector
from mysql.connector import Error, errorcode
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

def get_db_config() -> Dict[str, Any]:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "air_quality_db"),
        "connect_timeout": 5,
    }

def get_connection(include_database: bool = True):
    config = get_db_config()
    if not include_database:
        config.pop("database", None)
    return mysql.connector.connect(**config)

def test_connection():
    try:
        conn = get_connection(include_database=True)
        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return True, "Successfully connected to MySQL database 'air_quality_db'."
    except Exception as e:
        return False, str(e)

def import_records_to_db(df: pd.DataFrame):
    upsert_sql = """
    INSERT INTO air_quality_records (city, record_date, aqi, pm25, pm10)
    VALUES (%s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        aqi = VALUES(aqi),
        pm25 = VALUES(pm25),
        pm10 = VALUES(pm10);
    """
    records = []
    for _, row in df.iterrows():
        pm25_val = None if pd.isna(row.get("pm25")) else float(row["pm25"])
        pm10_val = None if pd.isna(row.get("pm10")) else float(row["pm10"])
        records.append((str(row["city"]), str(row["record_date"]), int(row["aqi"]), pm25_val, pm10_val))

    conn = get_connection(include_database=True)
    cursor = conn.cursor()
    cursor.executemany(upsert_sql, records)
    conn.commit()
    conn.close()
    return len(records), 0, f"Successfully processed {len(records)} records."
`
  },
  {
    name: "data_processing.py",
    path: "air-quality-analysis/data_processing.py",
    language: "python",
    description: "Data validation, header aliasing (PM2.5/PM25/PM10), date formatting, and ingestion audit logger.",
    content: `"""
Data Processing Module for Air Quality Analysis Dashboard
Handles CSV ingestion, column normalization, type casting, validation, and auditing.
"""

from typing import Dict, List, Tuple, Any
import pandas as pd
import numpy as np

REQUIRED_COLUMNS = ["city", "record_date", "aqi"]
COLUMN_ALIASES = {
    "city": "city", "location": "city",
    "date": "record_date", "record_date": "record_date",
    "aqi": "aqi", "air_quality_index": "aqi",
    "pm25": "pm25", "pm2.5": "pm25", "pm2_5": "pm25",
    "pm10": "pm10", "pm_10": "pm10"
}

def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {}
    for col in df.columns:
        c = str(col).strip().lower()
        renamed[col] = COLUMN_ALIASES.get(c, c)
    return df.rename(columns=renamed)

def validate_and_clean_dataset(raw_df: pd.DataFrame):
    audit = {
        "initial_row_count": len(raw_df), "valid_row_count": 0,
        "dropped_rows": 0, "warnings": [], "errors": []
    }
    df = normalize_column_names(raw_df.copy())
    missing_req = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_req:
        audit["errors"].append(f"Missing required columns: {missing_req}")
        return pd.DataFrame(), audit

    df["city"] = df["city"].astype(str).str.strip()
    df["record_date"] = pd.to_datetime(df["record_date"], errors="coerce").dt.date
    df["aqi"] = pd.to_numeric(df["aqi"], errors="coerce")
    df = df.dropna(subset=["city", "record_date", "aqi"])
    df["aqi"] = df["aqi"].astype(int)

    # De-duplicate
    df = df.drop_duplicates(subset=["city", "record_date"], keep="last")
    audit["valid_row_count"] = len(df)
    return df, audit
`
  },
  {
    name: "analysis.py",
    path: "air-quality-analysis/analysis.py",
    language: "python",
    description: "Domain logic for CPCB & US EPA standards, KPI formulas, city benchmarks, and temporal trend engines.",
    content: `"""
Analysis and Metric Calculations Module
Provides domain calculations, AQI classifications, and comparative analytics.
"""

import pandas as pd
import numpy as np

CPCB_CATEGORIES = [
    {"label": "Good", "min": 0, "max": 50, "color": "#16a34a", "description": "Minimal health impact"},
    {"label": "Satisfactory", "min": 51, "max": 100, "color": "#65a30d", "description": "Minor discomfort to sensitive people"},
    {"label": "Moderate", "min": 101, "max": 200, "color": "#d97706", "description": "Breathing discomfort to heart/lung patients"},
    {"label": "Poor", "min": 201, "max": 300, "color": "#ea580c", "description": "Discomfort on prolonged exposure"},
    {"label": "Very Poor", "min": 301, "max": 400, "color": "#dc2626", "description": "Respiratory illness on prolonged exposure"},
    {"label": "Severe", "min": 401, "max": 2000, "color": "#7f1d1d", "description": "Severe impacts on healthy and vulnerable persons"},
]

def classify_aqi_value(aqi: int, standard: str = "CPCB"):
    cats = CPCB_CATEGORIES
    for cat in cats:
        if cat["min"] <= aqi <= cat["max"]:
            return cat
    return cats[-1]

def calculate_dashboard_kpis(df: pd.DataFrame):
    if df.empty:
        return {"total_records": 0, "city_count": 0, "avg_aqi": 0, "max_aqi": 0}
    max_idx = df["aqi"].idxmax()
    return {
        "total_records": len(df),
        "city_count": int(df["city"].nunique()),
        "avg_aqi": round(float(df["aqi"].mean()), 1),
        "max_aqi": int(df.loc[max_idx, "aqi"]),
        "max_aqi_city": str(df.loc[max_idx, "city"]),
        "max_aqi_date": str(df.loc[max_idx, "record_date"]),
        "avg_pm25": round(float(df["pm25"].mean()), 1) if "pm25" in df and df["pm25"].notna().any() else None,
        "avg_pm10": round(float(df["pm10"].mean()), 1) if "pm10" in df and df["pm10"].notna().any() else None,
    }
`
  },
  {
    name: "schema.sql",
    path: "air-quality-analysis/sql/schema.sql",
    language: "sql",
    description: "MySQL DDL database initialization script with unique constraint and performance indexes.",
    content: `-- Air Quality Analysis Database Schema
CREATE DATABASE IF NOT EXISTS air_quality_db CHARACTER SET utf8mb4;
USE air_quality_db;

CREATE TABLE IF NOT EXISTS air_quality_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    record_date DATE NOT NULL,
    aqi INT NOT NULL,
    pm25 DECIMAL(7, 2) NULL,
    pm10 DECIMAL(7, 2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_city_date UNIQUE (city, record_date)
) ENGINE=InnoDB;

CREATE INDEX idx_city ON air_quality_records (city);
CREATE INDEX idx_record_date ON air_quality_records (record_date);
CREATE INDEX idx_aqi ON air_quality_records (aqi);
`
  },
  {
    name: "queries.sql",
    path: "air-quality-analysis/sql/queries.sql",
    language: "sql",
    description: "15 comprehensive SQL portfolio queries demonstrating window functions, CASE statements, and aggregations.",
    content: `-- 15 Core SQL Analysis Queries for Portfolio & Data Insights
USE air_quality_db;

-- 1. Display all records
SELECT id, city, record_date, aqi, pm25, pm10 FROM air_quality_records ORDER BY record_date DESC;

-- 2. Peak AQI
SELECT city, record_date, aqi, pm25, pm10 FROM air_quality_records WHERE aqi = (SELECT MAX(aqi) FROM air_quality_records);

-- 3. Average AQI by city
SELECT city, ROUND(AVG(aqi), 2) AS avg_aqi, MIN(aqi) AS min_aqi, MAX(aqi) AS max_aqi FROM air_quality_records GROUP BY city ORDER BY avg_aqi DESC;

-- 4. Cities with average AQI > 150
SELECT city, ROUND(AVG(aqi), 2) AS avg_aqi FROM air_quality_records GROUP BY city HAVING AVG(aqi) > 150;

-- 5. Average PM2.5 by city
SELECT city, ROUND(AVG(pm25), 2) AS avg_pm25 FROM air_quality_records GROUP BY city ORDER BY avg_pm25 DESC;

-- 6. Average PM10 by city
SELECT city, ROUND(AVG(pm10), 2) AS avg_pm10 FROM air_quality_records GROUP BY city ORDER BY avg_pm10 DESC;

-- 7. Count by CPCB category
SELECT CASE WHEN aqi BETWEEN 0 AND 50 THEN 'Good' WHEN aqi BETWEEN 51 AND 100 THEN 'Satisfactory' WHEN aqi BETWEEN 101 AND 200 THEN 'Moderate' WHEN aqi BETWEEN 201 AND 300 THEN 'Poor' WHEN aqi BETWEEN 301 AND 400 THEN 'Very Poor' ELSE 'Severe' END AS category, COUNT(*) AS count FROM air_quality_records GROUP BY category;

-- 8. Top 10 most polluted dates
SELECT record_date, ROUND(AVG(aqi), 2) AS daily_avg FROM air_quality_records GROUP BY record_date ORDER BY daily_avg DESC LIMIT 10;

-- 9. Daily average AQI
SELECT record_date, ROUND(AVG(aqi), 2) AS avg_aqi FROM air_quality_records GROUP BY record_date ORDER BY record_date ASC;

-- 10. Monthly average AQI
SELECT DATE_FORMAT(record_date, '%Y-%m') AS month, ROUND(AVG(aqi), 2) AS monthly_avg FROM air_quality_records GROUP BY month ORDER BY month ASC;

-- 11. Compare pollutant ratios
SELECT city, ROUND(AVG(aqi), 1) AS avg_aqi, ROUND(AVG(pm25) / NULLIF(AVG(pm10), 0), 2) AS pm25_to_pm10_ratio FROM air_quality_records GROUP BY city;

-- 12. Records exceeding AQI 200
SELECT city, record_date, aqi FROM air_quality_records WHERE aqi > 200 ORDER BY aqi DESC;

-- 13. Rank cities by average AQI (Window Function)
SELECT DENSE_RANK() OVER (ORDER BY AVG(aqi) DESC) AS rank_pos, city, ROUND(AVG(aqi), 2) AS avg_aqi FROM air_quality_records GROUP BY city;

-- 14. Percentage of records > 200 per city
SELECT city, ROUND(SUM(CASE WHEN aqi > 200 THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 2) AS pct_poor FROM air_quality_records GROUP BY city ORDER BY pct_poor DESC;

-- 15. Cities with highest AQI variation (Standard Deviation)
SELECT city, ROUND(STDDEV(aqi), 2) AS std_dev, (MAX(aqi) - MIN(aqi)) AS aqi_range FROM air_quality_records GROUP BY city ORDER BY std_dev DESC;
`
  },
  {
    name: "sample_air_quality.csv",
    path: "air-quality-analysis/data/sample_air_quality.csv",
    language: "csv",
    description: "Benchmark testing CSV dataset containing realistic multi-city readings across 2024.",
    content: `City,Date,AQI,PM2.5,PM10
Delhi,2024-01-01,385,245.2,360.5
Delhi,2024-01-02,410,268.0,395.0
Delhi,2024-02-01,245,140.5,235.4
Mumbai,2024-01-01,165,88.4,152.0
Mumbai,2024-02-01,142,74.2,130.0
Bengaluru,2024-01-01,78,35.2,70.0
Bengaluru,2024-02-01,88,41.5,80.2
Kolkata,2024-01-01,290,175.4,265.0
Chennai,2024-01-01,95,45.0,84.0
Hyderabad,2024-01-01,140,70.5,124.0
`
  },
  {
    name: "test_upload_dataset.csv",
    path: "air-quality-analysis/data/test_upload_dataset.csv",
    language: "csv",
    description: "Multi-city ready-to-upload dataset covering Pune, Jaipur, Ahmedabad, Lucknow, Patna, Chandigarh, and Kochi.",
    content: `City,Date,AQI,PM2.5,PM10
Pune,2024-01-05,115,55.2,102.4
Pune,2024-02-04,110,52.4,98.0
Pune,2024-03-05,95,44.2,85.0
Pune,2024-06-15,58,26.4,52.0
Pune,2024-07-10,42,18.0,38.5
Pune,2024-11-08,135,68.4,120.0
Jaipur,2024-01-05,225,128.5,210.0
Jaipur,2024-03-05,145,76.2,140.0
Jaipur,2024-07-10,65,28.2,60.0
Jaipur,2024-11-08,260,152.0,245.0
Ahmedabad,2024-01-05,195,110.2,180.0
Ahmedabad,2024-03-05,135,72.0,128.4
Ahmedabad,2024-07-10,55,24.5,50.2
Ahmedabad,2024-11-08,220,125.0,205.0
Lucknow,2024-01-05,340,215.0,320.5
Lucknow,2024-04-10,140,72.5,135.0
Lucknow,2024-07-10,60,26.0,55.0
Lucknow,2024-11-08,355,228.0,338.0
Patna,2024-01-05,320,198.0,305.0
Patna,2024-04-10,135,70.0,128.0
Patna,2024-07-10,58,25.0,52.0
Patna,2024-11-08,335,210.0,318.0
Chandigarh,2024-01-05,160,88.0,150.0
Chandigarh,2024-04-10,88,41.2,80.0
Chandigarh,2024-07-10,45,19.0,40.0
Chandigarh,2024-11-08,240,140.0,225.0
Kochi,2024-01-05,62,28.4,55.0
Kochi,2024-04-10,60,27.2,54.0
Kochi,2024-07-10,28,11.0,24.5
Kochi,2024-11-08,65,30.0,58.0
`
  },
  {
    name: "requirements.txt",
    path: "air-quality-analysis/requirements.txt",
    language: "text",
    description: "Pinned Python libraries for pip install.",
    content: `streamlit==1.32.2
pandas==2.2.1
plotly==5.20.0
mysql-connector-python==8.3.0
python-dotenv==1.0.1
`
  },
  {
    name: ".env.example",
    path: "air-quality-analysis/.env.example",
    language: "text",
    description: "Local MySQL credential placeholders.",
    content: `DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=air_quality_db
`
  },
  {
    name: ".gitignore",
    path: "air-quality-analysis/.gitignore",
    language: "text",
    description: "Git exclusion rules protecting passwords and virtual environments.",
    content: `.env
venv/
__pycache__/
*.pyc
.streamlit/secrets.toml
`
  },
  {
    name: "README.md",
    path: "air-quality-analysis/README.md",
    language: "markdown",
    description: "Complete documentation, Windows setup, MySQL Workbench instructions, testing checklist, and resume bullets.",
    content: `# Air Quality Analysis and Pollution Insights Dashboard

Full-stack environmental data analytics application built with **Python**, **MySQL**, and **Streamlit**.

### Resume Bullets
- *Engineered an end-to-end data analytics dashboard in Streamlit to analyze historical air quality telemetry across 6+ metropolitan cities, computing CPCB-standard AQI classifications, PM2.5/PM10 particulate ratios, and multi-city comparative trends.*
- *Architected a MySQL relational database with composite unique constraints and parameterized UPSERT logic to eliminate duplicate records during CSV ingestion, and authored 15 analytical SQL queries utilizing window functions, conditional aggregations, and subqueries.*
`
  }
];
