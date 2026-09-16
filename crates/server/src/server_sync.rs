use deadpool_postgres::Pool;
use std::collections::{HashMap, HashSet};
use std::time::{Duration, UNIX_EPOCH};

use crate::excel::{execute_import, ImportSpec};

const POLL_INTERVAL: Duration = Duration::from_secs(20);

struct Candidate {
    id: String,
    dept: String,
    key: String,
    paths: Vec<String>,
    base_key: String,
    display_name: String,
    last_mtime: Option<String>,
    source_name: Option<String>,
    source_size: Option<i64>,
    config: serde_json::Value,
}

pub fn machine_name() -> String {
    for var in ["COMPUTERNAME", "HOSTNAME"] {
        if let Ok(name) = std::env::var(var) {
            if !name.trim().is_empty() {
                return name.trim().to_string();
            }
        }
    }
    match std::fs::read_to_string("/etc/hostname") {
        Ok(name) if !name.trim().is_empty() => name.trim().to_string(),
        _ => "server".to_string(),
    }
}

fn revision_of(meta: &std::fs::Metadata) -> Result<String, String> {
    let millis = meta
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    Ok(format!("{}-{}", millis, meta.len()))
}

fn disabled() -> bool {
    matches!(
        std::env::var("SERVER_SYNC").unwrap_or_default().trim(),
        "0" | "off" | "false"
    )
}

fn sync_roots() -> Option<Vec<String>> {
    let raw = std::env::var("SYNC_ROOT").ok()?;
    let roots: Vec<String> = raw
        .split(';')
        .map(|r| normalize(r.trim()))
        .filter(|r| !r.is_empty())
        .collect();
    if roots.is_empty() {
        None
    } else {
        Some(roots)
    }
}

fn normalize(path: &str) -> String {
    path.replace('/', "\\").to_lowercase()
}

fn within_roots(path: &str, roots: &Option<Vec<String>>) -> bool {
    let Some(roots) = roots else { return true };

    let candidate = normalize(path);
    if candidate.split('\\').any(|seg| seg == "..") {
        return false;
    }

    roots.iter().any(|root| {
        let mut prefix = root.clone();
        if !prefix.ends_with('\\') {
            prefix.push('\\');
        }
        candidate.starts_with(&prefix)
    })
}

pub fn spawn(pool: Pool) {
    if disabled() {
        println!(">>> Server-side sync DIMATIKAN (SERVER_SYNC=0)");
        return;
    }

    let roots = sync_roots();
    match &roots {
        Some(list) => println!(">>> Server-side sync dibatasi ke: {}", list.join(", ")),
        None => println!(">>> Server-side sync tanpa batas folder (SYNC_ROOT belum diset)"),
    }

    tokio::spawn(async move {
        let host = machine_name();
        println!(">>> Server-side sync aktif (mesin: {})", host);
        let mut ticker = tokio::time::interval(POLL_INTERVAL);
        loop {
            ticker.tick().await;
            if let Err(e) = sweep(&pool, &roots).await {
                eprintln!("[WARN] Server sync gagal: {}", e);
            }
        }
    });
}

async fn load_candidates(pool: &Pool) -> Result<Vec<Candidate>, String> {
    let client = pool.get().await.map_err(|e| e.to_string())?;
    let rows = client
        .query(
            r#"
            SELECT r.id, r.dept, r.key, r."displayName", r."lastSyncedMtime",
                   r."sourceName", r."sourceSize", r."syncConfig",
                   array_remove(
                       array_agg(DISTINCT sp.path) || ARRAY[r."sourcePath"],
                       NULL
                   )
            FROM dataset_registry r
            LEFT JOIN dataset_source_paths sp ON sp."datasetId" = r.id
            WHERE r."syncEnabled" AND r."syncConfig" IS NOT NULL
            GROUP BY r.id
            "#,
            &[],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| Candidate {
            id: r.get(0),
            dept: r.get(1),
            key: r.get(2),
            display_name: r.get(3),
            last_mtime: r.get(4),
            source_name: r.get(5),
            source_size: r.get(6),
            base_key: r
                .get::<_, serde_json::Value>(7)
                .get("baseKey")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            config: r.get(7),
            paths: {
                let mut seen = HashSet::new();
                r.get::<_, Vec<String>>(8)
                    .into_iter()
                    .filter(|p| seen.insert(p.clone()))
                    .collect()
            },
        })
        .collect())
}

async fn record(pool: &Pool, id: &str, path: Option<&str>, error: Option<&str>) {
    let Ok(client) = pool.get().await else { return };
    let _ = client
        .execute(
            r#"UPDATE dataset_registry SET "serverPath" = $2, "serverError" = $3 WHERE id = $1"#,
            &[&id, &path, &error],
        )
        .await;
}

async fn sweep(pool: &Pool, roots: &Option<Vec<String>>) -> Result<(), String> {
    let candidates = load_candidates(pool).await?;
    let mut seen: HashSet<(String, String)> = HashSet::new();

    for c in candidates {
        let allowed: Vec<&String> = c
            .paths
            .iter()
            .filter(|p| within_roots(p, roots))
            .collect();

        if allowed.is_empty() && !c.paths.is_empty() {
            let why = format!(
                "Semua path di luar SYNC_ROOT, tidak dibaca server: {}",
                c.paths.join(", ")
            );
            record(pool, &c.id, None, Some(&why)).await;
            continue;
        }

        let readable = allowed
            .iter()
            .find_map(|p| std::fs::metadata(p).ok().map(|m| ((*p).clone(), m)));

        let Some((path, meta)) = readable else {
            let tried = c.paths.join(", ");
            let why = if tried.is_empty() {
                "Belum ada path sumber yang tercatat.".to_string()
            } else {
                format!("Tidak ada path yang bisa dibaca server: {}", tried)
            };
            record(pool, &c.id, None, Some(&why)).await;
            continue;
        };

        if !seen.insert((path.clone(), c.base_key.clone())) {
            continue;
        }

        let revision = match revision_of(&meta) {
            Ok(r) => r,
            Err(e) => {
                record(pool, &c.id, None, Some(&e)).await;
                continue;
            }
        };

        if c.last_mtime.as_deref() == Some(revision.as_str()) {
            record(pool, &c.id, Some(&path), None).await;
            continue;
        }

        if let Some(msg) = crate::claim_mismatch(
            c.source_name.as_deref(),
            c.source_size,
            crate::excel::base_name(&path).as_deref(),
            Some(meta.len() as i64),
        ) {
            record(pool, &c.id, Some(&path), Some(&msg)).await;
            continue;
        }

        match import(pool, &c, &path, &revision).await {
            Ok(rows) => {
                record(pool, &c.id, Some(&path), None).await;
                println!(
                    ">>> {} diperbarui dari server ({} baris)",
                    c.display_name, rows
                );
            }
            Err(e) => record(pool, &c.id, Some(&path), Some(&e)).await,
        }
    }

    Ok(())
}

async fn import(pool: &Pool, c: &Candidate, path: &str, revision: &str) -> Result<usize, String> {
    let selected_sheets: Vec<String> =
        serde_json::from_value(c.config.get("selectedSheets").cloned().unwrap_or_default())
            .map_err(|e| format!("Resep sync rusak: {}", e))?;
    let selected_columns: HashMap<String, Vec<String>> =
        serde_json::from_value(c.config.get("selectedColumns").cloned().unwrap_or_default())
            .map_err(|e| format!("Resep sync rusak: {}", e))?;

    let bytes = std::fs::read(path).map_err(|e| format!("{}: {}", path, e))?;

    let mut client = pool.get().await.map_err(|e| e.to_string())?;
    let (_, imported) = execute_import(
        &mut client,
        &bytes,
        &ImportSpec {
            dept: &c.dept,
            display_name: &c.display_name,
            dataset_key: &c.base_key,
            selected_sheets: &selected_sheets,
            selected_columns: &selected_columns,
            source_path: None,
            source_mtime: Some(revision),
            watched_by: None,
            created_by: None,
            strict: true,
        },
    )
    .await?;

    let _ = c.key;
    Ok(imported)
}
