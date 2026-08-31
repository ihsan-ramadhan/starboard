use crate::db::get_client;
use crate::types::{WidgetQueryRequest, WidgetQueryResult};

pub async fn execute_widget_query(req: WidgetQueryRequest) -> Result<WidgetQueryResult, String> {
    let client = get_client().await?;

    let ds_row = client
        .query_opt(
            r#"SELECT "tableName" FROM dataset_registry WHERE id = $1"#,
            &[&req.dataset_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    let table_name: String = match ds_row {
        Some(r) => r.get(0),
        None => return Err("Dataset not found".to_string()),
    };

    let col_name = req.metric_column.unwrap_or_else(|| "id".to_string());
    let agg_func = match req.metric.to_uppercase().as_str() {
        "SUM" => format!("COALESCE(SUM(\"{}\"::numeric), 0)", col_name),
        "AVG" => format!("COALESCE(AVG(\"{}\"::numeric), 0)", col_name),
        "MIN" => format!("COALESCE(MIN(\"{}\"::numeric), 0)", col_name),
        "MAX" => format!("COALESCE(MAX(\"{}\"::numeric), 0)", col_name),
        _ => "COUNT(*)::numeric".to_string(),
    };

    if let Some(group_col) = req.group_by_column {
        let limit_val = req.limit.unwrap_or(10);
        let order_clause = if req.order_by_key.unwrap_or(false) {
            format!("\"{}\" ASC", group_col)
        } else {
            "value DESC".to_string()
        };

        let sql = format!(
            r#"
            SELECT "{0}"::text as group_key, {1} as value
            FROM "{2}"
            WHERE "{0}" IS NOT NULL AND "{0}"::text != ''
            GROUP BY "{0}"
            ORDER BY {3}
            LIMIT {4}
            "#,
            group_col, agg_func, table_name, order_clause, limit_val
        );

        let rows_db = client.query(&sql, &[]).await.map_err(|e| e.to_string())?;
        let mut rows = Vec::new();
        for r in rows_db {
            let key_str: String = r.try_get(0).unwrap_or_default();
            let val_dec: rust_decimal::Decimal = r.try_get(1).unwrap_or_default();
            let val_f64 = val_dec.to_string().parse::<f64>().unwrap_or(0.0);

            rows.push(serde_json::json!({
                "groupKey": key_str,
                "value": val_f64
            }));
        }

        Ok(WidgetQueryResult {
            scalar_value: None,
            rows,
        })
    } else {
        let sql = format!(r#"SELECT {} FROM "{}""#, agg_func, table_name);
        let row_db = client
            .query_one(&sql, &[])
            .await
            .map_err(|e| e.to_string())?;
        let val_dec: rust_decimal::Decimal = row_db.try_get(0).unwrap_or_default();
        let val_f64 = val_dec.to_string().parse::<f64>().unwrap_or(0.0);

        Ok(WidgetQueryResult {
            scalar_value: Some(val_f64),
            rows: Vec::new(),
        })
    }
}
