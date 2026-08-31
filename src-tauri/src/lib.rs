mod db;
mod commands;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            let _ = dotenvy::dotenv();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::login,
            commands::logout,
            commands::get_current_user,
            commands::get_datasets,
            commands::get_dataset_detail,
            commands::analyze_excel,
            commands::import_excel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
