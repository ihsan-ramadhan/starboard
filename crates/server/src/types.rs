use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionUser {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    #[serde(rename = "deptColor")]
    pub dept_color: Option<String>,

    #[serde(rename = "accessLevel")]
    pub access_level: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DatasetRegistry {
    pub id: String,
    pub dept: String,
    pub key: String,
    #[serde(rename = "tableName")]
    pub table_name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub description: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "sourcePath")]
    pub source_path: Option<String>,
    #[serde(rename = "syncEnabled")]
    pub sync_enabled: bool,
    #[serde(rename = "lastSyncedAt")]
    pub last_synced_at: Option<String>,
    #[serde(rename = "lastSyncedMtime")]
    pub last_synced_mtime: Option<String>,

    #[serde(rename = "watchedBy")]
    pub watched_by: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DatasetColumn {
    pub id: String,
    pub name: String,
    pub label: Option<String>,
    pub r#type: String,
    #[serde(rename = "isDimension")]
    pub is_dimension: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DatasetDetail {
    pub dataset: DatasetRegistry,
    pub columns: Vec<DatasetColumn>,
    #[serde(rename = "totalRows")]
    pub total_rows: i64,
    #[serde(rename = "sampleRows")]
    pub sample_rows: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ColumnSchema {
    #[serde(rename = "colIndex")]
    pub col_index: usize,
    #[serde(rename = "rawName")]
    pub raw_name: String,
    pub slug: String,
    pub r#type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DetectedSheet {
    #[serde(rename = "sheetName")]
    pub sheet_name: String,
    #[serde(rename = "headerRowIndex")]
    pub header_row_index: usize,
    #[serde(rename = "dataStartRowIndex")]
    pub data_start_row_index: usize,
    pub columns: Vec<ColumnSchema>,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    pub fingerprint: String,
    #[serde(rename = "suggestedKey")]
    pub suggested_key: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WidgetFilter {
    pub column: String,
    pub op: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WidgetQueryRequest {
    #[serde(rename = "datasetId")]
    pub dataset_id: String,
    pub metric: String,
    #[serde(rename = "metricColumn")]
    pub metric_column: Option<String>,
    #[serde(rename = "metricColumns")]
    pub metric_columns: Option<Vec<String>>,
    #[serde(rename = "groupByColumn")]
    pub group_by_column: Option<String>,
    #[serde(rename = "seriesColumn")]
    pub series_column: Option<String>,
    pub limit: Option<i64>,
    #[serde(rename = "orderByKey")]
    pub order_by_key: Option<bool>,
    pub filters: Option<Vec<WidgetFilter>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WidgetQueryResult {
    #[serde(rename = "scalarValue")]
    pub scalar_value: Option<f64>,
    #[serde(rename = "scalarText")]
    pub scalar_text: Option<String>,
    pub rows: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RowsQueryRequest {
    #[serde(rename = "datasetId")]
    pub dataset_id: String,
    pub columns: Option<Vec<String>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    #[serde(rename = "sortColumn")]
    pub sort_column: Option<String>,
    #[serde(rename = "sortDir")]
    pub sort_dir: Option<String>,
    pub filters: Option<Vec<WidgetFilter>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RowsQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub total: i64,
}
