use tauri::State;
use crate::DbState;
use crate::db;

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
    let conn = state.0.lock().map_err(|e| e.to_string())?;
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
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
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

    let conn = state.0.lock().map_err(|e| e.to_string())?;

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
    let conn = state.0.lock().map_err(|e| e.to_string())?;
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
    let conn = state.0.lock().map_err(|e| e.to_string())?;
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
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::upsert_profile(&conn, clean_id, &author_name, avatar_url.as_deref())
        .map_err(|e| format!("Failed to upsert profile: {e}"))
}

#[tauri::command]
pub fn read_file_text(path: String) -> Result<String, String> {
    let clean_path = path.trim();
    if clean_path.is_empty() {
        return Err("File path cannot be empty".into());
    }
    std::fs::read_to_string(clean_path)
        .map_err(|e| format!("Failed to read text file at '{clean_path}': {e}"))
}

#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    let clean_path = path.trim();
    if clean_path.is_empty() {
        return Err("File path cannot be empty".into());
    }
    std::fs::read(clean_path)
        .map_err(|e| format!("Failed to read file bytes at '{clean_path}': {e}"))
}
