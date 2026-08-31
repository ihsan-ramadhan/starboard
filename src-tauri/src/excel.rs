use calamine::{open_workbook_from_rs, Data, Range, Reader, Xlsx};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::io::Cursor;
use uuid::Uuid;

use crate::db::get_client;
use crate::types::{ColumnSchema, DetectedSheet};

pub fn slugify(name: &str) -> String {
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

pub fn infer_type_from_cells(values: &[&Data]) -> String {
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

pub fn find_header_row_in_range(range: &Range<Data>) -> Option<(usize, Vec<(usize, String)>)> {
    let mut best_score = 2;
    let mut best: Option<(usize, Vec<(usize, String)>)> = None;

    for r in 0..range.height().min(20) {
        let mut cols = Vec::new();
        let mut text_count = 0;

        for c in 0..range.width() {
            if let Some(cell) = range.get((r, c)) {
                let text = match cell {
                    Data::String(s) => s.trim().to_string(),
                    _ => "".to_string(),
                };
                if !text.is_empty() {
                    text_count += 1;
                    cols.push((c + 1, text));
                }
            }
        }

        if text_count >= best_score {
            best_score = text_count;
            best = Some((r + 1, cols));
        }
    }

    best
}

pub fn parse_and_analyze_sheets(
    bytes: &[u8],
    dataset_key: &str,
) -> Result<Vec<DetectedSheet>, String> {
    let cursor = Cursor::new(bytes);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| format!("Gagal membaca format Excel: {}", e))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let mut detected: Vec<DetectedSheet> = Vec::new();

    for name in sheet_names {
        if let Ok(range) = workbook.worksheet_range(&name) {
            if range.is_empty() || range.height() == 0 {
                continue;
            }

            if let Some((header_idx_1based, cols_raw)) = find_header_row_in_range(&range) {
                let header_idx_0based = header_idx_1based - 1;
                let data_start_row = header_idx_1based + 1;
                let mut used_slugs: HashSet<String> = HashSet::new();
                let mut columns: Vec<ColumnSchema> = Vec::new();

                for (col_idx, raw_name) in cols_raw {
                    let mut base_slug = slugify(&raw_name);
                    if base_slug.is_empty() {
                        base_slug = format!("col_{}", col_idx);
                    }
                    let mut slug = base_slug.clone();
                    let mut counter = 2;
                    while used_slugs.contains(&slug) {
                        slug = format!("{}_{}", base_slug, counter);
                        counter += 1;
                    }
                    used_slugs.insert(slug.clone());

                    let c_idx_0based = col_idx - 1;
                    let mut sample_cells = Vec::new();
                    for r in (header_idx_0based + 1)..range.height().min(header_idx_0based + 101) {
                        if let Some(cell) = range.get((r, c_idx_0based)) {
                            sample_cells.push(cell);
                        }
                    }

                    let inferred = infer_type_from_cells(&sample_cells);
                    columns.push(ColumnSchema {
                        col_index: col_idx,
                        raw_name,
                        slug,
                        r#type: inferred,
                    });
                }

                let mut row_count = 0;
                for r in (header_idx_0based + 1)..range.height() {
                    let mut has_data = false;
                    for c in 0..range.width() {
                        if let Some(cell) = range.get((r, c)) {
                            if !matches!(cell, Data::Empty) {
                                has_data = true;
                                break;
                            }
                        }
                    }
                    if has_data {
                        row_count += 1;
                    }
                }

                let col_slugs_joined = columns
                    .iter()
                    .map(|c| c.slug.as_str())
                    .collect::<Vec<_>>()
                    .join(",");
                let fingerprint = col_slugs_joined;
                let suggested_key = format!("{}_{}", dataset_key, slugify(&name));

                detected.push(DetectedSheet {
                    sheet_name: name,
                    header_row_index: header_idx_1based,
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

pub async fn execute_import(
    bytes: &[u8],
    display_name: &str,
    dataset_key: &str,
    selected_sheets: &[String],
    selected_columns: &HashMap<String, Vec<String>>,
) -> Result<(String, usize), String> {
    let cursor = Cursor::new(bytes);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| format!("Gagal membaca format Excel: {}", e))?;

    let client = get_client().await?;
    let mut primary_key = "".to_string();
    let mut total_imported = 0;
    let base_key = slugify(dataset_key);

    for sheet_name in selected_sheets {
        if let Ok(range) = workbook.worksheet_range(sheet_name) {
            if let Some((header_idx_1based, cols_raw)) = find_header_row_in_range(&range) {
                let header_idx_0based = header_idx_1based - 1;
                let mut used_slugs: HashSet<String> = HashSet::new();
                let mut all_columns: Vec<ColumnSchema> = Vec::new();

                for (col_idx, raw_name) in cols_raw {
                    let mut base_slug = slugify(&raw_name);
                    if base_slug.is_empty() {
                        base_slug = format!("col_{}", col_idx);
                    }
                    let mut slug = base_slug.clone();
                    let mut counter = 2;
                    while used_slugs.contains(&slug) {
                        slug = format!("{}_{}", base_slug, counter);
                        counter += 1;
                    }
                    used_slugs.insert(slug.clone());

                    let c_idx_0based = col_idx - 1;
                    let mut sample_cells = Vec::new();
                    for r in (header_idx_0based + 1)..range.height().min(header_idx_0based + 101) {
                        if let Some(cell) = range.get((r, c_idx_0based)) {
                            sample_cells.push(cell);
                        }
                    }
                    let inferred = infer_type_from_cells(&sample_cells);
                    all_columns.push(ColumnSchema {
                        col_index: col_idx,
                        raw_name,
                        slug,
                        r#type: inferred,
                    });
                }

                let chosen_slugs = selected_columns.get(sheet_name);
                let import_cols: Vec<ColumnSchema> = if let Some(slugs) = chosen_slugs {
                    all_columns.into_iter().filter(|c| slugs.contains(&c.slug)).collect()
                } else {
                    all_columns
                };

                if import_cols.is_empty() {
                    continue;
                }

                let key = format!("{}_{}", base_key, slugify(sheet_name));
                let table_name = format!("miop_{}_records", key);
                if primary_key.is_empty() {
                    primary_key = key.clone();
                }

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

                let ds_id = Uuid::new_v4().to_string();
                let disp_title = if !display_name.is_empty() {
                    display_name.to_string()
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

                let ds_row = client.query_one(
                    r#"SELECT id FROM dataset_registry WHERE dept = 'MIOP' AND key = $1"#,
                    &[&key],
                ).await.map_err(|e| format!("Fetch dataset id error: {}", e))?;
                let true_ds_id: String = ds_row.get(0);

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

                        let mut values_parts = Vec::new();
                        let mut params_owned: Vec<String> = Vec::new();
                        let mut p_idx = 1;

                        for r_map in chunk {
                            let mut row_placeholders = Vec::new();
                            for col in &import_cols {
                                let val_str = r_map.get(&col.slug).cloned().unwrap_or_default();
                                if val_str.is_empty() {
                                    row_placeholders.push("DEFAULT".to_string());
                                } else {
                                    row_placeholders.push(format!("${}", p_idx));
                                    p_idx += 1;
                                    params_owned.push(val_str);
                                }
                            }
                            row_placeholders.push(format!("${}", p_idx));
                            p_idx += 1;
                            params_owned.push(sheet_name.clone());

                            values_parts.push(format!("({})", row_placeholders.join(", ")));
                        }

                        insert_sql.push_str(&values_parts.join(", "));

                        let params_refs: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params_owned
                            .iter()
                            .map(|s| s as &(dyn tokio_postgres::types::ToSql + Sync))
                            .collect();

                        client
                            .execute(&insert_sql, &params_refs[..])
                            .await
                            .map_err(|e| format!("Batch insert error: {}", e))?;
                    }
                }

                total_imported += rows_data.len();
            }
        }
    }

    Ok((primary_key, total_imported))
}
