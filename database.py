
"""
Database Connection and Operations Module
Connects to MySQL, handles table creation, safe parameterized queries,
and idempotent bulk data imports.
"""

import os
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

import mysql.connector
from mysql.connector import errorcode
import pandas as pd
from dotenv import load_dotenv


# --------------------------------------------------
# LOAD ENVIRONMENT VARIABLES
# --------------------------------------------------

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)


# --------------------------------------------------
# DATABASE CONFIGURATION
# --------------------------------------------------

def get_db_config() -> Dict[str, Any]:
    """
    Retrieves database configuration from .env.
    """

    return {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "air_quality_db"),
        "connect_timeout": 5,
        "charset": "utf8",
        "collation": "utf8_general_ci",
        "use_pure": True
    }


# --------------------------------------------------
# MYSQL CONNECTION
# --------------------------------------------------

def get_connection(
    include_database: bool = True
) -> mysql.connector.MySQLConnection:
    """
    Establishes a MySQL connection.

    include_database=False connects to the MySQL server
    without selecting a database.
    """

    config = get_db_config()

    if not include_database:
        config.pop("database", None)

    try:
        connection = mysql.connector.connect(**config)
        return connection

    except mysql.connector.Error as err:

        if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            raise ConnectionError(
                "Access denied. Check MySQL username and password in .env."
            ) from err

        elif err.errno == errorcode.ER_BAD_DB_ERROR:
            raise ConnectionError(
                f"Database '{config.get('database')}' does not exist."
            ) from err

        elif err.errno == 2003:
            raise ConnectionError(
                f"Cannot connect to MySQL server at "
                f"{config.get('host')}:{config.get('port')}. "
                "Check whether MySQL is running."
            ) from err

        else:
            raise ConnectionError(
                f"MySQL connection failed: {err.msg}"
            ) from err


# --------------------------------------------------
# TEST CONNECTION
# --------------------------------------------------

def test_connection() -> Tuple[bool, str]:
    """
    Tests the MySQL database connection.
    """

    conn = None

    try:
        conn = get_connection(include_database=True)

        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()

        return (
            True,
            "Successfully connected to MySQL database 'air_quality_db'."
        )

    except Exception as e:
        return False, str(e)

    finally:
        if conn and conn.is_connected():
            conn.close()


# --------------------------------------------------
# INITIALIZE DATABASE AND TABLE
# --------------------------------------------------

def initialize_database() -> Tuple[bool, str]:
    """
    Creates the database and air_quality_records table
    if they do not already exist.
    """

    root_conn = None
    conn = None

    try:

        # Step 1: Connect to MySQL without selecting a database
        root_conn = get_connection(include_database=False)

        root_cursor = root_conn.cursor()

        # Use utf8 because this is the character set supported
        # by the MySQL server in the successful connection test.
        root_cursor.execute(
            """
            CREATE DATABASE IF NOT EXISTS air_quality_db
            CHARACTER SET utf8
            COLLATE utf8_general_ci
            """
        )

        root_cursor.close()
        root_conn.close()
        root_conn = None

        # Step 2: Connect to the database
        conn = get_connection(include_database=True)

        cursor = conn.cursor()

        # Step 3: Create the main table
        create_table_query = """
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
        """

        cursor.execute(create_table_query)

        # Step 4: Create indexes
        indexes = [
            (
                "idx_city",
                "CREATE INDEX idx_city ON air_quality_records (city)"
            ),
            (
                "idx_record_date",
                "CREATE INDEX idx_record_date ON air_quality_records (record_date)"
            ),
            (
                "idx_aqi",
                "CREATE INDEX idx_aqi ON air_quality_records (aqi)"
            )
        ]

        for idx_name, idx_sql in indexes:
            try:
                cursor.execute(idx_sql)

            except mysql.connector.Error as err:
                # Ignore only duplicate-index errors.
                if err.errno != 1061:
                    raise

        conn.commit()
        cursor.close()

        return (
            True,
            "Database 'air_quality_db' and table "
            "'air_quality_records' initialized successfully."
        )

    except Exception as e:

        if conn:
            conn.rollback()

        return False, f"Database initialization failed: {str(e)}"

    finally:

        if root_conn and root_conn.is_connected():
            root_conn.close()

        if conn and conn.is_connected():
            conn.close()


# --------------------------------------------------
# IMPORT RECORDS INTO MYSQL
# --------------------------------------------------

def import_records_to_db(
    df: pd.DataFrame
) -> Tuple[int, int, str]:
    """
    Imports records into MySQL.

    Duplicate city and date combinations are updated
    instead of inserted again.
    """

    if df.empty:
        return 0, 0, "No records provided for import."

    required_columns = ["city", "record_date", "aqi"]

    missing_columns = [
        col for col in required_columns if col not in df.columns
    ]

    if missing_columns:
        return (
            0,
            len(df),
            f"Missing required columns: {missing_columns}"
        )

    upsert_sql = """
    INSERT INTO air_quality_records
        (city, record_date, aqi, pm25, pm10)
    VALUES (%s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        aqi = VALUES(aqi),
        pm25 = VALUES(pm25),
        pm10 = VALUES(pm10);
    """

    records = []

    try:
        for _, row in df.iterrows():

            pm25_val = (
                None if pd.isna(row.get("pm25"))
                else float(row["pm25"])
            )

            pm10_val = (
                None if pd.isna(row.get("pm10"))
                else float(row["pm10"])
            )

            records.append((
                str(row["city"]),
                str(row["record_date"]),
                int(row["aqi"]),
                pm25_val,
                pm10_val
            ))

    except (ValueError, TypeError) as e:
        return 0, len(df), f"Invalid record data: {str(e)}"

    conn = None

    try:
        conn = get_connection(include_database=True)

        cursor = conn.cursor()

        cursor.executemany(upsert_sql, records)

        conn.commit()

        affected = cursor.rowcount

        cursor.close()

        return (
            len(records),
            0,
            f"Successfully processed {len(records)} records "
            f"(Rows affected: {affected})."
        )

    except Exception as e:

        if conn:
            conn.rollback()

        return 0, len(records), f"Database import error: {str(e)}"

    finally:

        if conn and conn.is_connected():
            conn.close()


# --------------------------------------------------
# LOAD ALL RECORDS
# --------------------------------------------------

def load_all_records_from_db() -> pd.DataFrame:
    """
    Retrieves all air quality records from MySQL.
    """

    query = """
    SELECT
        id,
        city,
        record_date,
        aqi,
        pm25,
        pm10
    FROM air_quality_records
    ORDER BY record_date ASC, city ASC;
    """

    conn = None

    try:

        conn = get_connection(include_database=True)

        cursor = conn.cursor(dictionary=True)
        cursor.execute(query)

        rows = cursor.fetchall()

        cursor.close()

        df = pd.DataFrame(rows)

        if not df.empty and "record_date" in df.columns:
            df["record_date"] = pd.to_datetime(
                df["record_date"]
            ).dt.date

        return df

    finally:

        if conn and conn.is_connected():
            conn.close()


# --------------------------------------------------
# EXECUTE SQL QUERY
# --------------------------------------------------

def execute_sql_query(
    query: str,
    params: Optional[Tuple] = None
) -> Tuple[Optional[pd.DataFrame], Optional[str]]:
    """
    Executes a SQL SELECT or aggregation query
    and returns the result as a DataFrame.

    Only read-only queries are allowed.
    """

    conn = None
    cursor = None

    try:

        normalized_query = query.strip().lower()

        if not normalized_query.startswith("select"):
            return None, "Only SELECT queries are allowed."

        conn = get_connection(include_database=True)

        cursor = conn.cursor(dictionary=True)

        cursor.execute(query, params or ())

        rows = cursor.fetchall()

        df = pd.DataFrame(rows)

        return df, None

    except Exception as e:

        return None, str(e)

    finally:

        if cursor:
            cursor.close()

        if conn and conn.is_connected():
            conn.close()
