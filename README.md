# Air Quality Analysis and Pollution Insights Dashboard

A full-stack environmental data analytics web application built with **Python**, **MySQL**, and **Streamlit**. Designed to ingest, validate, analyze, and visualize multi-city air quality measurements across India (and international stations) using standardized Air Quality Index (AQI) breakpoints, particulate concentrations (PM2.5 and PM10), and relational SQL aggregations.

---

## 1. Project Objective & Problem Statement

Urban air pollution has severe implications for public health, municipal policy, and climate monitoring. However, raw environmental data often arrives fragmented, plagued with non-standard column headers, missing measurements, and duplicate readings.

This project delivers an end-to-end, reproducible data pipeline and interactive dashboard that:
1. **Validates & Cleans Raw Telemetry**: Robustly normalizes column headers (`PM2.5`, `PM2_5`, `PM10`), rejects malformed dates or invalid AQI outliers, and audits missing values without destructive zero-filling.
2. **Maintains Relational Integrity**: Stores structured records in MySQL with a strict unique constraint on `(city, record_date)` and idempotent `ON DUPLICATE KEY UPDATE` upsert logic.
3. **Applies Standardized Health Classifications**: Computes air quality categories according to **India Central Pollution Control Board (CPCB)** breakpoints (and optionally US EPA standards), clearly distinguishing mathematical categorizations from certified agency stations.
4. **Empowers Data Exploration & SQL Insights**: Enables users to compare cities, track seasonal trends, run 15 production-grade SQL queries, and export filtered datasets.

---

## 2. Technology Stack

- **Application & Dashboard**: Streamlit (Python)
- **Database Engine**: MySQL 8.0+
- **Database Connector**: `mysql-connector-python`
- **Data Manipulation**: Pandas, NumPy
- **Interactive Visualizations**: Plotly (Express & Graph Objects)
- **Environment Management**: `python-dotenv`
- **Date & Time Operations**: Python standard `datetime` module

---

## 3. Database Schema & Architecture

### Database: `air_quality_db`
### Table: `air_quality_records`

```sql
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
```

### Record Uniqueness & Duplicate Handling Strategy
To prevent duplicate records when re-uploading overlapping datasets, the database defines a composite unique constraint `uq_city_date` on `(city, record_date)`. During batch insertion, an **UPSERT** pattern is executed:

```sql
INSERT INTO air_quality_records (city, record_date, aqi, pm25, pm10)
VALUES (%s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
    aqi = VALUES(aqi),
    pm25 = VALUES(pm25),
    pm10 = VALUES(pm10);
```
This guarantees idempotent uploads where existing records are refreshed with the latest telemetry rather than creating duplicate rows.

---

## 4. Project Directory Structure

```text
air-quality-analysis/
│
├── app.py                      # Main Streamlit web application & UI views
├── database.py                 # MySQL connection pooling, CRUD, & parameterized queries
├── data_processing.py          # Data ingestion, schema validation, and audit logger
├── analysis.py                 # CPCB & US EPA classification, KPI calculations, and trends
│
├── sql/
│   ├── schema.sql              # MySQL DDL script (database, table, indexes, sample data)
│   └── queries.sql             # 15 portfolio SQL analytical queries with documentation
│
├── data/
│   └── sample_air_quality.csv  # Verified demonstration benchmark dataset
│
├── requirements.txt            # Pinned Python package dependencies
├── .env.example                # Template for MySQL credentials
├── .gitignore                  # Git exclusion rules for secrets and virtual environments
└── README.md                   # Comprehensive documentation and setup guide
```

---

## 5. Key Dashboard Features

### A. Overview Dashboard
- **Live KPI Metrics**: Total air-quality records, monitored cities, network average AQI, peak recorded AQI with location & date, average PM2.5, and average PM10.
- **City-wise Average AQI**: Interactive horizontal bar chart sorted by pollution severity.
- **AQI Category Distribution**: Interactive donut chart mapped to official health hazard colors.
- **Historical Timeline**: Continuous trend line of network pollution trajectory.
- **Dynamic Data-Driven Summary**: Automatically computes cleanest city, dirtiest city, and PM2.5/PM10 ratio.

### B. City Comparison
- Multi-city selector comparing average AQI, minimum, maximum, and standard deviation (volatility).
- Grouped bar visualizations evaluating fine (PM2.5) vs coarse (PM10) particulate concentrations.
- Comparative timeline chart tracking multiple municipal trajectories simultaneously.

### C. Pollution Trends
- **Daily Trajectory**: High-resolution daily averages.
- **Monthly Aggregations**: Year-Month bar charts identifying seasonal peaks (e.g., winter atmospheric inversion).
- **Peak Pollution Episodes**: Ranked table of the top 10 most hazardous recorded dates.

### D. AQI Category Analysis
- Toggle between **India CPCB standard** (`Good`, `Satisfactory`, `Moderate`, `Poor`, `Very Poor`, `Severe`) and **US EPA standard**.
- Percentage breakdown and identification of cities with the highest proportion of `Poor` or worse readings.
- Complete regulatory breakpoint reference table.

### E. Data Explorer & CSV Ingestion
- Search by city, filter by date range, and filter by minimum/maximum AQI.
- Missing values and dataset health monitor.
- CSV download button for filtered datasets.
- Interactive upload pipeline with full validation audit report before database ingestion.

### F. SQL Queries Lab
- Interactive query executor for all 15 portfolio SQL queries against the MySQL database.

---

## 6. Installation & Execution Guide (Windows & macOS/Linux)

### Prerequisites
1. **Python 3.10+** installed on your system.
2. **MySQL Server 8.0+** installed and running locally (or via XAMPP / MySQL Workbench).

### Step 1: Open Terminal / Command Prompt
Navigate to the project directory:
```bash
cd air-quality-analysis
```

### Step 2: Create a Python Virtual Environment
**On Windows:**
```cmd
python -m venv venv
```
**On macOS/Linux:**
```bash
python3 -m venv venv
```

### Step 3: Activate the Virtual Environment
**On Windows:**
```cmd
venv\Scripts\activate
```
**On macOS/Linux:**
```bash
source venv/bin/activate
```

### Step 4: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 5: Configure MySQL Database
1. Open **MySQL Workbench** or your terminal MySQL client:
   ```bash
   mysql -u root -p
   ```
2. Execute the schema script:
   ```sql
   SOURCE sql/schema.sql;
   ```
   *(Or copy and paste the contents of `sql/schema.sql` into MySQL Workbench and run it).*

### Step 6: Configure Environment Variables
1. Make a copy of `.env.example` named `.env`:
   ```bash
   copy .env.example .env     # Windows
   cp .env.example .env       # macOS/Linux
   ```
2. Open `.env` in a text editor and enter your local MySQL password:
   ```ini
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_actual_mysql_password
   DB_NAME=air_quality_db
   ```

### Step 7: Launch the Streamlit Application
```bash
streamlit run app.py
```
The application will launch in your default web browser at `http://localhost:8501`.

---

## 7. Verification & Testing Checklist

- [x] **Application Startup**: Streamlit starts cleanly without runtime import errors.
- [x] **MySQL Connectivity**: Connects to `air_quality_db`; graceful fallback to sample CSV if MySQL is stopped.
- [x] **CSV Upload & Ingestion**: Ingests varied column names (`PM2.5`, `PM25`), audits nulls, drops invalid dates, and handles duplicates.
- [x] **Relational UPSERT**: Successfully executes parameterized batch inserts into MySQL.
- [x] **KPI Verification**: Calculations for averages, maximums, and city counts match underlying datasets.
- [x] **Filter Interactivity**: City selection and date range sliders dynamically update all charts and tables.
- [x] **SQL Query Accuracy**: All 15 SQL queries execute successfully against the MySQL schema.
- [x] **CSV Export**: Filtered tables export clean CSV files with appropriate headers.

---

## 8. Example Analytical Findings

1. **Seasonal Inversion Spikes**: Historical data from northern cities (e.g., Delhi) shows dramatic increases in AQI and PM2.5 during November–January (exceeding 380 AQI), driven by winter meteorological inversions and biomass burning.
2. **Coastal Atmospheric Moderation**: Coastal cities like Mumbai and Chennai exhibit lower standard deviations in AQI, benefiting from sea breezes that aid pollutant dispersion.
3. **Particulate Ratios**: Analysis of PM2.5 to PM10 ratios across urban centers averages ~0.65–0.75, indicating that fine combustion particulates constitute the dominant health hazard.

---

## 9. Limitations & Future Enhancements

- **Current Scope**: Analyzes historical batch and uploaded observational datasets; does not provide real-time streaming telemetry or predictive machine learning forecasts.
- **Future Roadmap**:
  - Integrate automated REST API ingestion from government open-data portals (e.g., data.gov.in / OpenAQ).
  - Add geospatial mapping with Folium / Mapbox heatmaps.
  - Implement time-series forecasting (ARIMA / Prophet) for seasonal pollution alerts.

---

## 10. Resume Bullet Points for Fresher Portfolio

- **Air Quality Analytics & Pollution Insights Dashboard (Python, MySQL, Streamlit, Plotly)**
  - *Engineered an end-to-end data analytics dashboard in Streamlit to analyze historical air quality telemetry across 6+ metropolitan cities, computing CPCB-standard AQI classifications, PM2.5/PM10 particulate ratios, and multi-city comparative trends.*
  - *Architected a MySQL relational database with composite unique constraints and parameterized UPSERT logic to eliminate duplicate records during CSV ingestion, and authored 15 analytical SQL queries utilizing window functions, conditional aggregations, and subqueries.*
