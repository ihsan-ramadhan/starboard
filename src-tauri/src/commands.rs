use std::collections::HashMap;
use crate::db::get_client;
use crate::types::{
    DatasetColumn, DatasetDetail, DatasetRegistry, DetectedSheet, SessionUser,
    WidgetQueryRequest, WidgetQueryResult,
};
use crate::excel::{parse_and_analyze_sheets, execute_import};
use crate::analytics::execute_widget_query;

#[tauri::command]
pub async fn login(identifier: String, password: String) -> Result<SessionUser, String> {
    let client = get_client().await?;
    let row = client
        .query_opt(
            r#"
            SELECT u.id, u.username, u.email, u."passwordHash", u.role, d.color as dept_color
            FROM users u
            LEFT JOIN departments d ON d.code = u.role
            WHERE lower(u.email) = lower($1) OR lower(u.username) = lower($1)
            LIMIT 1
            "#,
            &[&identifier],
        )
        .await
        .map_err(|e| format!("DB error: {}", e))?;

    let row = match row {
        Some(r) => r,
        None => return Err("Pengguna tidak ditemukan.".to_string()),
    };

    let password_hash: String = row.get(3);
    let is_valid = bcrypt::verify(&password, &password_hash).unwrap_or(false);
    if !is_valid {
        return Err("Password salah.".to_string());
    }

    Ok(SessionUser {
        id: row.get(0),
        username: row.get(1),
        email: row.get(2),
        role: row.get(4),
        dept_color: row.get(5),
    })
}

#[tauri::command]
pub async fn logout() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub async fn get_current_user() -> Result<Option<SessionUser>, String> {
    Ok(None)
}

#[tauri::command]
pub async fn get_datasets(dept: String) -> Result<Vec<DatasetRegistry>, String> {
    let client = get_client().await?;
    let rows = client
        .query(
            r#"
            SELECT id, dept, key, "tableName", "displayName", "createdAt"
            FROM dataset_registry
            WHERE dept = $1
            ORDER BY "createdAt" DESC
            "#,
            &[&dept],
        )
        .await
        .map_err(|e| format!("Query error: {}", e))?;

    let list = rows
        .into_iter()
        .map(|r| {
            let created_at: String = r
                .try_get::<_, chrono::DateTime<chrono::Utc>>(5)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|_| {
                    r.try_get::<_, chrono::NaiveDateTime>(5)
                        .map(|ndt| ndt.to_string())
                        .unwrap_or_default()
                });
            DatasetRegistry {
                id: r.get(0),
                dept: r.get(1),
                key: r.get(2),
                table_name: r.get(3),
                display_name: r.get(4),
                created_at,
            }
        })
        .collect();

    Ok(list)
}

#[tauri::command]
pub async fn get_dataset_detail(dept: String, key: String) -> Result<DatasetDetail, String> {
    let client = get_client().await?;
    let row = client
        .query_opt(
            r#"
            SELECT id, dept, key, "tableName", "displayName", "createdAt"
            FROM dataset_registry
            WHERE dept = $1 AND key = $2
            LIMIT 1
            "#,
            &[&dept, &key],
        )
        .await
        .map_err(|e| format!("Query dataset error: {}", e))?;

    let dataset = match row {
        Some(r) => {
            let created_at: String = r
                .try_get::<_, chrono::DateTime<chrono::Utc>>(5)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|_| {
                    r.try_get::<_, chrono::NaiveDateTime>(5)
                        .map(|ndt| ndt.to_string())
                        .unwrap_or_default()
                });
            DatasetRegistry {
                id: r.get(0),
                dept: r.get(1),
                key: r.get(2),
                table_name: r.get(3),
                display_name: r.get(4),
                created_at,
            }
        }
        None => return Err("Dataset tidak ditemukan.".to_string()),
    };

    let col_rows = client
        .query(
            r#"
            SELECT c.id, c.name, c.label, c.type, c."isDimension"
            FROM dataset_columns c
            JOIN information_schema.columns ic
              ON ic.table_name = $2
             AND ic.column_name = c.name
            WHERE c."datasetId" = $1
            ORDER BY ic.ordinal_position ASC
            "#,
            &[&dataset.id, &dataset.table_name],
        )
        .await
        .map_err(|e| format!("Query columns error: {}", e))?;

    let columns: Vec<DatasetColumn> = col_rows
        .into_iter()
        .map(|r| DatasetColumn {
            id: r.get(0),
            name: r.get(1),
            label: r.get(2),
            r#type: r.get(3),
            is_dimension: r.get(4),
        })
        .collect();

    let count_query = format!("SELECT count(*)::bigint FROM \"{}\"", dataset.table_name);
    let count_res = client.query_one(&count_query, &[]).await;
    let total_rows: i64 = match count_res {
        Ok(r) => r.get(0),
        Err(_) => 0,
    };

    let sample_query = format!("SELECT * FROM \"{}\" ORDER BY id ASC LIMIT 15", dataset.table_name);
    let sample_rows_db = client.query(&sample_query, &[]).await.unwrap_or_default();
    
    let mut sample_rows: Vec<serde_json::Value> = Vec::new();
    for row in sample_rows_db {
        let mut map = serde_json::Map::new();
        for col in row.columns() {
            let col_name = col.name();
            let val_str: Option<String> = row.try_get(col_name).ok();
            let val_f64: Option<f64> = row.try_get(col_name).ok();
            let val_i64: Option<i64> = row.try_get(col_name).ok();
            let val_dec: Option<rust_decimal::Decimal> = row.try_get(col_name).ok();
            let val_date: Option<chrono::NaiveDate> = row.try_get(col_name).ok();

            if let Some(s) = val_str {
                map.insert(col_name.to_string(), serde_json::Value::String(s));
            } else if let Some(d) = val_date {
                map.insert(col_name.to_string(), serde_json::Value::String(d.to_string()));
            } else if let Some(dec) = val_dec {
                if let Ok(f) = dec.to_string().parse::<f64>() {
                    map.insert(col_name.to_string(), serde_json::json!(f));
                } else {
                    map.insert(col_name.to_string(), serde_json::Value::String(dec.to_string()));
                }
            } else if let Some(n) = val_f64 {
                map.insert(col_name.to_string(), serde_json::json!(n));
            } else if let Some(i) = val_i64 {
                map.insert(col_name.to_string(), serde_json::json!(i));
            } else {
                map.insert(col_name.to_string(), serde_json::Value::Null);
            }
        }
        sample_rows.push(serde_json::Value::Object(map));
    }

    Ok(DatasetDetail {
        dataset,
        columns,
        total_rows,
        sample_rows,
    })
}

#[tauri::command]
pub async fn query_widget_data(req: WidgetQueryRequest) -> Result<WidgetQueryResult, String> {
    execute_widget_query(req).await
}

#[tauri::command]
pub async fn delete_dataset(dataset_id: String) -> Result<bool, String> {
    let mut client = get_client().await?;
    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    let row_opt = tx
        .query_opt(
            r#"SELECT "tableName" FROM dataset_registry WHERE id = $1"#,
            &[&dataset_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = row_opt {
        let table_name: String = row.get(0);
        let drop_table_sql = format!(r#"DROP TABLE IF EXISTS "{}""#, table_name);
        tx.execute(&drop_table_sql, &[])
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.execute(
        r#"DELETE FROM dataset_columns WHERE "datasetId" = $1"#,
        &[&dataset_id],
    )
    .await
    .map_err(|e| e.to_string())?;

    tx.execute(
        r#"DELETE FROM dataset_registry WHERE id = $1"#,
        &[&dataset_id],
    )
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn analyze_excel(
    bytes: Vec<u8>,
    dataset_key: String,
) -> Result<Vec<DetectedSheet>, String> {
    parse_and_analyze_sheets(&bytes, &dataset_key)
}

#[tauri::command]
pub async fn import_excel(
    dept: Option<String>,
    bytes: Vec<u8>,
    display_name: String,
    dataset_key: String,
    selected_sheets: Vec<String>,
    selected_columns: HashMap<String, Vec<String>>,
) -> Result<serde_json::Value, String> {
    let department = dept.unwrap_or_else(|| "MIOP".to_string());
    let (primary_key, total_imported) = execute_import(
        &department,
        &bytes,
        &display_name,
        &dataset_key,
        &selected_sheets,
        &selected_columns,
    )
    .await?;

    Ok(serde_json::json!({
        "primaryKey": primary_key,
        "importedCount": total_imported
    }))
}
