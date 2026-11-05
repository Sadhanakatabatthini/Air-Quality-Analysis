-- =============================================================================
-- Air Quality Analysis and Pollution Insights Dashboard
-- 15 Core SQL Analysis Queries for Portfolio & Data Insights
-- Database: air_quality_db | Table: air_quality_records
-- =============================================================================

USE air_quality_db;

-- -----------------------------------------------------------------------------
-- Query 1: Display all air-quality records ordered chronologically
-- Concept: Basic SELECT projection, ORDER BY sorting
-- -----------------------------------------------------------------------------
SELECT 
    id,
    city,
    record_date,
    aqi,
    pm25,
    pm10,
    created_at
FROM air_quality_records
ORDER BY record_date DESC, city ASC;


-- -----------------------------------------------------------------------------
-- Query 2: Find the highest AQI reading and which city/date it occurred
-- Concept: Subquery or ORDER BY with LIMIT to find the extreme peak
-- -----------------------------------------------------------------------------
SELECT 
    city,
    record_date,
    aqi,
    pm25,
    pm10
FROM air_quality_records
WHERE aqi = (SELECT MAX(aqi) FROM air_quality_records);


-- -----------------------------------------------------------------------------
-- Query 3: Calculate average AQI by city (rounded to 2 decimal places)
-- Concept: GROUP BY aggregation with AVG() and ROUND()
-- -----------------------------------------------------------------------------
SELECT 
    city,
    ROUND(AVG(aqi), 2) AS avg_aqi,
    MIN(aqi) AS min_aqi,
    MAX(aqi) AS max_aqi,
    COUNT(*) AS total_records
FROM air_quality_records
GROUP BY city
ORDER BY avg_aqi DESC;


-- -----------------------------------------------------------------------------
-- Query 4: Find cities with average AQI above a specified threshold (e.g., 150)
-- Concept: HAVING clause to filter on aggregated results (post-GROUP BY)
-- -----------------------------------------------------------------------------
SELECT 
    city,
    ROUND(AVG(aqi), 2) AS avg_aqi,
    COUNT(*) AS sample_size
FROM air_quality_records
GROUP BY city
HAVING AVG(aqi) > 150
ORDER BY avg_aqi DESC;


-- -----------------------------------------------------------------------------
-- Query 5: Calculate average PM2.5 by city
-- Concept: Aggregate function AVG() ignoring NULL values
-- -----------------------------------------------------------------------------
SELECT 
    city,
    ROUND(AVG(pm25), 2) AS avg_pm25,
    MIN(pm25) AS min_pm25,
    MAX(pm25) AS max_pm25,
    COUNT(pm25) AS non_null_pm25_count
FROM air_quality_records
GROUP BY city
ORDER BY avg_pm25 DESC;


-- -----------------------------------------------------------------------------
-- Query 6: Calculate average PM10 by city
-- Concept: Aggregate function AVG() for coarse particulate matter
-- -----------------------------------------------------------------------------
SELECT 
    city,
    ROUND(AVG(pm10), 2) AS avg_pm10,
    MIN(pm10) AS min_pm10,
    MAX(pm10) AS max_pm10,
    COUNT(pm10) AS non_null_pm10_count
FROM air_quality_records
GROUP BY city
ORDER BY avg_pm10 DESC;


-- -----------------------------------------------------------------------------
-- Query 7: Count records by AQI category (India CPCB Standard Breakpoints)
-- Concept: Conditional aggregation using CASE WHEN expressions
-- -----------------------------------------------------------------------------
SELECT 
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
ORDER BY MIN(aqi) ASC;


-- -----------------------------------------------------------------------------
-- Query 8: Find the top 10 most polluted recorded dates across the network
-- Concept: Aggregating cross-city network daily severity
-- -----------------------------------------------------------------------------
SELECT 
    record_date,
    ROUND(AVG(aqi), 2) AS daily_network_avg_aqi,
    MAX(aqi) AS highest_single_city_aqi,
    COUNT(DISTINCT city) AS cities_reporting
FROM air_quality_records
GROUP BY record_date
ORDER BY daily_network_avg_aqi DESC
LIMIT 10;


-- -----------------------------------------------------------------------------
-- Query 9: Calculate daily average AQI for tracking trends over time
-- Concept: Time-series aggregation grouped by date
-- -----------------------------------------------------------------------------
SELECT 
    record_date,
    ROUND(AVG(aqi), 2) AS avg_aqi,
    ROUND(AVG(pm25), 2) AS avg_pm25,
    ROUND(AVG(pm10), 2) AS avg_pm10,
    COUNT(*) AS records_logged
FROM air_quality_records
GROUP BY record_date
ORDER BY record_date ASC;


-- -----------------------------------------------------------------------------
-- Query 10: Calculate monthly average AQI and seasonal trends
-- Concept: MySQL DATE_FORMAT() function for grouping by Year-Month
-- -----------------------------------------------------------------------------
SELECT 
    DATE_FORMAT(record_date, '%Y-%m') AS year_month,
    ROUND(AVG(aqi), 2) AS monthly_avg_aqi,
    ROUND(AVG(pm25), 2) AS monthly_avg_pm25,
    ROUND(AVG(pm10), 2) AS monthly_avg_pm10,
    MIN(aqi) AS lowest_aqi,
    MAX(aqi) AS peak_aqi,
    COUNT(*) AS total_monthly_readings
FROM air_quality_records
GROUP BY DATE_FORMAT(record_date, '%Y-%m')
ORDER BY year_month ASC;


-- -----------------------------------------------------------------------------
-- Query 11: Compare pollutant levels (AQI, PM2.5, PM10) across cities
-- Concept: Multi-metric cross-sectional analysis with ratio calculations
-- -----------------------------------------------------------------------------
SELECT 
    city,
    ROUND(AVG(aqi), 1) AS avg_aqi,
    ROUND(AVG(pm25), 1) AS avg_pm25,
    ROUND(AVG(pm10), 1) AS avg_pm10,
    -- Ratio of fine particulate matter PM2.5 to coarse PM10
    ROUND(AVG(pm25) / NULLIF(AVG(pm10), 0), 2) AS pm25_to_pm10_ratio
FROM air_quality_records
GROUP BY city
ORDER BY avg_aqi DESC;


-- -----------------------------------------------------------------------------
-- Query 12: Find records exceeding a critical health threshold (AQI > 200: Poor+)
-- Concept: Filtering with WHERE clause on continuous numerical thresholds
-- -----------------------------------------------------------------------------
SELECT 
    city,
    record_date,
    aqi,
    pm25,
    pm10,
    CASE 
        WHEN aqi > 400 THEN 'Hazardous/Severe'
        WHEN aqi > 300 THEN 'Very Poor'
        ELSE 'Poor'
    END AS severity_label
FROM air_quality_records
WHERE aqi > 200
ORDER BY aqi DESC, record_date DESC;


-- -----------------------------------------------------------------------------
-- Query 13: Rank cities by average AQI using Window Functions
-- Concept: Modern SQL DENSE_RANK() OVER (ORDER BY ...)
-- -----------------------------------------------------------------------------
SELECT 
    DENSE_RANK() OVER (ORDER BY AVG(aqi) DESC) AS pollution_rank,
    city,
    ROUND(AVG(aqi), 2) AS avg_aqi,
    ROUND(AVG(pm25), 2) AS avg_pm25,
    ROUND(AVG(pm10), 2) AS avg_pm10,
    COUNT(*) AS total_readings
FROM air_quality_records
GROUP BY city
ORDER BY pollution_rank ASC;


-- -----------------------------------------------------------------------------
-- Query 14: Calculate each city's percentage of readings exceeding AQI 200 (Poor or Worse)
-- Concept: Conditional counting with SUM(CASE WHEN ... THEN 1 ELSE 0 END)
-- -----------------------------------------------------------------------------
SELECT 
    city,
    COUNT(*) AS total_records,
    SUM(CASE WHEN aqi > 200 THEN 1 ELSE 0 END) AS poor_or_worse_records,
    ROUND(
        SUM(CASE WHEN aqi > 200 THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 
        2
    ) AS pct_poor_or_worse
FROM air_quality_records
GROUP BY city
ORDER BY pct_poor_or_worse DESC, total_records DESC;


-- -----------------------------------------------------------------------------
-- Query 15: Find cities with the greatest variation (volatility) in AQI
-- Concept: Standard deviation STDDEV() and Range (MAX - MIN) for stability analysis
-- -----------------------------------------------------------------------------
SELECT 
    city,
    ROUND(STDDEV(aqi), 2) AS aqi_standard_deviation,
    (MAX(aqi) - MIN(aqi)) AS aqi_range,
    MIN(aqi) AS cleanest_reading,
    MAX(aqi) AS dirtiest_reading,
    ROUND(AVG(aqi), 2) AS baseline_avg_aqi
FROM air_quality_records
GROUP BY city
ORDER BY aqi_standard_deviation DESC;
