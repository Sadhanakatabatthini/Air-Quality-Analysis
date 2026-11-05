"""
Analysis and Metric Calculations Module
Provides domain calculations, AQI classifications (India CPCB vs US EPA standards),
aggregation engines, and comparative metrics for air quality analysis.
"""

from typing import Dict, List, Tuple, Any
import pandas as pd
import numpy as np
from typing import Optional


# ==============================================================================
# AQI Standard Definitions & Breakpoints
# ==============================================================================

# India Central Pollution Control Board (CPCB) National Air Quality Index
CPCB_CATEGORIES = [
    {"label": "Good", "min": 0, "max": 50, "color": "#16a34a", "description": "Minimal health impact"},
    {"label": "Satisfactory", "min": 51, "max": 100, "color": "#65a30d", "description": "Minor breathing discomfort to sensitive people"},
    {"label": "Moderate", "min": 101, "max": 200, "color": "#d97706", "description": "Breathing discomfort to people with lungs/heart disease"},
    {"label": "Poor", "min": 201, "max": 300, "color": "#ea580c", "description": "Breathing discomfort to most people on prolonged exposure"},
    {"label": "Very Poor", "min": 301, "max": 400, "color": "#dc2626", "description": "Respiratory illness on prolonged exposure"},
    {"label": "Severe", "min": 401, "max": 2000, "color": "#7f1d1d", "description": "Affects healthy people and seriously impacts those with existing diseases"},
]

# US Environmental Protection Agency (US EPA) Air Quality Index
US_EPA_CATEGORIES = [
    {"label": "Good", "min": 0, "max": 50, "color": "#16a34a", "description": "Air quality is considered satisfactory, and air pollution poses little or no risk"},
    {"label": "Moderate", "min": 51, "max": 100, "color": "#ca8a04", "description": "Air quality is acceptable; acceptable risk for a very small number of individuals"},
    {"label": "Unhealthy for Sensitive Groups", "min": 101, "max": 150, "color": "#ea580c", "description": "Members of sensitive groups may experience health effects"},
    {"label": "Unhealthy", "min": 151, "max": 200, "color": "#dc2626", "description": "Everyone may begin to experience health effects"},
    {"label": "Very Unhealthy", "min": 201, "max": 300, "color": "#9333ea", "description": "Health alert: everyone may experience more serious health effects"},
    {"label": "Hazardous", "min": 301, "max": 2000, "color": "#881337", "description": "Health warnings of emergency conditions; entire population affected"},
]


def classify_aqi_value(aqi: int, standard: str = "CPCB") -> Dict[str, Any]:
    """
    Classifies an individual AQI numeric value into its respective category
    under the chosen standard (CPCB or US_EPA).
    
    Note: Calculated category from numerical breakpoint; distinct from official agency station badges.
    """
    categories = CPCB_CATEGORIES if standard.upper() == "CPCB" else US_EPA_CATEGORIES
    
    for cat in categories:
        if cat["min"] <= aqi <= cat["max"]:
            return {
                "category": cat["label"],
                "color": cat["color"],
                "description": cat["description"],
                "standard": standard.upper()
            }
            
    # Fallback for extreme outlier readings
    last_cat = categories[-1]
    return {
        "category": last_cat["label"],
        "color": last_cat["color"],
        "description": last_cat["description"],
        "standard": standard.upper()
    }


def add_aqi_category_column(df: pd.DataFrame, standard: str = "CPCB") -> pd.DataFrame:
    """
    Appends 'aqi_category' and 'aqi_color' columns to the dataframe based on the configured standard.
    """
    if df.empty or "aqi" not in df.columns:
        return df

    res_df = df.copy()
    categories = CPCB_CATEGORIES if standard.upper() == "CPCB" else US_EPA_CATEGORIES
    
    def get_category_name(val):
        for c in categories:
            if c["min"] <= val <= c["max"]:
                return c["label"]
        return categories[-1]["label"]

    res_df["aqi_category"] = res_df["aqi"].apply(get_category_name)
    return res_df


def calculate_dashboard_kpis(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Computes primary summary metrics and key findings from the actual dataset.
    """
    if df.empty:
        return {
            "total_records": 0,
            "city_count": 0,
            "avg_aqi": 0.0,
            "max_aqi": 0,
            "max_aqi_city": "N/A",
            "max_aqi_date": "N/A",
            "min_aqi": 0,
            "avg_pm25": 0.0,
            "avg_pm10": 0.0,
            "has_data": False,
        }

    max_idx = df["aqi"].idxmax()
    max_row = df.loc[max_idx]

    return {
        "total_records": int(len(df)),
        "city_count": int(df["city"].nunique()),
        "avg_aqi": round(float(df["aqi"].mean()), 1),
        "max_aqi": int(max_row["aqi"]),
        "max_aqi_city": str(max_row["city"]),
        "max_aqi_date": str(max_row["record_date"]),
        "min_aqi": int(df["aqi"].min()),
        "avg_pm25": round(float(df["pm25"].mean()), 1) if df["pm25"].notna().any() else None,
        "avg_pm10": round(float(df["pm10"].mean()), 1) if df["pm10"].notna().any() else None,
        "has_data": True,
    }


def compute_city_comparison(df: pd.DataFrame, selected_cities: List[str]) -> pd.DataFrame:
    """
    Computes comparative statistics across selected cities.
    """
    if df.empty or not selected_cities:
        return pd.DataFrame()

    filtered = df[df["city"].isin(selected_cities)]
    if filtered.empty:
        return pd.DataFrame()

    # Group by city and calculate summary stats
    comparison = filtered.groupby("city").agg(
        record_count=("aqi", "count"),
        avg_aqi=("aqi", "mean"),
        min_aqi=("aqi", "min"),
        max_aqi=("aqi", "max"),
        std_aqi=("aqi", lambda x: x.std(ddof=0) if len(x) > 1 else 0.0),
        avg_pm25=("pm25", "mean"),
        avg_pm10=("pm10", "mean"),
    ).reset_index()

    comparison["avg_aqi"] = comparison["avg_aqi"].round(1)
    comparison["std_aqi"] = comparison["std_aqi"].round(1)
    comparison["avg_pm25"] = comparison["avg_pm25"].round(1)
    comparison["avg_pm10"] = comparison["avg_pm10"].round(1)
    
    return comparison.sort_values(by="avg_aqi", ascending=False)


def compute_pollution_trends(df: pd.DataFrame, selected_cities: Optional[List[str]] = None) -> Dict[str, pd.DataFrame]:
    """
    Aggregates daily and monthly pollution trends.
    Handles datasets with single dates or sparse readings gracefully.
    """
    data = df.copy()
    if selected_cities:
        data = data[data["city"].isin(selected_cities)]
        
    if data.empty:
        return {"daily": pd.DataFrame(), "monthly": pd.DataFrame()}

    # Daily aggregation
    daily = data.groupby("record_date").agg(
        avg_aqi=("aqi", "mean"),
        avg_pm25=("pm25", "mean"),
        avg_pm10=("pm10", "mean"),
        record_count=("city", "count")
    ).reset_index()
    daily["avg_aqi"] = daily["avg_aqi"].round(1)
    daily["avg_pm25"] = daily["avg_pm25"].round(1)
    daily["avg_pm10"] = daily["avg_pm10"].round(1)
    daily = daily.sort_values(by="record_date")

    # Monthly aggregation
    data["year_month"] = pd.to_datetime(data["record_date"]).dt.to_period("M").astype(str)
    monthly = data.groupby("year_month").agg(
        avg_aqi=("aqi", "mean"),
        avg_pm25=("pm25", "mean"),
        avg_pm10=("pm10", "mean"),
        record_count=("city", "count")
    ).reset_index()
    monthly["avg_aqi"] = monthly["avg_aqi"].round(1)
    monthly["avg_pm25"] = monthly["avg_pm25"].round(1)
    monthly["avg_pm10"] = monthly["avg_pm10"].round(1)
    monthly = monthly.sort_values(by="year_month")

    return {"daily": daily, "monthly": monthly}


def compute_category_distribution(df: pd.DataFrame, standard: str = "CPCB") -> Dict[str, Any]:
    """
    Calculates record frequency and proportion across categories,
    and identifies cities with highest percentage of Poor or worse readings.
    """
    if df.empty:
        return {"distribution": pd.DataFrame(), "severe_cities": pd.DataFrame()}

    classified_df = add_aqi_category_column(df, standard=standard)
    categories = CPCB_CATEGORIES if standard.upper() == "CPCB" else US_EPA_CATEGORIES
    
    # Establish canonical ordering
    cat_order = [c["label"] for c in categories]
    cat_colors = {c["label"]: c["color"] for c in categories}
    
    # Value counts
    counts = classified_df["aqi_category"].value_counts().reindex(cat_order, fill_value=0)
    total = len(classified_df)
    
    dist_df = pd.DataFrame({
        "Category": counts.index,
        "Records": counts.values,
        "Percentage": [round((val / total) * 100, 1) if total > 0 else 0 for val in counts.values],
        "Color": [cat_colors.get(cat, "#94a3b8") for cat in counts.index]
    })

    # Cities with highest proportion of Poor or worse
    # For CPCB: Poor is AQI > 200 (Poor, Very Poor, Severe)
    # For US EPA: Unhealthy is AQI > 150 (Unhealthy, Very Unhealthy, Hazardous)
    threshold = 200 if standard.upper() == "CPCB" else 150
    poor_label_context = "Poor or Worse (AQI > 200)" if standard.upper() == "CPCB" else "Unhealthy or Worse (AQI > 150)"
    
    city_group = classified_df.groupby("city").agg(
        total_records=("aqi", "count"),
        high_pollution_count=("aqi", lambda x: int((x > threshold).sum()))
    ).reset_index()
    
    city_group["pct_high_pollution"] = (
        (city_group["high_pollution_count"] / city_group["total_records"]) * 100
    ).round(1)
    
    severe_cities = city_group.sort_values(
        by=["pct_high_pollution", "total_records"], 
        ascending=[False, False]
    )

    return {
        "distribution": dist_df,
        "severe_cities": severe_cities,
        "threshold_label": poor_label_context
    }
