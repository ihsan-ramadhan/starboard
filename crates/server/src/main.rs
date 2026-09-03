mod types;
mod excel;
mod analytics;
mod auth;

use axum::{
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{Method, StatusCode},
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use deadpool_postgres::{Config, ManagerConfig, Pool, RecyclingMethod, Runtime};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio_postgres::NoTls;
use tower_http::cors::CorsLayer;

use crate::analytics::execute_widget_query;
use crate::excel::{execute_import, parse_and_analyze_sheets};
use crate::types::{
    DatasetColumn, DatasetDetail, DatasetRegistry, DetectedSheet, SessionUser,
    WidgetQueryRequest, WidgetQueryResult,
};

#[derive(Clone)]
struct AppState {
    pool: Pool,
}

#[derive(Deserialize)]
struct LoginRequest {
    identifier: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    #[serde(rename = "user")]
    user: SessionUser,
    token: String,
}

#[derive(Deserialize)]
struct DeptQuery {
    dept: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct WidgetLayout {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

#[derive(Serialize, Deserialize, Clone)]
struct WidgetPayload {
    id: String,
    r#type: String,
    title: String,
    #[serde(rename = "datasetId", default)]
    dataset_id: String,
    metric: String,
    #[serde(rename = "metricColumn", default)]
    metric_column: Option<String>,
    #[serde(rename = "groupByColumn", default)]
    group_by_column: Option<String>,
    #[serde(default)]
    limit: Option<i32>,
    #[serde(rename = "isCurrency", default)]
    is_currency: Option<bool>,
    #[serde(default)]
    unit: Option<String>,
    #[serde(default)]
    layout: WidgetLayout,
}

#[derive(Deserialize)]
struct AnalyzeRequest {
    #[serde(rename = "fileBytes")]
    file_bytes: Vec<u8>,
    #[serde(rename = "datasetKey", default)]
    dataset_key: Option<String>,
}

#[derive(Deserialize)]
struct ImportRequest {
    dept: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "baseKey")]
    base_key: String,
    #[serde(rename = "fileBytes")]
    file_bytes: Vec<u8>,
    #[serde(rename = "selectedSheets")]
    selected_sheets: Vec<String>,
    #[serde(rename = "selectedColumns")]
    selected_columns: HashMap<String, Vec<String>>,
}

#[derive(Serialize)]
struct ImportResponse {
    #[serde(rename = "primaryKey")]
    primary_key: String,
    #[serde(rename = "totalImported")]
    total_imported: usize,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    let _ = dotenvy::from_path(".env");
    let _ = dotenvy::from_path("../.env");

    let database_url = match env::var("DATABASE_URL") {
        Ok(val) => val,
        Err(_) => {
            eprintln!("[ERROR] DATABASE_URL tidak ditemukan di environment atau file .env!");
            std::process::exit(1);
        }
    };

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    let mut cfg = Config::new();
    cfg.url = Some(database_url.clone());
    cfg.manager = Some(ManagerConfig {
        recycling_method: RecyclingMethod::Fast,
    });

    let pool = match cfg.create_pool(Some(Runtime::Tokio1), NoTls) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[ERROR] Gagal membuat database pool: {}", e);
            std::process::exit(1);
        }
    };

    let state = Arc::new(AppState { pool });

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    let protected = Router::new()
        .route("/api/auth/logout", post(logout_handler))
        .route("/api/datasets", get(get_datasets_handler))
        .route("/api/datasets/{key}",
            get(get_dataset_detail_handler).delete(delete_dataset_handler),
        )
        .route(
            "/api/datasets/{key}/widgets",
            get(get_widgets_handler).put(save_widgets_handler),
        )
        .route("/api/excel/analyze", post(analyze_excel_handler))
        .route("/api/excel/import", post(import_excel_handler))
        .route("/api/analytics/query", post(query_widget_data_handler))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ));

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/login", post(login_handler))
        .merge(protected)
        .layer(cors)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!(">>> Starboard Backend running on http://{}", addr);

    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[ERROR] Server runtime error: {}", e);
            }
        }
        Err(e) => {
            eprintln!("[ERROR] Gagal bind ke port {}: {}", port, e);
            std::process::exit(1);
        }
    }
}

async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        service: "starboard-backend",
    })
}

async fn login_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    let client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    let row = client
        .query_opt(
            r#"
            SELECT u.id, u.username, u.email, u."passwordHash", u.role, d.color as dept_color
            FROM users u
            LEFT JOIN departments d ON d.code = u.role
            WHERE lower(u.email) = lower($1) OR lower(u.username) = lower($1)
            LIMIT 1
            "#,
            &[&payload.identifier],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Akun atau kata sandi tidak valid.".to_string(),
            ))
        }
    };

    let password_hash: String = row.get(3);
    let is_valid = bcrypt::verify(&payload.password, &password_hash).unwrap_or(false);
    if !is_valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Akun atau kata sandi tidak valid.".to_string(),
        ));
    }

    let user = SessionUser {
        id: row.get(0),
        username: row.get(1),
        email: row.get(2),
        role: row.get(4),
        dept_color: row.get(5),
    };

    let session_id = uuid::Uuid::new_v4().to_string();
    let token = auth::create_token();
    let expires: chrono::NaiveDateTime =
        chrono::Utc::now().naive_utc() + chrono::Duration::days(7);

    client
        .execute(
            r#"INSERT INTO sessions (id, "userId", token, "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, now())"#,
            &[&session_id, &user.id, &token, &expires],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Session insert error: {}", e)))?;

    Ok(Json(LoginResponse { user, token }))
}

async fn logout_handler(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Result<Json<bool>, (StatusCode, String)> {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    if let Some(t) = token {
        let client = state
            .pool
            .get()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;
        client
            .execute(r#"DELETE FROM sessions WHERE token = $1"#, &[&t])
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Logout error: {}", e)))?;
    }

    Ok(Json(true))
}

async fn get_datasets_handler(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DeptQuery>,
) -> Result<Json<Vec<DatasetRegistry>>, (StatusCode, String)> {
    let client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    let rows = client
        .query(
            r#"
            SELECT id, dept, key, "tableName", "displayName", "createdAt"::text
            FROM dataset_registry
            WHERE dept = $1
            ORDER BY "createdAt" DESC
            "#,
            &[&query.dept],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Query error: {}", e)))?;

    let mut datasets = Vec::new();
    for r in rows {
        datasets.push(DatasetRegistry {
            id: r.get(0),
            dept: r.get(1),
            key: r.get(2),
            table_name: r.get(3),
            display_name: r.get(4),
            created_at: r.get(5),
        });
    }

    Ok(Json(datasets))
}

async fn get_dataset_detail_handler(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
    Query(query): Query<DeptQuery>,
) -> Result<Json<DatasetDetail>, (StatusCode, String)> {
    let client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    let ds_row = client
        .query_opt(
            r#"
            SELECT id, dept, key, "tableName", "displayName", "createdAt"::text
            FROM dataset_registry
            WHERE dept = $1 AND key = $2
            LIMIT 1
            "#,
            &[&query.dept, &key],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Fetch dataset error: {}", e)))?;

    let dataset = match ds_row {
        Some(r) => DatasetRegistry {
            id: r.get(0),
            dept: r.get(1),
            key: r.get(2),
            table_name: r.get(3),
            display_name: r.get(4),
            created_at: r.get(5),
        },
        None => return Err((StatusCode::NOT_FOUND, "Dataset tidak ditemukan.".to_string())),
    };

    let col_rows = client
        .query(
            r#"
            SELECT dc.id, dc.name, dc.label, dc.type, dc."isDimension"
            FROM dataset_columns dc
            JOIN information_schema.columns isc
              ON isc.column_name = dc.name
             AND isc.table_name = $2
            WHERE dc."datasetId" = $1
            ORDER BY isc.ordinal_position ASC
            "#,
            &[&dataset.id, &dataset.table_name],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Fetch columns error: {}", e)))?;

    let mut columns = Vec::new();
    for r in col_rows {
        columns.push(DatasetColumn {
            id: r.get(0),
            name: r.get(1),
            label: r.get(2),
            r#type: r.get(3),
            is_dimension: r.get(4),
        });
    }

    let count_query = format!("SELECT count(*)::bigint FROM \"{}\"", dataset.table_name);
    let total_rows: i64 = match client.query_one(&count_query, &[]).await {
        Ok(r) => r.get(0),
        Err(_) => 0,
    };

    let sample_query = format!("SELECT * FROM \"{}\" LIMIT 15", dataset.table_name);
    let mut sample_rows = Vec::new();
    if let Ok(rows) = client.query(&sample_query, &[]).await {
        for row in rows {
            let mut map = serde_json::Map::new();
            for (idx, col) in row.columns().iter().enumerate() {
                let col_name = col.name();
                let val_json: serde_json::Value = if let Ok(val) = row.try_get::<_, String>(idx) {
                    serde_json::Value::String(val)
                } else if let Ok(val) = row.try_get::<_, i64>(idx) {
                    serde_json::Value::Number(val.into())
                } else if let Ok(val) = row.try_get::<_, f64>(idx) {
                    serde_json::Number::from_f64(val)
                        .map(serde_json::Value::Number)
                        .unwrap_or(serde_json::Value::Null)
                } else if let Ok(val) = row.try_get::<_, rust_decimal::Decimal>(idx) {
                    if let Ok(f) = val.to_string().parse::<f64>() {
                        serde_json::Number::from_f64(f)
                            .map(serde_json::Value::Number)
                            .unwrap_or(serde_json::Value::Null)
                    } else {
                        serde_json::Value::String(val.to_string())
                    }
                } else if let Ok(val) = row.try_get::<_, bool>(idx) {
                    serde_json::Value::Bool(val)
                } else {
                    serde_json::Value::Null
                };
                map.insert(col_name.to_string(), val_json);
            }
            sample_rows.push(serde_json::Value::Object(map));
        }
    }

    Ok(Json(DatasetDetail {
        dataset,
        columns,
        total_rows,
        sample_rows,
    }))
}

async fn delete_dataset_handler(
    State(state): State<Arc<AppState>>,
    auth: crate::auth::AuthUser,
    Path(dataset_id): Path<String>,
) -> Result<Json<bool>, (StatusCode, String)> {
    let mut client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    let tx = client
        .transaction()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Tx error: {}", e)))?;

    let ds_row = tx
        .query_opt(
            r#"SELECT "tableName", dept FROM dataset_registry WHERE id = $1"#,
            &[&dataset_id],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Fetch dataset error: {}", e)))?;

    let (table_name, dept) = match ds_row {
        Some(r) => (r.get::<_, String>(0), r.get::<_, String>(1)),
        None => return Err((StatusCode::NOT_FOUND, "Dataset tidak ditemukan.".to_string())),
    };

    if dept != auth.role {
        return Err((
            StatusCode::FORBIDDEN,
            "Anda tidak memiliki akses ke dataset departemen lain.".to_string(),
        ));
    }

    let drop_query = format!("DROP TABLE IF EXISTS \"{}\" CASCADE", table_name);
    tx.execute(&drop_query, &[])
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Drop table error: {}", e)))?;

    tx.execute(
        r#"DELETE FROM dataset_columns WHERE "datasetId" = $1"#,
        &[&dataset_id],
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Delete columns error: {}", e)))?;

    tx.execute(
        r#"DELETE FROM dashboard_widgets WHERE "datasetId" = $1"#,
        &[&dataset_id],
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Delete widgets error: {}", e)))?;

    tx.execute(
        r#"DELETE FROM dataset_registry WHERE id = $1"#,
        &[&dataset_id],
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Delete registry error: {}", e)))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Commit error: {}", e)))?;

    Ok(Json(true))
}

async fn get_widgets_handler(
    State(state): State<Arc<AppState>>,
    auth: crate::auth::AuthUser,
    Path(key): Path<String>,
    Query(query): Query<DeptQuery>,
) -> Result<Json<Vec<WidgetPayload>>, (StatusCode, String)> {
    let client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    if query.dept != auth.role {
        return Err((
            StatusCode::FORBIDDEN,
            "Anda tidak memiliki akses ke dataset departemen lain.".to_string(),
        ));
    }

    let ds_row = client
        .query_opt(
            r#"SELECT id FROM dataset_registry WHERE dept = $1 AND key = $2"#,
            &[&query.dept, &key],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Fetch dataset error: {}", e)))?;

    let dataset_id = match ds_row {
        Some(r) => r.get::<_, String>(0),
        None => return Err((StatusCode::NOT_FOUND, "Dataset tidak ditemukan.".to_string())),
    };

    let rows = client
        .query(
            r#"
            SELECT "filterConfig", "positionX", "positionY", width, height
            FROM dashboard_widgets
            WHERE "datasetId" = $1
            "#,
            &[&dataset_id],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Fetch widgets error: {}", e)))?;

    let mut widgets = Vec::new();
    for r in rows {
        let cfg: serde_json::Value = r.get(0);
        let mut w: WidgetPayload = match serde_json::from_value(cfg.clone()) {
            Ok(v) => v,
            Err(_) => continue,
        };
        w.dataset_id = dataset_id.clone();
        w.layout = WidgetLayout {
            x: r.get(1),
            y: r.get(2),
            w: r.get(3),
            h: r.get(4),
        };
        widgets.push(w);
    }

    Ok(Json(widgets))
}

async fn save_widgets_handler(
    State(state): State<Arc<AppState>>,
    auth: crate::auth::AuthUser,
    Path(key): Path<String>,
    Query(query): Query<DeptQuery>,
    Json(payload): Json<Vec<WidgetPayload>>,
) -> Result<Json<bool>, (StatusCode, String)> {
    if payload.len() > 50 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Jumlah widget melebihi batas maksimal (50).".to_string(),
        ));
    }

    let mut client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    if query.dept != auth.role {
        return Err((
            StatusCode::FORBIDDEN,
            "Anda tidak memiliki akses ke dataset departemen lain.".to_string(),
        ));
    }

    let ds_row = client
        .query_opt(
            r#"SELECT id FROM dataset_registry WHERE dept = $1 AND key = $2"#,
            &[&query.dept, &key],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Fetch dataset error: {}", e)))?;

    let dataset_id = match ds_row {
        Some(r) => r.get::<_, String>(0),
        None => return Err((StatusCode::NOT_FOUND, "Dataset tidak ditemukan.".to_string())),
    };

    let tx = client
        .transaction()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Tx error: {}", e)))?;

    tx.execute(
        r#"DELETE FROM dashboard_widgets WHERE "datasetId" = $1"#,
        &[&dataset_id],
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Delete widgets error: {}", e)))?;

    if !payload.is_empty() {
        let mut cfgs: Vec<serde_json::Value> = Vec::with_capacity(payload.len());
        for w in &payload {
            let cfg = serde_json::to_value(w).map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("Invalid widget payload: {}", e),
                )
            })?;
            cfgs.push(cfg);
        }

        let mut rows: Vec<Vec<&(dyn tokio_postgres::types::ToSql + Sync)>> = Vec::new();
        for (w, cfg) in payload.iter().zip(cfgs.iter()) {
            rows.push(vec![
                &w.id as &(dyn tokio_postgres::types::ToSql + Sync),
                &dataset_id,
                &w.id as &(dyn tokio_postgres::types::ToSql + Sync),
                &w.r#type,
                &w.layout.x,
                &w.layout.y,
                &w.layout.w,
                &w.layout.h,
                cfg,
            ]);
        }

        let mut insert = String::from(
            r#"INSERT INTO dashboard_widgets
            (id, "datasetId", "widgetKey", "chartType", "positionX", "positionY", width, height, "filterConfig")
            VALUES "#,
        );
        let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = rows
            .into_iter()
            .flat_map(|r| r.into_iter())
            .collect();
        let placeholders: Vec<String> = (0..payload.len())
            .map(|i| {
                let base = i * 9 + 1;
                format!(
                    "(${base}, ${b1}, ${b2}, ${b3}, ${b4}, ${b5}, ${b6}, ${b7}, ${b8})",
                    base = base,
                    b1 = base + 1,
                    b2 = base + 2,
                    b3 = base + 3,
                    b4 = base + 4,
                    b5 = base + 5,
                    b6 = base + 6,
                    b7 = base + 7,
                    b8 = base + 8
                )
            })
            .collect();
        insert.push_str(&placeholders.join(","));

        tx.execute(&insert, &params)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Insert widgets error: {}", e)))?;
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Commit error: {}", e)))?;

    Ok(Json(true))
}

async fn analyze_excel_handler(
    Json(payload): Json<AnalyzeRequest>,
) -> Result<Json<Vec<DetectedSheet>>, (StatusCode, String)> {
    let key = payload.dataset_key.unwrap_or_else(|| "dataset".to_string());
    let sheets = parse_and_analyze_sheets(&payload.file_bytes, &key)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    Ok(Json(sheets))
}

async fn import_excel_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ImportRequest>,
) -> Result<Json<ImportResponse>, (StatusCode, String)> {
    let client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    let (primary_key, total_imported) = execute_import(
        &client,
        &payload.dept,
        &payload.file_bytes,
        &payload.display_name,
        &payload.base_key,
        &payload.selected_sheets,
        &payload.selected_columns,
    )
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    Ok(Json(ImportResponse {
        primary_key,
        total_imported,
    }))
}

async fn query_widget_data_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<WidgetQueryRequest>,
) -> Result<Json<WidgetQueryResult>, (StatusCode, String)> {
    let client = state
        .pool
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Pool error: {}", e)))?;

    let res = execute_widget_query(&client, req)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    Ok(Json(res))
}
