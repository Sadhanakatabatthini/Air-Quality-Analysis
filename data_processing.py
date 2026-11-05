"""
Data Processing Module for Air Quality Analysis Dashboard
Handles CSV ingestion, column normalization, type casting, validation, and auditing.
"""

from typing import Dict, List, Tuple, Any
import pandas as pd
import numpy as np


# Standard internal column names used throughout the application
REQUIRED_COLUMNS = ["city", "record_date", "aqi"]
OPTIONAL_COLUMNS = ["pm25", "pm10"]

# Synonyms dictionary mapping varied CSV headers to normalized column names
COLUMN_ALIASES = {
    # City aliases
    "city": "city",
    "location": "city",
    "station_city": "city",
    "place": "city",
    
    # Date aliases
    "date": "record_date",
    "record_date": "record_date",
    "timestamp": "record_date",
    "datetime": "record_date",
    "day": "record_date",
    
    # AQI aliases
    "aqi": "aqi",
    "air_quality_index": "aqi",
    "overall_aqi": "aqi",
    
    # PM2.5 aliases
    "pm25": "pm25",
    "pm2.5": "pm25",
    "pm2_5": "pm25",
    "pm_25": "pm25",
    "pm_2.5": "pm25",
    
    # PM10 aliases
    "pm10": "pm10",
    "pm_10": "pm10",
}


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes dataframe column headers by stripping whitespace, converting to lower case,
    and mapping known variations (e.g., 'PM2.5' -> 'pm25').
    """
    renamed_cols = {}
    for col in df.columns:
        clean_name = str(col).strip().lower()
        if clean_name in COLUMN_ALIASES:
            renamed_cols[col] = COLUMN_ALIASES[clean_name]
        else:
            renamed_cols[col] = clean_name
    return df.rename(columns=renamed_cols)


def validate_and_clean_dataset(raw_df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Validates and cleans uploaded or ingested air quality data.
    
    Returns:
        cleaned_df: Validated DataFrame ready for MySQL insertion and analysis.
        audit_report: Dictionary detailing validation steps, dropped rows, and warnings.
    """
    audit = {
        "initial_row_count": len(raw_df),
        "valid_row_count": 0,
        "dropped_rows": 0,
        "missing_columns": [],
        "duplicate_rows_detected": 0,
        "invalid_dates_count": 0,
        "invalid_aqi_count": 0,
        "missing_pm25_count": 0,
        "missing_pm10_count": 0,
        "warnings": [],
        "errors": []
    }
    
    if raw_df.empty:
        audit["errors"].append("The provided dataset is empty.")
        return pd.DataFrame(), audit
    
    # 1. Normalize columns
    df = normalize_column_names(raw_df.copy())
    
    # Check for required columns
    missing_req = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_req:
        audit["missing_columns"] = missing_req
        audit["errors"].append(
            f"Missing essential required column(s): {', '.join(missing_req)}. "
            f"Required: City, Date, and AQI."
        )
        return pd.DataFrame(), audit
    
    # Ensure optional columns exist (as NaN if not supplied)
    for opt_col in OPTIONAL_COLUMNS:
        if opt_col not in df.columns:
            df[opt_col] = np.nan
            audit["warnings"].append(f"Column '{opt_col}' was not provided; values default to NULL.")
    
    # 2. Clean City names
    df["city"] = df["city"].astype(str).str.strip()
    empty_cities = df["city"].isin(["", "nan", "none", "null"])
    if empty_cities.any():
        audit["dropped_rows"] += int(empty_cities.sum())
        audit["warnings"].append(f"Dropped {empty_cities.sum()} row(s) with blank city names.")
        df = df[~empty_cities]
    
    # 3. Clean and parse Dates
    # Coerce invalid dates to NaT
    df["record_date"] = pd.to_datetime(df["record_date"], errors="coerce")
    invalid_dates = df["record_date"].isna()
    if invalid_dates.any():
        audit["invalid_dates_count"] = int(invalid_dates.sum())
        audit["dropped_rows"] += int(invalid_dates.sum())
        audit["warnings"].append(f"Dropped {invalid_dates.sum()} row(s) with invalid or unparseable dates.")
        df = df[~invalid_dates]
    
    # Format date as standard YYYY-MM-DD
    df["record_date"] = df["record_date"].dt.date
    
    # 4. Clean and validate AQI
    df["aqi"] = pd.to_numeric(df["aqi"], errors="coerce")
    invalid_aqi = df["aqi"].isna() | (df["aqi"] < 0) | (df["aqi"] > 2000)
    if invalid_aqi.any():
        audit["invalid_aqi_count"] = int(invalid_aqi.sum())
        audit["dropped_rows"] += int(invalid_aqi.sum())
        audit["warnings"].append(
            f"Dropped {invalid_aqi.sum()} row(s) with non-numeric or out-of-range AQI values (<0 or >2000)."
        )
        df = df[~invalid_aqi]
    
    df["aqi"] = df["aqi"].astype(int)
    
    # 5. Clean PM2.5 and PM10 (keep missing as NaN, do not artificially replace with zero)
    df["pm25"] = pd.to_numeric(df["pm25"], errors="coerce")
    df.loc[df["pm25"] < 0, "pm25"] = np.nan
    audit["missing_pm25_count"] = int(df["pm25"].isna().sum())
    
    df["pm10"] = pd.to_numeric(df["pm10"], errors="coerce")
    df.loc[df["pm10"] < 0, "pm10"] = np.nan
    audit["missing_pm10_count"] = int(df["pm10"].isna().sum())
    
    # 6. Check for duplicate (city, record_date) records
    duplicate_mask = df.duplicated(subset=["city", "record_date"], keep="last")
    if duplicate_mask.any():
        audit["duplicate_rows_detected"] = int(duplicate_mask.sum())
        audit["warnings"].append(
            f"Detected {duplicate_mask.sum()} duplicate (city, date) entries. "
            f"Retained latest occurrence according to dataset order."
        )
        df = df[~duplicate_mask]
    
    # Final row ordering and column selection
    final_df = df[["city", "record_date", "aqi", "pm25", "pm10"]].sort_values(
        by=["record_date", "city"]
    ).reset_index(drop=True)
    
    audit["valid_row_count"] = len(final_df)
    return final_df, audit


def get_dataset_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Computes summary metadata for a validated dataset.
    """
    if df.empty:
        return {"total_records": 0, "unique_cities": 0}
        
    return {
        "total_records": len(df),
        "unique_cities": int(df["city"].nunique()),
        "cities_list": sorted(df["city"].unique().tolist()),
        "min_date": str(df["record_date"].min()),
        "max_date": str(df["record_date"].max()),
        "avg_aqi": round(float(df["aqi"].mean()), 1) if not df["aqi"].empty else 0.0,
        "max_aqi": int(df["aqi"].max()) if not df["aqi"].empty else 0,
        "min_aqi": int(df["aqi"].min()) if not df["aqi"].empty else 0,
        "avg_pm25": round(float(df["pm25"].mean()), 1) if df["pm25"].notna().any() else None,
        "avg_pm10": round(float(df["pm10"].mean()), 1) if df["pm10"].notna().any() else None,
    }
