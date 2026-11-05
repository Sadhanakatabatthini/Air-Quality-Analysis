"""
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
from typing import Tuple, Optional, List, Dict, Any

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

# ==============================================================================
# Streamlit Page Setup & Styling
# ==============================================================================
st.set_page_config(
    page_title="Air Quality Analysis & Pollution Dashboard",
    page_icon="🍃",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for crisp, modern environmental data dashboard styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.1rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.25rem;
    }
    .sub-header {
        font-size: 1rem;
        color: #64748b;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin-bottom: 1rem;
    }
    .metric-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0.25rem 0;
    }
    .metric-caption {
        font-size: 0.8rem;
        color: #94a3b8;
    }
    .info-banner {
        background-color: #f0fdf4;
        border-left: 4px solid #16a34a;
        padding: 0.75rem 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        color: #166534;
        font-size: 0.9rem;
    }
</style>
""", unsafe_allow_html=True)


# ==============================================================================
# Data Loading & Caching Helpers
# ==============================================================================
@st.cache_data(show_spinner=False)
def load_default_sample_data() -> pd.DataFrame:
    """Loads the bundled sample dataset if database is offline or user requests sample data."""
    sample_path = os.path.join(os.path.dirname(__file__), "data", "sample_air_quality.csv")
    if os.path.exists(sample_path):
        raw_df = pd.read_csv(sample_path)
        clean_df, _ = validate_and_clean_dataset(raw_df)
        return clean_df
    return pd.DataFrame(columns=["city", "record_date", "aqi", "pm25", "pm10"])


def get_active_data(data_source_mode: str) -> Tuple[pd.DataFrame, str]:
    """
    Retrieves dataset based on selected data source mode.
    Handles MySQL connection fallback safely without raising unhandled exceptions.
    """
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
        # Session state custom dataset if uploaded, otherwise default sample
        if "custom_dataset" in st.session_state and not st.session_state["custom_dataset"].empty:
            return st.session_state["custom_dataset"], "Loaded user uploaded dataset."
        return load_default_sample_data(), "Loaded bundled sample dataset."


# ==============================================================================
# Sidebar Navigation and Configuration
# ==============================================================================
st.sidebar.markdown("## 🍃 Air Quality Analytics")
st.sidebar.caption("Portfolio Project · Python, MySQL & Streamlit")

# Navigation Menu
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
st.sidebar.markdown("### ⚙️ Data & Standard Settings")

data_source_option = st.sidebar.selectbox(
    "Data Source",
    options=["Sample / Uploaded Dataset", "MySQL Database"],
    index=0,
    help="Select 'MySQL Database' if your local MySQL instance is running and populated."
)

aqi_standard = st.sidebar.selectbox(
    "AQI Standard",
    options=["CPCB (India)", "US EPA"],
    index=0,
    help="India CPCB is recommended for Indian city data. US EPA uses different breakpoints."
)
standard_code = "CPCB" if "CPCB" in aqi_standard else "US_EPA"

# Load the working dataset
df, data_status_msg = get_active_data(data_source_option)

# Check if data exists
if df.empty:
    st.error("No air quality data available. Please upload a dataset in the Data Explorer section.")
    st.stop()

# Date range and City filters in Sidebar
all_cities = sorted(df["city"].unique().tolist())
min_date = df["record_date"].min()
max_date = df["record_date"].max()

st.sidebar.markdown("### 🔍 Global Filters")
selected_cities = st.sidebar.multiselect(
    "Filter Cities",
    options=all_cities,
    default=all_cities,
    help="Select one or more cities to include in analysis."
)

if min_date and max_date and min_date <= max_date:
    date_range = st.sidebar.date_input(
        "Date Range",
        value=(min_date, max_date),
        min_value=min_date,
        max_value=max_date,
        help="Filter records between two dates."
    )
else:
    date_range = (min_date, max_date)

# Apply filters
filtered_df = df.copy()
if selected_cities:
    filtered_df = filtered_df[filtered_df["city"].isin(selected_cities)]
else:
    filtered_df = pd.DataFrame(columns=df.columns)

if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
    start_d, end_d = date_range
    filtered_df = filtered_df[
        (filtered_df["record_date"] >= start_d) & (filtered_df["record_date"] <= end_d)
    ]

st.sidebar.caption(f"Showing {len(filtered_df)} of {len(df)} records")


# ==============================================================================
# SECTION A: OVERVIEW DASHBOARD
# ==============================================================================
if nav_selection == "Overview Dashboard":
    st.markdown('<div class="main-header">Air Quality Overview Dashboard</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="sub-header">Environmental telemetry and pollutant metrics · Standard: {aqi_standard}</div>', unsafe_allow_html=True)
    
    if filtered_df.empty:
        st.warning("No records match the current filter selection. Please adjust your filters in the sidebar.")
        st.stop()

    # Calculate actual KPIs
    kpis = calculate_dashboard_kpis(filtered_df)

    # Top KPI Metrics Row
    col1, col2, col3, col4, col5, col6 = st.columns(6)
    
    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">Total Records</div>
            <div class="metric-value">{kpis['total_records']:,}</div>
            <div class="metric-caption">Readings logged</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col2:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">Cities</div>
            <div class="metric-value">{kpis['city_count']}</div>
            <div class="metric-caption">Monitoring locations</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col3:
        avg_aqi_info = classify_aqi_value(int(kpis['avg_aqi']), standard=standard_code)
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">Average AQI</div>
            <div class="metric-value" style="color: {avg_aqi_info['color']}">{kpis['avg_aqi']}</div>
            <div class="metric-caption">{avg_aqi_info['category']}</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col4:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">Peak AQI</div>
            <div class="metric-value" style="color: #ef4444">{kpis['max_aqi']}</div>
            <div class="metric-caption">{kpis['max_aqi_city']} ({kpis['max_aqi_date']})</div>
        </div>
        """, unsafe_allow_html=True)

    with col5:
        pm25_str = f"{kpis['avg_pm25']} µg/m³" if kpis['avg_pm25'] is not None else "N/A"
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">Avg PM2.5</div>
            <div class="metric-value">{pm25_str}</div>
            <div class="metric-caption">Fine particulates</div>
        </div>
        """, unsafe_allow_html=True)

    with col6:
        pm10_str = f"{kpis['avg_pm10']} µg/m³" if kpis['avg_pm10'] is not None else "N/A"
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">Avg PM10</div>
            <div class="metric-value">{pm10_str}</div>
            <div class="metric-caption">Coarse particulates</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    # Visualizations Row: City Averages and Category Distribution
    vcol1, vcol2 = st.columns([3, 2])
    
    with vcol1:
        st.subheader("City-wise Average AQI")
        city_avg_df = filtered_df.groupby("city")["aqi"].mean().reset_index()
        city_avg_df["aqi"] = city_avg_df["aqi"].round(1)
        city_avg_df = city_avg_df.sort_values(by="aqi", ascending=True)

        fig_city = px.bar(
            city_avg_df,
            x="aqi",
            y="city",
            orientation="h",
            labels={"aqi": "Average AQI", "city": "City"},
            text="aqi",
            color="aqi",
            color_continuous_scale="RdYlGn_r"
        )
        fig_city.update_layout(
            height=340,
            margin=dict(l=10, r=10, t=10, b=10),
            coloraxis_showscale=False
        )
        fig_city.update_traces(textposition="outside")
        st.plotly_chart(fig_city, use_container_width=True)

    with vcol2:
        st.subheader(f"AQI Categories ({aqi_standard})")
        cat_result = compute_category_distribution(filtered_df, standard=standard_code)
        dist_df = cat_result["distribution"]
        
        # Donut Chart for Categories
        fig_donut = go.Figure(data=[go.Pie(
            labels=dist_df["Category"],
            values=dist_df["Records"],
            hole=0.55,
            marker=dict(colors=dist_df["Color"]),
            textinfo="percent+label",
            hoverinfo="label+value+percent"
        )])
        fig_donut.update_layout(
            height=340,
            margin=dict(l=10, r=10, t=10, b=10),
            showlegend=False
        )
        st.plotly_chart(fig_donut, use_container_width=True)

    # Time-series Trend Row
    st.subheader("Historical AQI Trend Over Time")
    trend_data = compute_pollution_trends(filtered_df)
    daily_trend = trend_data["daily"]

    if not daily_trend.empty:
        fig_trend = px.line(
            daily_trend,
            x="record_date",
            y="avg_aqi",
            labels={"record_date": "Date", "avg_aqi": "Average Daily AQI"},
            markers=True,
            line_shape="spline"
        )
        fig_trend.update_traces(line_color="#0284c7", marker=dict(size=6, color="#0369a1"))
        fig_trend.update_layout(
            height=320,
            margin=dict(l=10, r=10, t=10, b=10),
            xaxis_title="",
            yaxis_title="Network Average AQI"
        )
        st.plotly_chart(fig_trend, use_container_width=True)
    else:
        st.info("Insufficient dates for trend visualization.")

    # Data-Driven Key Findings Summary
    st.markdown("### 📋 Key Findings Summary")
    
    cleanest_city = city_avg_df.iloc[0]["city"] if not city_avg_df.empty else "N/A"
    cleanest_aqi = city_avg_df.iloc[0]["aqi"] if not city_avg_df.empty else 0
    polluted_city = city_avg_df.iloc[-1]["city"] if not city_avg_df.empty else "N/A"
    polluted_aqi = city_avg_df.iloc[-1]["aqi"] if not city_avg_df.empty else 0

    st.markdown(f"""
    - **Cleanest Monitored City**: **{cleanest_city}** maintained the lowest average AQI of **{cleanest_aqi}**.
    - **Most Polluted City**: **{polluted_city}** recorded the highest average AQI of **{polluted_aqi}**.
    - **Peak Episodic Event**: The worst single event reached an AQI of **{kpis['max_aqi']}** in **{kpis['max_aqi_city']}** on **{kpis['max_aqi_date']}**.
    - **Pollutant Composition**: Across all recorded stations, the ratio of fine particulate (PM2.5) to coarse particulate (PM10) is approximately **{round((kpis['avg_pm25'] / kpis['avg_pm10']), 2) if kpis['avg_pm25'] and kpis['avg_pm10'] else 'N/A'}**, reflecting significant combustion and vehicular emissions.
    """)


# ==============================================================================
# SECTION B: CITY COMPARISON
# ==============================================================================
elif nav_selection == "City Comparison":
    st.markdown('<div class="main-header">City-to-City Pollution Comparison</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Direct cross-city benchmarks for AQI, particulate concentrations, and stability</div>', unsafe_allow_html=True)

    comp_cities = st.multiselect(
        "Select Cities to Compare",
        options=all_cities,
        default=all_cities[:min(4, len(all_cities))],
        help="Select at least two cities for comparative visualization."
    )

    if len(comp_cities) < 2:
        st.warning("Please select at least 2 cities to view comparative charts.")
        st.stop()

    comp_df = compute_city_comparison(filtered_df, comp_cities)

    if comp_df.empty:
        st.warning("No records found for the selected cities in the current date range.")
        st.stop()

    # Comparison metrics table
    st.subheader("Comparative Summary Table")
    st.dataframe(
        comp_df.rename(columns={
            "city": "City",
            "record_count": "Records",
            "avg_aqi": "Average AQI",
            "min_aqi": "Min AQI",
            "max_aqi": "Max AQI",
            "std_aqi": "Std Dev (Volatility)",
            "avg_pm25": "Avg PM2.5 (µg/m³)",
            "avg_pm10": "Avg PM10 (µg/m³)"
        }),
        use_container_width=True,
        hide_index=True
    )

    # Bar chart comparisons: AQI vs PM2.5 vs PM10
    col_c1, col_c2 = st.columns(2)
    
    with col_c1:
        st.subheader("Average AQI Comparison")
        fig_comp_aqi = px.bar(
            comp_df,
            x="city",
            y="avg_aqi",
            color="avg_aqi",
            text="avg_aqi",
            labels={"avg_aqi": "Average AQI", "city": "City"},
            color_continuous_scale="OrRd"
        )
        fig_comp_aqi.update_layout(height=320, coloraxis_showscale=False)
        fig_comp_aqi.update_traces(textposition="outside")
        st.plotly_chart(fig_comp_aqi, use_container_width=True)

    with col_c2:
        st.subheader("Particulate Matter (PM2.5 & PM10)")
        pm_comp_data = comp_df.melt(
            id_vars=["city"],
            value_vars=["avg_pm25", "avg_pm10"],
            var_name="Pollutant",
            value_name="Concentration"
        )
        pm_comp_data["Pollutant"] = pm_comp_data["Pollutant"].map({
            "avg_pm25": "PM2.5 (Fine)",
            "avg_pm10": "PM10 (Coarse)"
        })
        fig_pm = px.bar(
            pm_comp_data,
            x="city",
            y="Concentration",
            color="Pollutant",
            barmode="group",
            labels={"Concentration": "Concentration (µg/m³)", "city": "City"}
        )
        fig_pm.update_layout(height=320)
        st.plotly_chart(fig_pm, use_container_width=True)

    # Comparative Time-Series Trend Line
    st.subheader("Comparative AQI Timeline")
    comp_time_df = filtered_df[filtered_df["city"].isin(comp_cities)].sort_values(by="record_date")
    
    if not comp_time_df.empty:
        fig_comp_time = px.line(
            comp_time_df,
            x="record_date",
            y="aqi",
            color="city",
            labels={"record_date": "Date", "aqi": "AQI", "city": "City"},
            markers=True
        )
        fig_comp_time.update_layout(height=360, yaxis_title="Recorded AQI", xaxis_title="")
        st.plotly_chart(fig_comp_time, use_container_width=True)


# ==============================================================================
# SECTION C: POLLUTION TRENDS
# ==============================================================================
elif nav_selection == "Pollution Trends":
    st.markdown('<div class="main-header">Pollution Trends & Temporal Patterns</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Temporal patterns across daily readings, monthly aggregates, and peak episodes</div>', unsafe_allow_html=True)

    trends = compute_pollution_trends(filtered_df)
    daily_df = trends["daily"]
    monthly_df = trends["monthly"]

    if daily_df.empty:
        st.warning("Insufficient data available for trend calculation.")
        st.stop()

    tab_daily, tab_monthly, tab_peaks = st.tabs(["Daily AQI & Pollutants", "Monthly Averages", "Peak Pollution Periods"])

    with tab_daily:
        st.subheader("Daily Average Trajectory")
        fig_daily = px.line(
            daily_df,
            x="record_date",
            y="avg_aqi",
            labels={"record_date": "Date", "avg_aqi": "Daily Avg AQI"},
            title="Daily Average AQI Across Monitored Stations",
            markers=True
        )
        fig_daily.update_traces(line_color="#2563eb")
        st.plotly_chart(fig_daily, use_container_width=True)

        # Particulate progression
        if daily_df["avg_pm25"].notna().any() and daily_df["avg_pm10"].notna().any():
            st.subheader("Daily Particulate Matter Progression")
            fig_pm_daily = go.Figure()
            fig_pm_daily.add_trace(go.Scatter(
                x=daily_df["record_date"], y=daily_df["avg_pm25"],
                mode='lines+markers', name='PM2.5 (Fine)', line=dict(color='#d97706')
            ))
            fig_pm_daily.add_trace(go.Scatter(
                x=daily_df["record_date"], y=daily_df["avg_pm10"],
                mode='lines+markers', name='PM10 (Coarse)', line=dict(color='#475569')
            ))
            fig_pm_daily.update_layout(
                yaxis_title="Concentration (µg/m³)",
                height=320,
                margin=dict(l=10, r=10, t=30, b=10)
            )
            st.plotly_chart(fig_pm_daily, use_container_width=True)

    with tab_monthly:
        st.subheader("Monthly AQI Aggregates")
        if not monthly_df.empty:
            fig_monthly = px.bar(
                monthly_df,
                x="year_month",
                y="avg_aqi",
                text="avg_aqi",
                labels={"year_month": "Month (YYYY-MM)", "avg_aqi": "Monthly Avg AQI"},
                color="avg_aqi",
                color_continuous_scale="Reds"
            )
            fig_monthly.update_layout(height=340, coloraxis_showscale=False)
            fig_monthly.update_traces(textposition="outside")
            st.plotly_chart(fig_monthly, use_container_width=True)
            
            st.dataframe(monthly_df.rename(columns={
                "year_month": "Month",
                "avg_aqi": "Avg AQI",
                "avg_pm25": "Avg PM2.5",
                "avg_pm10": "Avg PM10",
                "record_count": "Stations Reporting"
            }), use_container_width=True, hide_index=True)
        else:
            st.info("Monthly aggregation requires records spanning multiple months.")

    with tab_peaks:
        st.subheader("Top 10 Peak Pollution Episodes")
        peak_records = filtered_df.sort_values(by="aqi", ascending=False).head(10)
        
        # Add category
        peak_records_classified = add_aqi_category_column(peak_records, standard=standard_code)
        st.dataframe(
            peak_records_classified[[
                "city", "record_date", "aqi", "aqi_category", "pm25", "pm10"
            ]].rename(columns={
                "city": "City",
                "record_date": "Date",
                "aqi": "AQI",
                "aqi_category": "Category",
                "pm25": "PM2.5 (µg/m³)",
                "pm10": "PM10 (µg/m³)"
            }),
            use_container_width=True,
            hide_index=True
        )


# ==============================================================================
# SECTION D: AQI CATEGORY ANALYSIS
# ==============================================================================
elif nav_selection == "AQI Category Analysis":
    st.markdown('<div class="main-header">Air Quality Index Category Classification</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="sub-header">Breakdown under standard: <strong>{aqi_standard}</strong></div>', unsafe_allow_html=True)

    st.markdown("""
    <div class="info-banner">
        <strong>Standard Documentation Note:</strong> Categories below are calculated directly from standard numerical breakpoints 
        (e.g., India CPCB breakpoints for Indian conditions). They represent mathematical classifications based on uploaded readings, 
        distinct from official certified agency badges.
    </div>
    """, unsafe_allow_html=True)

    cat_result = compute_category_distribution(filtered_df, standard=standard_code)
    dist_df = cat_result["distribution"]
    severe_cities_df = cat_result["severe_cities"]

    col_d1, col_d2 = st.columns([3, 2])
    
    with col_d1:
        st.subheader("Category Distribution Breakdown")
        st.dataframe(
            dist_df[["Category", "Records", "Percentage"]],
            use_container_width=True,
            hide_index=True
        )

        fig_cat_bar = px.bar(
            dist_df,
            x="Category",
            y="Records",
            text="Percentage",
            color="Category",
            color_discrete_map={row["Category"]: row["Color"] for _, row in dist_df.iterrows()}
        )
        fig_cat_bar.update_layout(
            height=300,
            showlegend=False,
            yaxis_title="Record Count",
            xaxis_title=""
        )
        fig_cat_bar.update_traces(texttemplate="%{text}%", textposition="outside")
        st.plotly_chart(fig_cat_bar, use_container_width=True)

    with col_d2:
        st.subheader(f"Cities with Highest {cat_result['threshold_label']}")
        st.dataframe(
            severe_cities_df.rename(columns={
                "city": "City",
                "total_records": "Total Records",
                "high_pollution_count": "Severe/Poor Records",
                "pct_high_pollution": "Severe Ratio (%)"
            }),
            use_container_width=True,
            hide_index=True
        )

    # Standard Breakpoints Reference Table
    st.markdown("### Standard Breakpoints Reference Table")
    ref_list = CPCB_CATEGORIES if standard_code == "CPCB" else US_EPA_CATEGORIES
    ref_df = pd.DataFrame([
        {
            "Category": c["label"],
            "AQI Range": f"{c['min']} - {c['max'] if c['max'] < 1000 else '400+'}",
            "Health Advisory": c["description"]
        } for c in ref_list
    ])
    st.table(ref_df)


# ==============================================================================
# SECTION E: DATA EXPLORER & UPLOAD
# ==============================================================================
elif nav_selection == "Data Explorer & Upload":
    st.markdown('<div class="main-header">Data Explorer & CSV Ingestion Pipeline</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Search, filter, audit, upload new datasets, and import directly into MySQL</div>', unsafe_allow_html=True)

    exp_tab1, exp_tab2 = st.tabs(["Search & Filter Records", "Upload & Clean New CSV"])

    with exp_tab1:
        # Search & Filter bar
        col_f1, col_f2, col_f3 = st.columns([2, 1, 1])
        with col_f1:
            search_query = st.text_input("Search by city name", "")
        with col_f2:
            min_aqi_filter = st.number_input("Min AQI", min_value=0, max_value=2000, value=0)
        with col_f3:
            max_aqi_filter = st.number_input("Max AQI", min_value=0, max_value=2000, value=2000)

        explorer_df = filtered_df.copy()
        if search_query:
            explorer_df = explorer_df[explorer_df["city"].str.contains(search_query, case=False, na=False)]
        explorer_df = explorer_df[(explorer_df["aqi"] >= min_aqi_filter) & (explorer_df["aqi"] <= max_aqi_filter)]

        st.caption(f"Showing {len(explorer_df)} records matching criteria")
        
        # Display table
        st.dataframe(
            explorer_df.sort_values(by="aqi", ascending=False),
            use_container_width=True,
            hide_index=True
        )

        # Download CSV
        csv_buffer = BytesIO()
        explorer_df.to_csv(csv_buffer, index=False)
        st.download_button(
            label="📥 Download Filtered Records as CSV",
            data=csv_buffer.getvalue(),
            file_name="filtered_air_quality_records.csv",
            mime="text/csv"
        )

        # Missing values & dataset health statistics
        st.markdown("### Dataset Health & Missing Values")
        health_col1, health_col2, health_col3 = st.columns(3)
        with health_col1:
            st.metric("Total Records", len(explorer_df))
        with health_col2:
            missing_pm25 = int(explorer_df["pm25"].isna().sum())
            st.metric("Missing PM2.5", f"{missing_pm25} ({round(missing_pm25/len(explorer_df)*100, 1) if len(explorer_df)>0 else 0}%)")
        with health_col3:
            missing_pm10 = int(explorer_df["pm10"].isna().sum())
            st.metric("Missing PM10", f"{missing_pm10} ({round(missing_pm10/len(explorer_df)*100, 1) if len(explorer_df)>0 else 0}%)")

    with exp_tab2:
        st.subheader("Upload Custom Air Quality CSV")
        st.markdown("""
        Upload your own CSV dataset. Required columns: `City`, `Date`, `AQI`. 
        Optional columns: `PM2.5` (or `PM25`), `PM10`.
        """)
        
        uploaded_file = st.file_uploader("Choose a CSV file", type=["csv"])
        if uploaded_file is not None:
            try:
                raw_uploaded_df = pd.read_csv(uploaded_file)
                st.write("**Raw Data Preview (First 5 Rows):**")
                st.dataframe(raw_uploaded_df.head(), use_container_width=True)

                cleaned_df, audit_rep = validate_and_clean_dataset(raw_uploaded_df)

                st.markdown("### Validation & Ingestion Audit Report")
                st.write(f"- Initial Rows: **{audit_rep['initial_row_count']}**")
                st.write(f"- Valid Clean Rows: **{audit_rep['valid_row_count']}**")
                st.write(f"- Dropped / Invalid Rows: **{audit_rep['dropped_rows']}**")
                
                if audit_rep["warnings"]:
                    with st.expander("View Warnings & Sanitization Notes"):
                        for warn in audit_rep["warnings"]:
                            st.caption(f"⚠️ {warn}")

                if audit_rep["errors"]:
                    for err in audit_rep["errors"]:
                        st.error(f"❌ {err}")
                else:
                    st.success("✅ Dataset passed validation!")
                    
                    btn_col1, btn_col2 = st.columns(2)
                    with btn_col1:
                        if st.button("Use Cleaned Dataset in Dashboard Session"):
                            st.session_state["custom_dataset"] = cleaned_df
                            st.success("Custom dataset activated for current session!")
                            st.rerun()

                    with btn_col2:
                        if st.button("Import Validated Records to MySQL"):
                            with st.spinner("Importing into MySQL table 'air_quality_records'..."):
                                inserted, failed, msg = db.import_records_to_db(cleaned_df)
                                if failed == 0:
                                    st.success(f"✅ {msg}")
                                else:
                                    st.error(f"❌ {msg}")
            except Exception as e:
                st.error(f"Failed to read CSV: {str(e)}")


# ==============================================================================
# SECTION F: SQL QUERIES LAB
# ==============================================================================
elif nav_selection == "SQL Queries Lab":
    st.markdown('<div class="main-header">SQL Analysis & Query Execution Lab</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Execute and inspect the 15 portfolio SQL queries against the active data</div>', unsafe_allow_html=True)

    queries_catalog = [
        {"id": 1, "title": "Display All Air-Quality Records", "desc": "Chronological projection of all telemetry entries.", "sql": "SELECT id, city, record_date, aqi, pm25, pm10 FROM air_quality_records ORDER BY record_date DESC, city ASC;"},
        {"id": 2, "title": "Find the Highest AQI Reading", "desc": "Subquery to find the peak severe pollution record.", "sql": "SELECT city, record_date, aqi, pm25, pm10 FROM air_quality_records WHERE aqi = (SELECT MAX(aqi) FROM air_quality_records);"},
        {"id": 3, "title": "Calculate Average AQI by City", "desc": "GROUP BY aggregation with AVG() and ROUND().", "sql": "SELECT city, ROUND(AVG(aqi), 2) AS avg_aqi, MIN(aqi) AS min_aqi, MAX(aqi) AS max_aqi, COUNT(*) AS total_records FROM air_quality_records GROUP BY city ORDER BY avg_aqi DESC;"},
        {"id": 4, "title": "Cities with Average AQI > 150", "desc": "HAVING clause filtering on aggregate calculations.", "sql": "SELECT city, ROUND(AVG(aqi), 2) AS avg_aqi, COUNT(*) AS sample_size FROM air_quality_records GROUP BY city HAVING AVG(aqi) > 150 ORDER BY avg_aqi DESC;"},
        {"id": 5, "title": "Calculate Average PM2.5 by City", "desc": "Aggregation of fine particulate matter ignoring NULLs.", "sql": "SELECT city, ROUND(AVG(pm25), 2) AS avg_pm25, MIN(pm25) AS min_pm25, MAX(pm25) AS max_pm25, COUNT(pm25) AS valid_readings FROM air_quality_records GROUP BY city ORDER BY avg_pm25 DESC;"},
        {"id": 6, "title": "Calculate Average PM10 by City", "desc": "Aggregation of coarse particulate matter.", "sql": "SELECT city, ROUND(AVG(pm10), 2) AS avg_pm10, MIN(pm10) AS min_pm10, MAX(pm10) AS max_pm10, COUNT(pm10) AS valid_readings FROM air_quality_records GROUP BY city ORDER BY avg_pm10 DESC;"},
        {"id": 7, "title": "Count Records by AQI Category", "desc": "Conditional aggregation using CASE WHEN expressions.", "sql": "SELECT CASE WHEN aqi BETWEEN 0 AND 50 THEN 'Good' WHEN aqi BETWEEN 51 AND 100 THEN 'Satisfactory' WHEN aqi BETWEEN 101 AND 200 THEN 'Moderate' WHEN aqi BETWEEN 201 AND 300 THEN 'Poor' WHEN aqi BETWEEN 301 AND 400 THEN 'Very Poor' ELSE 'Severe' END AS aqi_category, COUNT(*) AS record_count FROM air_quality_records GROUP BY aqi_category;"},
        {"id": 8, "title": "Top 10 Most Polluted Recorded Dates", "desc": "Network-wide daily average severity.", "sql": "SELECT record_date, ROUND(AVG(aqi), 2) AS network_avg_aqi, MAX(aqi) AS highest_aqi, COUNT(DISTINCT city) AS reporting_cities FROM air_quality_records GROUP BY record_date ORDER BY network_avg_aqi DESC LIMIT 10;"},
        {"id": 9, "title": "Daily Average AQI Trends", "desc": "Time series daily aggregation.", "sql": "SELECT record_date, ROUND(AVG(aqi), 2) AS avg_aqi, ROUND(AVG(pm25), 2) AS avg_pm25, ROUND(AVG(pm10), 2) AS avg_pm10, COUNT(*) AS records FROM air_quality_records GROUP BY record_date ORDER BY record_date ASC;"},
        {"id": 10, "title": "Monthly Average AQI Trends", "desc": "Monthly date aggregation using DATE_FORMAT.", "sql": "SELECT DATE_FORMAT(record_date, '%Y-%m') AS year_month, ROUND(AVG(aqi), 2) AS monthly_avg_aqi, ROUND(AVG(pm25), 2) AS monthly_avg_pm25, ROUND(AVG(pm10), 2) AS monthly_avg_pm10, COUNT(*) AS readings FROM air_quality_records GROUP BY year_month ORDER BY year_month ASC;"},
        {"id": 11, "title": "Compare Pollutant Levels & PM2.5/PM10 Ratio", "desc": "Multi-metric comparison with ratio calculation.", "sql": "SELECT city, ROUND(AVG(aqi), 1) AS avg_aqi, ROUND(AVG(pm25), 1) AS avg_pm25, ROUND(AVG(pm10), 1) AS avg_pm10, ROUND(AVG(pm25) / NULLIF(AVG(pm10), 0), 2) AS pm25_to_pm10_ratio FROM air_quality_records GROUP BY city ORDER BY avg_aqi DESC;"},
        {"id": 12, "title": "Records Exceeding AQI > 200 (Poor+)", "desc": "Filtering extreme pollution events.", "sql": "SELECT city, record_date, aqi, pm25, pm10 FROM air_quality_records WHERE aqi > 200 ORDER BY aqi DESC;"},
        {"id": 13, "title": "Rank Cities by Average AQI (Window Function)", "desc": "Modern SQL DENSE_RANK() OVER (ORDER BY ...)", "sql": "SELECT DENSE_RANK() OVER (ORDER BY AVG(aqi) DESC) AS pollution_rank, city, ROUND(AVG(aqi), 2) AS avg_aqi, COUNT(*) AS readings FROM air_quality_records GROUP BY city ORDER BY pollution_rank ASC;"},
        {"id": 14, "title": "Percentage of Records > 200 AQI per City", "desc": "Conditional percentage calculation.", "sql": "SELECT city, COUNT(*) AS total_records, SUM(CASE WHEN aqi > 200 THEN 1 ELSE 0 END) AS poor_or_worse_records, ROUND(SUM(CASE WHEN aqi > 200 THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 2) AS pct_poor_or_worse FROM air_quality_records GROUP BY city ORDER BY pct_poor_or_worse DESC;"},
        {"id": 15, "title": "Cities with Greatest AQI Variation", "desc": "Standard deviation and range variation.", "sql": "SELECT city, ROUND(STDDEV(aqi), 2) AS aqi_standard_deviation, (MAX(aqi) - MIN(aqi)) AS aqi_range, MIN(aqi) AS cleanest, MAX(aqi) AS dirtiest FROM air_quality_records GROUP BY city ORDER BY aqi_standard_deviation DESC;"}
    ]

    selected_query_title = st.selectbox(
        "Select a SQL Query to Inspect",
        options=[f"Query {q['id']}: {q['title']}" for q in queries_catalog]
    )

    query_idx = int(selected_query_title.split(":")[0].replace("Query", "").strip()) - 1
    current_q = queries_catalog[query_idx]

    st.markdown(f"**Description:** {current_q['desc']}")
    st.code(current_q["sql"], language="sql")

    if st.button("Run Query Against MySQL"):
        with st.spinner("Executing SQL query on MySQL..."):
            res_df, err = db.execute_sql_query(current_q["sql"])
            if err:
                st.error(f"Execution Error: {err}")
                st.info("Tip: Ensure your MySQL server is running and database schema is initialized.")
            else:
                st.success(f"Query returned {len(res_df)} row(s).")
                st.dataframe(res_df, use_container_width=True)
