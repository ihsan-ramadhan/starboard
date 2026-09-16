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

#[tauri::command]
fn source_file_revision(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    revision_of(&meta)
}

#[cfg(windows)]
fn mapped_drive_to_unc(path: &str) -> Option<String> {
    use std::os::windows::process::CommandExt;

    let rest = path.get(1..2)?;
    if rest != ":" {
        return None;
    }
    let letter = path.get(0..1)?;

    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "(Get-PSDrive -Name {} -ErrorAction SilentlyContinue).DisplayRoot",
                letter
            ),
        ])
        .creation_flags(0x0800_0000)
        .output()
        .ok()?;

    let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !root.starts_with("\\\\") {
        return None;
    }
    Some(format!("{}{}", root, &path[2..]))
}

#[cfg(not(windows))]
fn mapped_drive_to_unc(_path: &str) -> Option<String> {
    None
}

#[tauri::command]
fn canonical_path(path: String) -> String {
    mapped_drive_to_unc(&path).unwrap_or(path)
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
fn read_source_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            source_file_revision,
            read_source_bytes,
            canonical_path,
            machine_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
