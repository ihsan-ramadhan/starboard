use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionUser {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    #[serde(rename = "deptColor")]
    pub dept_color: Option<String>,
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
    #[serde(rename = "createdAt")]
    pub created_at: String,
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
pub struct WidgetQueryRequest {
    #[serde(rename = "datasetId")]
    pub dataset_id: String,
    pub metric: String,
    #[serde(rename = "metricColumn")]
    pub metric_column: Option<String>,
    #[serde(rename = "groupByColumn")]
    pub group_by_column: Option<String>,
    pub limit: Option<i64>,
    #[serde(rename = "orderByKey")]
    pub order_by_key: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WidgetQueryResult {
    #[serde(rename = "scalarValue")]
    pub scalar_value: Option<f64>,
    pub rows: Vec<serde_json::Value>,
}
