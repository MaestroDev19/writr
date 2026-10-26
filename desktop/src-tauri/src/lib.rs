use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::OpenFlags;
use tauri::Manager;

pub mod commands;
pub mod db;

pub type DbPool = Pool<SqliteConnectionManager>;

pub struct DbState(pub DbPool);

impl DbState {
    pub fn get(&self) -> Result<r2d2::PooledConnection<SqliteConnectionManager>, String> {
        self.0.get().map_err(|e| format!("Failed to acquire connection from pool: {e}"))
    }
}

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

            // 1. Register vector extensions once globally for all connections in process
            db::register_extensions();

            // 2. Initialize schema & ensure WAL mode using single connection first
            db::init_db(&db_path)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            // 3. Build r2d2 connection pool for parallel WAL reads
            let manager = SqliteConnectionManager::file(&db_path)
                .with_flags(
                    OpenFlags::SQLITE_OPEN_READ_WRITE
                        | OpenFlags::SQLITE_OPEN_CREATE
                        | OpenFlags::SQLITE_OPEN_NO_MUTEX,
                )
                .with_init(|conn| {
                    conn.execute_batch("
                        PRAGMA foreign_keys = ON;
                        PRAGMA journal_mode = WAL;
                        PRAGMA synchronous = NORMAL;
                        PRAGMA busy_timeout = 5000;
                        PRAGMA cache_size = -64000;
                        PRAGMA temp_store = MEMORY;
                        PRAGMA mmap_size = 268435456;
                    ")
                });

            let pool = Pool::builder()
                .max_size(8)
                .min_idle(Some(2))
                .build(manager)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            app.manage(DbState(pool));

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
