pub mod db;
pub mod types;
pub mod excel;
pub mod analytics;
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            let _ = dotenvy::dotenv();
            let _ = dotenvy::from_path("../.env");
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
            commands::delete_dataset,
            commands::query_widget_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
