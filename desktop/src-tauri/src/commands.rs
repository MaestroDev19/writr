use crate::db;
use crate::DbState;
use tauri::State;

#[tauri::command]
pub fn save_reference_document(
    state: State<'_, DbState>,
    id: String,
    owner_id: String,
    name: String,
    chunk_count: i32,
) -> Result<(), String> {
    let clean_owner = owner_id.trim();
    if clean_owner.is_empty() {
        return Err("owner_id is required".into());
    }
    let conn = state.get()?;
    db::insert_reference_document(&conn, &id, clean_owner, &name, chunk_count)
        .map_err(|e| format!("Failed to save reference document: {e}"))
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ChunkInput {
    pub document_id: String,
    pub owner_id: Option<String>,
    pub chunk_index: i32,
    pub content: String,
    pub embedding: Vec<f32>,
    pub metadata: Option<serde_json::Value>,
}

#[tauri::command]
pub fn save_reference_chunks(
    state: State<'_, DbState>,
    chunks: Vec<ChunkInput>,
) -> Result<usize, String> {
    let mut new_chunks = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        if chunk.embedding.len() != 768 {
            return Err(format!(
                "Invalid embedding dimension for chunk {}: expected 768, got {}",
                chunk.chunk_index,
                chunk.embedding.len()
            ));
        }
        let embedding_bytes: Vec<u8> = chunk
            .embedding
            .iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();

        let metadata_str = match chunk.metadata {
            Some(v) => serde_json::to_string(&v).unwrap_or_else(|_| "{}".to_string()),
            None => "{}".to_string(),
        };

        new_chunks.push(db::NewReferenceChunk {
            document_id: chunk.document_id,
            owner_id: chunk.owner_id.map(|o| o.trim().to_string()),
            chunk_index: chunk.chunk_index,
            content: chunk.content,
            embedding: embedding_bytes,
            metadata: Some(metadata_str),
        });
    }

    let count = new_chunks.len();
    let mut conn = state.get()?;
    db::insert_reference_chunks_batch(&mut conn, &new_chunks)
        .map_err(|e| format!("Failed to batch insert reference chunks: {e}"))?;

    Ok(count)
}

#[tauri::command]
pub fn hybrid_search_chunks(
    state: State<'_, DbState>,
    query_text: String,
    query_embedding: Vec<f32>,
    limit: usize,
    owner_id: String,
    rrf_k: Option<usize>,
) -> Result<Vec<db::HybridSearchResult>, String> {
    if query_embedding.len() != 768 {
        return Err(format!(
            "Invalid query embedding dimension: expected 768, got {}",
            query_embedding.len()
        ));
    }
    let clean_owner = owner_id.trim();
    if clean_owner.is_empty() {
        return Err("owner_id is required to isolate search results by user".to_string());
    }

    let query_embedding_bytes: Vec<u8> = query_embedding
        .iter()
        .flat_map(|f| f.to_le_bytes())
        .collect();

    let conn = state.get()?;

    db::hybrid_search(
        &conn,
        &query_text,
        &query_embedding_bytes,
        limit,
        clean_owner,
        rrf_k.unwrap_or(60),
    )
    .map_err(|e| format!("Hybrid search query failed: {e}"))
}

#[tauri::command]
pub fn list_reference_documents(
    state: State<'_, DbState>,
    owner_id: String,
) -> Result<Vec<db::ReferenceDocumentSummary>, String> {
    let clean_owner = owner_id.trim();
    if clean_owner.is_empty() {
        return Err("owner_id is required".into());
    }
    let conn = state.get()?;
    db::list_reference_documents(&conn, clean_owner)
        .map_err(|e| format!("Failed to list reference documents: {e}"))
}

#[tauri::command]
pub fn delete_reference_document(
    state: State<'_, DbState>,
    document_id: String,
    owner_id: String,
) -> Result<bool, String> {
    let clean_owner = owner_id.trim();
    if clean_owner.is_empty() {
        return Err("owner_id is required".into());
    }
    let conn = state.get()?;
    db::delete_reference_document(&conn, &document_id, clean_owner)
        .map_err(|e| format!("Failed to delete reference document: {e}"))
}

#[tauri::command]
pub fn upsert_user_profile(
    state: State<'_, DbState>,
    id: String,
    author_name: String,
    avatar_url: Option<String>,
) -> Result<(), String> {
    let clean_id = id.trim();
    if clean_id.is_empty() {
        return Err("id is required".into());
    }
    let conn = state.get()?;
    db::upsert_profile(&conn, clean_id, &author_name, avatar_url.as_deref())
        .map_err(|e| format!("Failed to upsert profile: {e}"))
}

/// Validates that a file path is safe to read:
/// 1. Path is non-empty and contains no null bytes or Windows device namespaces.
/// 2. Canonicalizes path resolving any `..`, relative segments, or symlinks.
/// 3. Confirms the target is a regular file.
/// 4. Restricts file size to 50MB to prevent memory exhaustion / OOM crashes.
/// 5. Restricts file extension to allowed document formats.
fn validate_safe_file_path(raw_path: &str) -> Result<std::path::PathBuf, String> {
    let clean = raw_path.trim();
    if clean.is_empty() {
        return Err("File path cannot be empty".into());
    }

    // Reject null bytes and Windows device namespace prefixes (e.g. \\.\ or \\?\)
    if clean.contains('\0') || clean.starts_with(r"\\.\") || clean.starts_with(r"\\?\") {
        return Err("Invalid or forbidden file path".into());
    }

    let path = std::path::Path::new(clean);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Cannot access or resolve file '{clean}': {e}"))?;

    if !canonical.is_file() {
        return Err(format!(
            "Path '{}' is not a valid regular file",
            canonical.display()
        ));
    }

    // 50 MB max limit for desktop text/pdf/docx documents
    const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;
    let metadata = std::fs::metadata(&canonical)
        .map_err(|e| format!("Failed to read file metadata for '{}': {e}", canonical.display()))?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File size ({} MB) exceeds maximum allowed limit ({} MB)",
            metadata.len() / (1024 * 1024),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    // Allowed extensions check (txt, md, markdown, docx, pdf, json, rtf, csv)
    let allowed_exts = ["txt", "md", "markdown", "docx", "pdf", "json", "rtf", "csv"];
    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    if !allowed_exts.contains(&ext.as_str()) {
        return Err(format!(
            "Unsupported file extension '.{}'. Allowed formats: {}",
            ext,
            allowed_exts.join(", ")
        ));
    }

    Ok(canonical)
}

#[tauri::command]
pub fn read_file_text(path: String) -> Result<String, String> {
    let canonical = validate_safe_file_path(&path)?;
    std::fs::read_to_string(&canonical)
        .map_err(|e| format!("Failed to read text file at '{}': {e}", canonical.display()))
}

#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    let canonical = validate_safe_file_path(&path)?;
    std::fs::read(&canonical)
        .map_err(|e| format!("Failed to read file bytes at '{}': {e}", canonical.display()))
}

#[tauri::command]
pub async fn fetch_url(url: String) -> Result<String, String> {
    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err("URL cannot be empty".into());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(clean_url)
        .header(
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        .send()
        .await
        .map_err(|e| format!("Network error while fetching {clean_url}: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let reason = status.canonical_reason().unwrap_or("");
        return Err(format!(
            "Failed to fetch article: HTTP {} {}",
            status.as_u16(),
            reason
        ));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_validate_safe_file_path_valid() {
        let mut temp = tempfile::NamedTempFile::new().expect("temp file");
        write!(temp, "Sample document content").expect("write temp");
        let path_str = temp.path().with_extension("txt");
        std::fs::rename(temp.path(), &path_str).expect("rename temp");

        let validated = validate_safe_file_path(path_str.to_str().unwrap());
        assert!(validated.is_ok());

        let _ = std::fs::remove_file(path_str);
    }

    #[test]
    fn test_validate_safe_file_path_disallowed_ext() {
        let mut temp = tempfile::NamedTempFile::new().expect("temp file");
        write!(temp, "executable data").expect("write temp");
        let path_str = temp.path().with_extension("exe");
        std::fs::rename(temp.path(), &path_str).expect("rename temp");

        let validated = validate_safe_file_path(path_str.to_str().unwrap());
        assert!(validated.is_err());
        assert!(validated.unwrap_err().contains("Unsupported file extension"));

        let _ = std::fs::remove_file(path_str);
    }

    #[test]
    fn test_validate_safe_file_path_rejects_empty_and_null() {
        assert!(validate_safe_file_path("").is_err());
        assert!(validate_safe_file_path("   ").is_err());
        assert!(validate_safe_file_path("document\0.txt").is_err());
    }

    #[test]
    fn test_validate_safe_file_path_rejects_directory() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let validated = validate_safe_file_path(temp_dir.path().to_str().unwrap());
        assert!(validated.is_err());
    }
}
