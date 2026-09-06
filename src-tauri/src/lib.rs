use std::time::UNIX_EPOCH;

/// Identifies a version of a file on disk. Size is folded in because network
/// shares round modification times, and a same-second edit that changes the
/// row count would otherwise look unchanged.
fn revision_of(meta: &std::fs::Metadata) -> Result<String, String> {
    let millis = meta
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    Ok(format!("{}-{}", millis, meta.len()))
}

#[derive(serde::Serialize)]
struct SourceFile {
    bytes: Vec<u8>,
    revision: String,
}

/// Cheap enough to run on a timer: it stats the file without reading it, so
/// polling a workbook on a share costs one round trip, not a few megabytes.
#[tauri::command]
fn source_file_revision(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    revision_of(&meta)
}

#[tauri::command]
fn read_source_file(path: String) -> Result<SourceFile, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    // Stat after reading. A file saved mid-read then reports the older
    // revision, so the next poll picks the change up instead of missing it.
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(SourceFile {
        bytes,
        revision: revision_of(&meta)?,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            source_file_revision,
            read_source_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
