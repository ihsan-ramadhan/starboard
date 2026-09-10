use std::time::UNIX_EPOCH;

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

#[tauri::command]
fn source_file_revision(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    revision_of(&meta)
}

#[tauri::command]
fn machine_name() -> String {
    if let Ok(name) = std::env::var("COMPUTERNAME") {
        return name;
    }
    if let Ok(name) = std::env::var("HOSTNAME") {
        return name;
    }
    if let Ok(name) = std::fs::read_to_string("/etc/hostname") {
        let trimmed = name.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    "unknown".to_string()
}

#[tauri::command]
fn read_source_file(path: String) -> Result<SourceFile, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
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
            read_source_file,
            machine_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
