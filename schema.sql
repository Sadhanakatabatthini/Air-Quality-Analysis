
-- =============================================================================
-- Air Quality Analysis and Pollution Insights Dashboard
-- Database Schema - Four Table Structure
-- =============================================================================

-- STEP 1: Create and select database
CREATE DATABASE IF NOT EXISTS air_quality_db;
USE air_quality_db;


-- =============================================================================
-- STEP 2: Create air_quality_records table
-- This is the main table containing daily air quality information.
-- =============================================================================

CREATE TABLE IF NOT EXISTS air_quality_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    record_date DATE NOT NULL,
    aqi INT NOT NULL,
    pm25 DECIMAL(7,2) NULL,
    pm10 DECIMAL(7,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_city_date UNIQUE (city, record_date),

    INDEX idx_city (city),
    INDEX idx_record_date (record_date),
    INDEX idx_aqi (aqi)
) ENGINE=InnoDB;


-- =============================================================================
-- STEP 3: Create cities table
-- Stores unique city information.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cities (
    city_id INT AUTO_INCREMENT PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(100)
) ENGINE=InnoDB;


-- =============================================================================
-- STEP 4: Create pollutants table
-- Stores pollutant names and their measurement units.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pollutants (
    pollutant_id INT AUTO_INCREMENT PRIMARY KEY,
    pollutant_name VARCHAR(50) NOT NULL UNIQUE,
    unit VARCHAR(30) NOT NULL
) ENGINE=InnoDB;


-- =============================================================================
-- STEP 5: Add city_id to the main table if it is missing
-- =============================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'air_quality_records'
      AND COLUMN_NAME = 'city_id'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE air_quality_records ADD COLUMN city_id INT NULL',
    'SELECT "city_id column already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================================================
-- STEP 6: Populate cities table using existing records
-- =============================================================================

INSERT IGNORE INTO cities (city_name)
SELECT DISTINCT city
FROM air_quality_records
WHERE city IS NOT NULL AND city <> '';


-- =============================================================================
-- STEP 7: Link air quality records with cities
-- =============================================================================

UPDATE air_quality_records ar
JOIN cities c ON ar.city = c.city_name
SET ar.city_id = c.city_id
WHERE ar.city_id IS NULL;


-- =============================================================================
-- STEP 8: Make city_id mandatory
-- =============================================================================

ALTER TABLE air_quality_records
MODIFY city_id INT NOT NULL;


-- =============================================================================
-- STEP 9: Add foreign key between cities and air_quality_records
-- =============================================================================

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'air_quality_records'
      AND CONSTRAINT_NAME = 'fk_record_city'
);

SET @sql = IF(
    @fk_exists = 0,
    'ALTER TABLE air_quality_records
     ADD CONSTRAINT fk_record_city
     FOREIGN KEY (city_id) REFERENCES cities(city_id)',
    'SELECT "City foreign key already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================================================
-- STEP 10: Insert pollutant master data
-- =============================================================================

INSERT IGNORE INTO pollutants (pollutant_name, unit)
VALUES
    ('PM2.5', 'ug/m3'),
    ('PM10', 'ug/m3');


-- =============================================================================
-- STEP 11: Create pollutant_measurements table
-- Stores pollutant concentrations for each air quality record.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pollutant_measurements (
    measurement_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT NOT NULL,
    pollutant_id INT NOT NULL,
    concentration DECIMAL(10,2) NULL,

    CONSTRAINT fk_measurement_record
        FOREIGN KEY (record_id)
        REFERENCES air_quality_records(id),

    CONSTRAINT fk_measurement_pollutant
        FOREIGN KEY (pollutant_id)
        REFERENCES pollutants(pollutant_id),

    CONSTRAINT uq_record_pollutant
        UNIQUE (record_id, pollutant_id)
) ENGINE=InnoDB;


-- =============================================================================
-- STEP 12: Migrate PM2.5 measurements
-- =============================================================================

INSERT INTO pollutant_measurements
    (record_id, pollutant_id, concentration)
SELECT
    ar.id,
    p.pollutant_id,
    ar.pm25
FROM air_quality_records ar
JOIN pollutants p
    ON p.pollutant_name = 'PM2.5'
WHERE ar.pm25 IS NOT NULL
ON DUPLICATE KEY UPDATE
    concentration = VALUES(concentration);


-- =============================================================================
-- STEP 13: Migrate PM10 measurements
-- =============================================================================

INSERT INTO pollutant_measurements
    (record_id, pollutant_id, concentration)
SELECT
    ar.id,
    p.pollutant_id,
    ar.pm10
FROM air_quality_records ar
JOIN pollutants p
    ON p.pollutant_name = 'PM10'
WHERE ar.pm10 IS NOT NULL
ON DUPLICATE KEY UPDATE
    concentration = VALUES(concentration);


-- =============================================================================
-- STEP 14: Verify database tables
-- =============================================================================

SHOW TABLES;


-- =============================================================================
-- STEP 15: Verify table relationships and data
-- =============================================================================

SELECT * FROM cities;

SELECT * FROM air_quality_records;

SELECT * FROM pollutants;

SELECT * FROM pollutant_measurements;


-- =============================================================================
-- END OF DATABASE SCHEMA
-- =============================================================================
