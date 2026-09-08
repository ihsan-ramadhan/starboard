use std::collections::HashMap;
use tokio_postgres::Client;

use tokio_postgres::types::ToSql;

use crate::types::{
    RowsQueryRequest, RowsQueryResult, WidgetFilter, WidgetQueryRequest, WidgetQueryResult,
};

const MAX_SERIES: i64 = 8;
const OTHER_SERIES: &str = "Lainnya";

pub fn row_to_json(row: &tokio_postgres::Row) -> serde_json::Map<String, serde_json::Value> {
    let mut map = serde_json::Map::new();
    for (idx, col) in row.columns().iter().enumerate() {
        let value = if let Ok(v) = row.try_get::<_, String>(idx) {
            serde_json::Value::String(v)
        } else if let Ok(v) = row.try_get::<_, i64>(idx) {
            serde_json::Value::Number(v.into())
        } else if let Ok(v) = row.try_get::<_, i32>(idx) {
            serde_json::Value::Number(v.into())
        } else if let Ok(v) = row.try_get::<_, f64>(idx) {
            serde_json::Number::from_f64(v)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<_, rust_decimal::Decimal>(idx) {
            match v.to_string().parse::<f64>() {
                Ok(f) => serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null),
                Err(_) => serde_json::Value::String(v.to_string()),
            }
        } else if let Ok(v) = row.try_get::<_, bool>(idx) {
            serde_json::Value::Bool(v)
        } else if let Ok(v) = row.try_get::<_, chrono::NaiveDate>(idx) {
            serde_json::Value::String(v.to_string())
        } else {
            serde_json::Value::Null
        };
        map.insert(col.name().to_string(), value);
    }
    map
}

async fn resolve_table(
    client: &Client,
    dataset_id: &str,
    dept: &str,
) -> Result<String, String> {
    let row = client
        .query_opt(
            r#"SELECT "tableName" FROM dataset_registry WHERE id = $1 AND dept = $2"#,
            &[&dataset_id.to_string(), &dept.to_string()],
        )
        .await
        .map_err(|e| e.to_string())?;

    match row {
        Some(r) => Ok(r.get(0)),
        None => Err("Dataset not found".to_string()),
    }
}

struct ColumnGuard(HashMap<String, String>);

impl ColumnGuard {
    async fn load(client: &Client, dataset_id: &str) -> Result<Self, String> {
        let rows = client
            .query(
                r#"SELECT name, type FROM dataset_columns WHERE "datasetId" = $1"#,
                &[&dataset_id.to_string()],
            )
            .await
            .map_err(|e| e.to_string())?;

        let mut types: HashMap<String, String> = rows
            .iter()
            .map(|r| (r.get::<_, String>(0), r.get::<_, String>(1)))
            .collect();
        types.insert("id".to_string(), "category".to_string());
        Ok(Self(types))
    }

    fn check(&self, column: &str) -> Result<(), String> {
        if self.0.contains_key(column) {
            Ok(())
        } else {
            Err(format!("Kolom \"{}\" tidak dikenal pada dataset ini.", column))
        }
    }

    fn type_of(&self, column: &str) -> Option<&str> {
        self.0.get(column).map(String::as_str)
    }
}

fn filter_conditions(
    filters: &[WidgetFilter],
    guard: &ColumnGuard,
    alias: &str,
) -> Result<Vec<String>, String> {
    let mut conditions = Vec::new();

    for (index, filter) in filters.iter().enumerate() {
        guard.check(&filter.column)?;
        let slot = index + 1;
        let column = format!("{}\"{}\"", alias, filter.column);
        let kind = guard.type_of(&filter.column).unwrap_or("category");
        let op = filter.op.to_lowercase();

        let comparison = match op.as_str() {
            "eq" => "=",
            "ne" => "<>",
            "gt" => ">",
            "gte" => ">=",
            "lt" => "<",
            "lte" => "<=",
            "contains" => "",
            _ => return Err(format!("Operator \"{}\" tidak dikenal.", filter.op)),
        };

        let ordered = matches!(op.as_str(), "gt" | "gte" | "lt" | "lte");

        conditions.push(match kind {
            "numeric" if op == "contains" => {
                return Err("Operator \"mengandung\" tidak berlaku untuk kolom angka.".to_string())
            }
            "date" if op == "contains" => {
                return Err("Operator \"mengandung\" tidak berlaku untuk kolom tanggal.".to_string())
            }
            "numeric" => format!("{} {} (${}::text)::numeric", column, comparison, slot),
            "date" => format!("{} {} (${}::text)::date", column, comparison, slot),
            _ if ordered => {
                return Err(format!(
                    "Kolom \"{}\" bertipe teks, jadi tidak bisa dibandingkan lebih besar/kecil.",
                    filter.column
                ))
            }
            _ if op == "contains" => {
                format!("strpos(lower({}::text), lower(${}::text)) > 0", column, slot)
            }
            _ => format!("{}::text {} ${}", column, comparison, slot),
        });
    }

    Ok(conditions)
}

fn filter_values(filters: &[WidgetFilter]) -> Vec<String> {
    filters.iter().map(|f| f.value.clone()).collect()
}

fn as_params(values: &[String]) -> Vec<&(dyn ToSql + Sync)> {
    values.iter().map(|v| v as &(dyn ToSql + Sync)).collect()
}

fn where_clause(conditions: &[String]) -> String {
    if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    }
}

fn aggregate(
    metric: &str,
    column: Option<&String>,
    alias: &str,
    guard: &ColumnGuard,
) -> String {
    let Some(column) = column else {
        return "COUNT(*)::numeric".to_string();
    };
    let target = if guard.type_of(column) == Some("numeric") {
        format!("{}\"{}\"", alias, column)
    } else {
        format!("{}\"{}\"::numeric", alias, column)
    };
    match metric.to_uppercase().as_str() {
        "SUM" => format!("COALESCE(SUM({}), 0)", target),
        "AVG" => format!("COALESCE(AVG({}), 0)", target),
        "MIN" => format!("COALESCE(MIN({}), 0)", target),
        "MAX" => format!("COALESCE(MAX({}), 0)", target),
        _ => "COUNT(*)::numeric".to_string(),
    }
}

fn decimal_at(row: &tokio_postgres::Row, idx: usize) -> f64 {
    let value: rust_decimal::Decimal = row.try_get(idx).unwrap_or_default();
    value.to_string().parse::<f64>().unwrap_or(0.0)
}

pub async fn execute_widget_query(
    client: &Client,
    req: WidgetQueryRequest,
    dept: &str,
) -> Result<WidgetQueryResult, String> {
    let table = resolve_table(client, &req.dataset_id, dept).await?;
    let guard = ColumnGuard::load(client, &req.dataset_id).await?;

    if req.metric.eq_ignore_ascii_case("MAX_DATE") {
        let column = req
            .metric_column
            .as_ref()
            .ok_or_else(|| "Kolom tanggal belum dipilih.".to_string())?;
        guard.check(column)?;

        let sql = format!(r#"SELECT MAX("{}")::text FROM "{}""#, column, table);
        let row = client.query_one(&sql, &[]).await.map_err(|e| e.to_string())?;

        return Ok(WidgetQueryResult {
            scalar_value: None,
            scalar_text: row.try_get(0).unwrap_or(None),
            rows: Vec::new(),
        });
    }

    let mut value_columns: Vec<String> = if req.metric.eq_ignore_ascii_case("count") {
        Vec::new()
    } else {
        match &req.metric_columns {
            Some(list) if !list.is_empty() => list.clone(),
            _ => req.metric_column.clone().into_iter().collect(),
        }
    };
    value_columns.dedup();
    for column in &value_columns {
        guard.check(column)?;
    }

    let filters = req.filters.clone().unwrap_or_default();
    let values = filter_values(&filters);
    let plain_conditions = filter_conditions(&filters, &guard, "")?;

    let Some(group_column) = req.group_by_column.clone() else {
        return scalar_query(
            client,
            &table,
            &req.metric,
            &value_columns,
            &plain_conditions,
            &values,
            &guard,
        )
        .await;
    };
    guard.check(&group_column)?;

    let limit = req.limit.unwrap_or(10).clamp(1, 500);
    let by_key = req.order_by_key.unwrap_or(false);

    if let Some(series_column) = req.series_column.clone() {
        guard.check(&series_column)?;
        let aliased_conditions = filter_conditions(&filters, &guard, "t.")?;
        return pivot_query(
            client,
            &table,
            &req.metric,
            value_columns.first(),
            &group_column,
            &series_column,
            limit,
            by_key,
            &plain_conditions,
            &aliased_conditions,
            &values,
            &guard,
        )
        .await;
    }

    grouped_query(
        client,
        &table,
        &req.metric,
        &value_columns,
        &group_column,
        limit,
        by_key,
        &plain_conditions,
        &values,
        &guard,
    )
    .await
}

async fn scalar_query(
    client: &Client,
    table: &str,
    metric: &str,
    value_columns: &[String],
    conditions: &[String],
    values: &[String],
    guard: &ColumnGuard,
) -> Result<WidgetQueryResult, String> {
    let params = as_params(values);
    let filter_sql = where_clause(conditions);

    if value_columns.len() <= 1 {
        let sql = format!(
            r#"SELECT {} FROM "{}" {}"#,
            aggregate(metric, value_columns.first(), "", guard),
            table,
            filter_sql
        );
        let row = client
            .query_one(&sql, &params)
            .await
            .map_err(|e| e.to_string())?;

        return Ok(WidgetQueryResult {
            scalar_value: Some(decimal_at(&row, 0)),
            scalar_text: None,
            rows: Vec::new(),
        });
    }

    let selects: Vec<String> = value_columns
        .iter()
        .map(|c| aggregate(metric, Some(c), "", guard))
        .collect();
    let sql = format!(
        r#"SELECT {} FROM "{}" {}"#,
        selects.join(", "),
        table,
        filter_sql
    );
    let row = client
        .query_one(&sql, &params)
        .await
        .map_err(|e| e.to_string())?;

    let rows = value_columns
        .iter()
        .enumerate()
        .map(|(idx, column)| {
            serde_json::json!({
                "groupKey": column,
                "series": column,
                "value": decimal_at(&row, idx),
            })
        })
        .collect();

    Ok(WidgetQueryResult {
        scalar_value: Some(decimal_at(&row, 0)),
        scalar_text: None,
        rows,
    })
}

async fn grouped_query(
    client: &Client,
    table: &str,
    metric: &str,
    value_columns: &[String],
    group_column: &str,
    limit: i64,
    by_key: bool,
    conditions: &[String],
    values: &[String],
    guard: &ColumnGuard,
) -> Result<WidgetQueryResult, String> {
    let selects: Vec<String> = if value_columns.len() <= 1 {
        vec![aggregate(metric, value_columns.first(), "", guard)]
    } else {
        value_columns
            .iter()
            .map(|c| aggregate(metric, Some(c), "", guard))
            .collect()
    };

    let order = if by_key { "1 ASC" } else { "2 DESC" };
    let aliased: Vec<String> = selects
        .iter()
        .enumerate()
        .map(|(idx, expr)| format!("{} AS v{}", expr, idx))
        .collect();

    let mut all = vec![
        format!("\"{}\" IS NOT NULL", group_column),
        format!("\"{}\"::text != ''", group_column),
    ];
    all.extend_from_slice(conditions);

    let sql = format!(
        r#"
        SELECT "{group}"::text AS group_key, {selects}
        FROM "{table}"
        {filters}
        GROUP BY 1
        ORDER BY {order}
        LIMIT {limit}
        "#,
        group = group_column,
        selects = aliased.join(", "),
        table = table,
        filters = where_clause(&all),
        order = order,
        limit = limit,
    );

    let params = as_params(values);
    let db_rows = client
        .query(&sql, &params)
        .await
        .map_err(|e| e.to_string())?;
    let mut rows = Vec::new();

    for row in &db_rows {
        let group_key: String = row.try_get(0).unwrap_or_default();
        if value_columns.len() <= 1 {
            rows.push(serde_json::json!({
                "groupKey": group_key,
                "value": decimal_at(row, 1),
            }));
        } else {
            for (idx, column) in value_columns.iter().enumerate() {
                rows.push(serde_json::json!({
                    "groupKey": group_key,
                    "series": column,
                    "value": decimal_at(row, idx + 1),
                }));
            }
        }
    }

    Ok(WidgetQueryResult {
        scalar_value: None,
        scalar_text: None,
        rows,
    })
}

async fn pivot_query(
    client: &Client,
    table: &str,
    metric: &str,
    value_column: Option<&String>,
    group_column: &str,
    series_column: &str,
    limit: i64,
    by_key: bool,
    conditions: &[String],
    aliased_conditions: &[String],
    values: &[String],
    guard: &ColumnGuard,
) -> Result<WidgetQueryResult, String> {
    let outer_order = if by_key { "1 ASC, 2 ASC" } else { "4 DESC, 2 ASC" };
    let inner_order = if by_key { "1 ASC" } else { "2 DESC" };

    let mut group_conds = vec![
        format!("\"{}\" IS NOT NULL", group_column),
        format!("\"{}\"::text != ''", group_column),
    ];
    group_conds.extend_from_slice(conditions);

    let mut series_conds = vec![
        format!("\"{}\" IS NOT NULL", series_column),
        format!("\"{}\"::text != ''", series_column),
    ];
    series_conds.extend_from_slice(conditions);

    let mut outer_conds = vec![
        format!("t.\"{}\" IS NOT NULL", series_column),
        format!("t.\"{}\"::text != ''", series_column),
    ];
    outer_conds.extend_from_slice(aliased_conditions);

    let sql = format!(
        r#"
        WITH top_groups AS (
            SELECT "{group}"::text AS group_key, {agg_plain} AS total
            FROM "{table}"
            {group_filters}
            GROUP BY 1
            ORDER BY {inner_order}
            LIMIT {limit}
        ),
        top_series AS (
            SELECT "{series}"::text AS series_key
            FROM "{table}"
            {series_filters}
            GROUP BY 1
            ORDER BY {agg_plain} DESC
            LIMIT {max_series}
        )
        SELECT
            g.group_key,
            CASE
                WHEN t."{series}"::text IN (SELECT series_key FROM top_series)
                THEN t."{series}"::text
                ELSE '{other}'
            END AS series,
            {agg_alias} AS value,
            g.total
        FROM "{table}" t
        JOIN top_groups g ON t."{group}"::text = g.group_key
        {outer_filters}
        GROUP BY 1, 2, 4
        ORDER BY {outer_order}
        "#,
        group = group_column,
        series = series_column,
        table = table,
        agg_plain = aggregate(metric, value_column, "", guard),
        agg_alias = aggregate(metric, value_column, "t.", guard),
        group_filters = where_clause(&group_conds),
        series_filters = where_clause(&series_conds),
        outer_filters = where_clause(&outer_conds),
        inner_order = inner_order,
        outer_order = outer_order,
        limit = limit,
        max_series = MAX_SERIES,
        other = OTHER_SERIES,
    );

    let params = as_params(values);
    let db_rows = client
        .query(&sql, &params)
        .await
        .map_err(|e| e.to_string())?;
    let mut rows = Vec::new();

    for row in &db_rows {
        rows.push(serde_json::json!({
            "groupKey": row.try_get::<_, String>(0).unwrap_or_default(),
            "series": row.try_get::<_, String>(1).unwrap_or_default(),
            "value": decimal_at(row, 2),
        }));
    }

    Ok(WidgetQueryResult {
        scalar_value: None,
        scalar_text: None,
        rows,
    })
}

pub async fn execute_rows_query(
    client: &Client,
    req: RowsQueryRequest,
    dept: &str,
) -> Result<RowsQueryResult, String> {
    let table = resolve_table(client, &req.dataset_id, dept).await?;
    let guard = ColumnGuard::load(client, &req.dataset_id).await?;

    let ordered = client
        .query(
            r#"
            SELECT dc.name
            FROM dataset_columns dc
            JOIN information_schema.columns isc
              ON isc.column_name = dc.name AND isc.table_name = $2
            WHERE dc."datasetId" = $1
            ORDER BY isc.ordinal_position ASC
            "#,
            &[&req.dataset_id, &table],
        )
        .await
        .map_err(|e| e.to_string())?;

    let all_columns: Vec<String> = ordered.iter().map(|r| r.get::<_, String>(0)).collect();

    let mut columns = match req.columns {
        Some(list) if !list.is_empty() => {
            for column in &list {
                guard.check(column)?;
            }
            list
        }
        _ => all_columns.clone(),
    };
    columns.dedup();
    if columns.is_empty() {
        return Err("Tidak ada kolom yang bisa ditampilkan.".to_string());
    }

    let limit = req.limit.unwrap_or(100).clamp(1, 500);
    let offset = req.offset.unwrap_or(0).max(0);

    let order = match req.sort_column {
        Some(column) => {
            guard.check(&column)?;
            let direction = match req.sort_dir.as_deref() {
                Some(d) if d.eq_ignore_ascii_case("desc") => "DESC",
                _ => "ASC",
            };
            format!(r#"ORDER BY "{}" {} NULLS LAST"#, column, direction)
        }
        None => String::new(),
    };

    let filters = req.filters.clone().unwrap_or_default();
    let values = filter_values(&filters);
    let conditions = filter_conditions(&filters, &guard, "")?;
    let filter_sql = where_clause(&conditions);
    let params = as_params(&values);

    let projection: Vec<String> = columns.iter().map(|c| format!("\"{}\"", c)).collect();
    let sql = format!(
        r#"SELECT {} FROM "{}" {} {} LIMIT {} OFFSET {}"#,
        projection.join(", "),
        table,
        filter_sql,
        order,
        limit,
        offset
    );

    let db_rows = client
        .query(&sql, &params)
        .await
        .map_err(|e| e.to_string())?;
    let rows = db_rows
        .iter()
        .map(|r| serde_json::Value::Object(row_to_json(r)))
        .collect();

    let count_sql = format!(
        r#"SELECT count(*)::bigint FROM "{}" {}"#,
        table, filter_sql
    );
    let total: i64 = match client.query_one(&count_sql, &params).await {
        Ok(r) => r.get(0),
        Err(_) => 0,
    };

    Ok(RowsQueryResult {
        columns,
        rows,
        total,
    })
}
