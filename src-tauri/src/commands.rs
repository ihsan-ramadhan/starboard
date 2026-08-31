use calamine::{open_workbook_from_rs, Data, Range, Reader, Xlsx};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::Cursor;
use uuid::Uuid;

use crate::db::get_client;

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
    pub r#type: String, // "numeric" | "date" | "category"
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

fn slugify(name: &str) -> String {
    let re = Regex::new(r"[^a-z0-9]+").unwrap();
    let lower = name.to_lowercase();
    let s = re.replace_all(&lower, "_");
    let trimmed = s.trim_matches('_');
    if trimmed.len() > 32 {
        trimmed[..32].to_string()
    } else {
        trimmed.to_string()
    }
}

// -------------------------------------------------------------
// COMMANDS
// -------------------------------------------------------------

#[tauri::command]
pub async fn login(identifier: String, password: String) -> Result<SessionUser, String> {
    let client = get_client().await?;
    let row = client
        .query_opt(
            r#"
            SELECT u.id, u.username, u.email, u."passwordHash", u.role, d.color as dept_color
            FROM users u
            LEFT JOIN departments d ON u.role = d.code
            WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)
            LIMIT 1
            "#,
            &[&identifier],
        )
        .await
        .map_err(|e| format!("Query error: {}", e))?;

    let row = match row {
        Some(r) => r,
        None => return Err("Username atau password salah.".into()),
    };

    let password_hash: String = row.get(3);
    let valid = bcrypt::verify(&password, &password_hash).unwrap_or(false);
    if !valid {
        return Err("Username atau password salah.".into());
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
pub async fn logout() -> Result<(), String> {
    Ok(())
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
            SELECT id, dept, key, "tableName", "displayName", "createdAt"::text
            FROM dataset_registry
            WHERE dept = $1
            ORDER BY "createdAt" ASC
            "#,
            &[&dept],
        )
        .await
        .map_err(|e| format!("Query error: {}", e))?;

    let list = rows
        .into_iter()
        .map(|r| DatasetRegistry {
            id: r.get(0),
            dept: r.get(1),
            key: r.get(2),
            table_name: r.get(3),
            display_name: r.get(4),
            created_at: r.get(5),
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
            SELECT id, dept, key, "tableName", "displayName", "createdAt"::text
            FROM dataset_registry
            WHERE dept = $1 AND key = $2
            LIMIT 1
            "#,
            &[&dept, &key],
        )
        .await
        .map_err(|e| format!("Query error: {}", e))?;

    let ds_row = match row {
        Some(r) => r,
        None => return Err("Dataset not found".into()),
    };

    let dataset = DatasetRegistry {
        id: ds_row.get(0),
        dept: ds_row.get(1),
        key: ds_row.get(2),
        table_name: ds_row.get(3),
        display_name: ds_row.get(4),
        created_at: ds_row.get(5),
    };

    let col_rows = client
        .query(
            r#"
            SELECT id, name, label, type, "isDimension"
            FROM dataset_columns
            WHERE "datasetId" = $1
            ORDER BY id ASC
            "#,
            &[&dataset.id],
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

// -------------------------------------------------------------
// EXCEL INFERENCE & PARSER
// -------------------------------------------------------------

fn infer_type_from_cells(values: &[&Data]) -> String {
    if values.is_empty() {
        return "category".to_string();
    }
    let mut date_count = 0;
    let mut num_count = 0;
    let mut non_null = 0;

    for v in values {
        match v {
            Data::Float(_) | Data::Int(_) => {
                num_count += 1;
                non_null += 1;
            }
            Data::DateTime(_) | Data::DateTimeIso(_) => {
                date_count += 1;
                non_null += 1;
            }
            Data::String(s) => {
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    non_null += 1;
                    if trimmed.parse::<f64>().is_ok() {
                        num_count += 1;
                    } else if chrono::NaiveDate::parse_from_str(trimmed, "%Y-%m-%d").is_ok()
                        || chrono::NaiveDate::parse_from_str(trimmed, "%d/%m/%Y").is_ok()
                    {
                        date_count += 1;
                    }
                }
            }
            _ => {}
        }
    }

    if non_null == 0 {
        return "category".to_string();
    }

    let threshold = (non_null as f64) * 0.65;
    if (date_count as f64) >= threshold {
        "date".to_string()
    } else if (num_count as f64) >= threshold {
        "numeric".to_string()
    } else {
        "category".to_string()
    }
}

fn find_header_row_in_range(range: &Range<Data>) -> Option<(usize, Vec<(usize, String)>)> {
    let mut best_score = 2;
    let mut best: Option<(usize, Vec<(usize, String)>)> = None;

    let rows_to_check = std::cmp::min(range.height(), 12);

    for r in 0..rows_to_check {
        let mut distinct = HashSet::new();
        let mut cols = Vec::new();

        for c in 0..range.width() {
            if let Some(val) = range.get((r, c)) {
                let s = match val {
                    Data::String(txt) => txt.trim().to_string(),
                    Data::Int(i) => i.to_string(),
                    _ => "".to_string(),
                };
                if !s.is_empty() {
                    cols.push((c + 1, s.clone())); // 1-based index
                    distinct.insert(s);
                }
            }
        }

        if distinct.len() > best_score {
            best_score = distinct.len();
            best = Some((r + 1, cols)); // 1-based row
        }
    }

    best
}

#[tauri::command]
pub async fn analyze_excel(bytes: Vec<u8>, dataset_key: String) -> Result<Vec<DetectedSheet>, String> {
    let cursor = Cursor::new(bytes);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| format!("Excel open error: {}", e))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let mut detected = Vec::new();

    for name in sheet_names {
        if let Ok(range) = workbook.worksheet_range(&name) {
            if let Some((header_row_1based, header_cols)) = find_header_row_in_range(&range) {
                if header_cols.len() < 2 {
                    continue;
                }

                let data_start_row = header_row_1based + 1;
                let header_idx_0based = header_row_1based - 1;

                let mut seen_slugs = HashMap::new();
                let mut columns = Vec::new();

                for (col_idx_1based, raw_name) in &header_cols {
                    let col_0based = col_idx_1based - 1;
                    let mut samples = Vec::new();

                    for r in (header_idx_0based + 1)..std::cmp::min(range.height(), header_idx_0based + 40) {
                        if let Some(val) = range.get((r, col_0based)) {
                            samples.push(val);
                        }
                    }

                    let inferred_type = infer_type_from_cells(&samples);
                    let mut base_slug = slugify(raw_name);
                    if base_slug.is_empty() {
                        base_slug = format!("col_{}", col_idx_1based);
                    }

                    let count = seen_slugs.entry(base_slug.clone()).or_insert(0);
                    *count += 1;
                    let unique_slug = if *count == 1 {
                        base_slug
                    } else {
                        format!("{}_{}", base_slug, count)
                    };

                    columns.push(ColumnSchema {
                        col_index: *col_idx_1based,
                        raw_name: raw_name.clone(),
                        slug: unique_slug,
                        r#type: inferred_type,
                    });
                }

                let mut slug_list: Vec<String> = columns.iter().map(|c| c.slug.clone()).collect();
                slug_list.sort();
                let fingerprint = slug_list.join("|");

                let row_count = if range.height() > header_row_1based {
                    range.height() - header_row_1based
                } else {
                    0
                };

                let suggested_key = format!("{}_{}", slugify(&dataset_key), slugify(&name));

                detected.push(DetectedSheet {
                    sheet_name: name.clone(),
                    header_row_index: header_row_1based,
                    data_start_row_index: data_start_row,
                    columns,
                    row_count,
                    fingerprint,
                    suggested_key,
                });
            }
        }
    }

    Ok(detected)
}

#[derive(Serialize)]
pub struct ImportResult {
    #[serde(rename = "primaryKey")]
    pub primary_key: String,
    #[serde(rename = "importedCount")]
    pub imported_count: usize,
}

#[tauri::command]
pub async fn import_excel(
    bytes: Vec<u8>,
    display_name: String,
    dataset_key: String,
    selected_sheets: Vec<String>,
    selected_columns: HashMap<String, Vec<String>>,
) -> Result<ImportResult, String> {
    let base_key = slugify(&dataset_key);
    let client = get_client().await?;

    let cursor = Cursor::new(bytes);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| format!("Excel open error: {}", e))?;

    let mut primary_key = "".to_string();
    let mut total_imported = 0;

    for sheet_name in selected_sheets {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            if let Some((header_row_1based, header_cols)) = find_header_row_in_range(&range) {
                let header_idx_0based = header_row_1based - 1;

                let mut seen_slugs = HashMap::new();
                let mut all_columns = Vec::new();

                for (col_idx_1based, raw_name) in &header_cols {
                    let col_0based = col_idx_1based - 1;
                    let mut samples = Vec::new();
                    for r in (header_idx_0based + 1)..std::cmp::min(range.height(), header_idx_0based + 40) {
                        if let Some(val) = range.get((r, col_0based)) {
                            samples.push(val);
                        }
                    }
                    let inferred_type = infer_type_from_cells(&samples);
                    let mut base_slug = slugify(raw_name);
                    if base_slug.is_empty() {
                        base_slug = format!("col_{}", col_idx_1based);
                    }
                    let count = seen_slugs.entry(base_slug.clone()).or_insert(0);
                    *count += 1;
                    let unique_slug = if *count == 1 {
                        base_slug
                    } else {
                        format!("{}_{}", base_slug, count)
                    };

                    all_columns.push(ColumnSchema {
                        col_index: *col_idx_1based,
                        raw_name: raw_name.clone(),
                        slug: unique_slug,
                        r#type: inferred_type,
                    });
                }

                let chosen_slugs = selected_columns.get(&sheet_name);
                let import_cols: Vec<ColumnSchema> = if let Some(slugs) = chosen_slugs {
                    all_columns.into_iter().filter(|c| slugs.contains(&c.slug)).collect()
                } else {
                    all_columns
                };

                if import_cols.is_empty() {
                    continue;
                }

                let key = format!("{}_{}", base_key, slugify(&sheet_name));
                let table_name = format!("miop_{}_records", key);
                if primary_key.is_empty() {
                    primary_key = key.clone();
                }

                // DDL: CREATE TABLE
                let mut col_defs = Vec::new();
                for col in &import_cols {
                    let pg_type = match col.r#type.as_str() {
                        "numeric" => "numeric",
                        "date" => "date",
                        _ => "text",
                    };
                    col_defs.push(format!("\"{}\" {}", col.slug, pg_type));
                }

                let create_sql = format!(
                    r#"
                    CREATE TABLE IF NOT EXISTS "{}" (
                        "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
                        {},
                        "source_sheet" text,
                        "created_at" timestamptz DEFAULT now()
                    );
                    "#,
                    table_name,
                    col_defs.join(",\n")
                );

                client
                    .execute(&create_sql, &[])
                    .await
                    .map_err(|e| format!("Create table error: {}", e))?;

                // Upsert dataset_registry
                let ds_id = Uuid::new_v4().to_string();
                let disp_title = if !display_name.is_empty() {
                    display_name.clone()
                } else {
                    sheet_name.clone()
                };

                client.execute(
                    r#"
                    INSERT INTO dataset_registry ("id", "dept", "key", "tableName", "displayName", "createdAt")
                    VALUES ($1, 'MIOP', $2, $3, $4, now())
                    ON CONFLICT ("dept", "key") DO UPDATE
                    SET "tableName" = EXCLUDED."tableName", "displayName" = EXCLUDED."displayName"
                    "#,
                    &[&ds_id, &key, &table_name, &disp_title],
                ).await.map_err(|e| format!("Registry upsert error: {}", e))?;

                // Get true dataset id
                let ds_row = client.query_one(
                    r#"SELECT id FROM dataset_registry WHERE dept = 'MIOP' AND key = $1"#,
                    &[&key],
                ).await.map_err(|e| format!("Fetch dataset id error: {}", e))?;
                let true_ds_id: String = ds_row.get(0);

                // Insert dataset_columns
                client.execute(
                    r#"DELETE FROM dataset_columns WHERE "datasetId" = $1"#,
                    &[&true_ds_id],
                ).await.ok();

                for col in &import_cols {
                    let col_id = Uuid::new_v4().to_string();
                    let is_dim = col.r#type == "category";
                    client.execute(
                        r#"
                        INSERT INTO dataset_columns ("id", "datasetId", "name", "label", "type", "isDimension")
                        VALUES ($1, $2, $3, $4, $5, $6)
                        "#,
                        &[&col_id, &true_ds_id, &col.slug, &col.raw_name, &col.r#type, &is_dim],
                    ).await.ok();
                }

                // Batch Insert Rows
                let mut rows_data = Vec::new();
                for r in (header_idx_0based + 1)..range.height() {
                    let mut row_map = HashMap::new();
                    let mut filled_count = 0;

                    for col in &import_cols {
                        let c_idx = col.col_index - 1;
                        if let Some(cell_val) = range.get((r, c_idx)) {
                            let str_val = match cell_val {
                                Data::Empty => "".to_string(),
                                Data::String(s) => s.trim().to_string(),
                                Data::Float(f) => f.to_string(),
                                Data::Int(i) => i.to_string(),
                                Data::DateTime(d) => format!("{:.4}", d.as_f64()),
                                Data::DateTimeIso(s) => s.clone(),
                                Data::Bool(b) => b.to_string(),
                                _ => "".to_string(),
                            };
                            if !str_val.is_empty() {
                                filled_count += 1;
                                row_map.insert(col.slug.clone(), str_val);
                            }
                        }
                    }

                    if filled_count >= 1 {
                        row_map.insert("source_sheet".to_string(), sheet_name.clone());
                        rows_data.push(row_map);
                    }
                }

                if !rows_data.is_empty() {
                    let chunk_size = 100;
                    for chunk in rows_data.chunks(chunk_size) {
                        let mut insert_sql = format!("INSERT INTO \"{}\" (", table_name);
                        let mut col_names: Vec<String> = import_cols.iter().map(|c| format!("\"{}\"", c.slug)).collect();
                        col_names.push("\"source_sheet\"".to_string());
                        insert_sql.push_str(&col_names.join(", "));
                        insert_sql.push_str(") VALUES ");

                        let mut val_clauses = Vec::new();
                        for row in chunk {
                            let mut vals = Vec::new();
                            for col in &import_cols {
                                if let Some(v) = row.get(&col.slug) {
                                    if col.r#type == "numeric" {
                                        if let Ok(n) = v.parse::<f64>() {
                                            vals.push(n.to_string());
                                        } else {
                                            vals.push("NULL".to_string());
                                        }
                                    } else {
                                        let escaped = v.replace('\'', "''");
                                        vals.push(format!("'{}'", escaped));
                                    }
                                } else {
                                    vals.push("NULL".to_string());
                                }
                            }
                            // source_sheet
                            let s_escaped = sheet_name.replace('\'', "''");
                            vals.push(format!("'{}'", s_escaped));
                            val_clauses.push(format!("({})", vals.join(", ")));
                        }

                        insert_sql.push_str(&val_clauses.join(",\n"));

                        client
                            .execute(&insert_sql, &[])
                            .await
                            .map_err(|e| format!("Batch insert error: {}", e))?;
                        
                        total_imported += chunk.len();
                    }
                }
            }
        }
    }

    Ok(ImportResult {
        primary_key: if primary_key.is_empty() { base_key } else { primary_key },
        imported_count: total_imported,
    })
}
