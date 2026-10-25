use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub mod commands;
pub mod db;

pub struct DbState(pub Mutex<Connection>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            std::fs::create_dir_all(&app_dir)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            let db_path = app_dir.join("writr.db");
            let conn = db::init_db(&db_path)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            app.manage(DbState(Mutex::new(conn)));

            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_reference_document,
            commands::save_reference_chunks,
            commands::hybrid_search_chunks,
            commands::list_reference_documents,
            commands::delete_reference_document,
            commands::upsert_user_profile,
            commands::read_file_text,
            commands::read_file_bytes,
            commands::fetch_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
