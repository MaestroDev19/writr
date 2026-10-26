use rusqlite::Connection;
use std::path::Path;
use std::sync::Once;
use rusqlite::ffi::sqlite3_auto_extension;
use sqlite_vec::sqlite3_vec_init;

static INIT_EXTENSIONS: Once = Once::new();

pub fn register_extensions() {
    INIT_EXTENSIONS.call_once(|| {
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute::<
                *const (),
                unsafe extern "C" fn(
                    *mut rusqlite::ffi::sqlite3,
                    *mut *mut std::os::raw::c_char,
                    *const rusqlite::ffi::sqlite3_api_routines,
                ) -> std::os::raw::c_int,
            >(sqlite3_vec_init as *const ())));
        }
    });
}

pub fn init_db(path: impl AsRef<Path>) -> rusqlite::Result<Connection> {
    register_extensions();
    let conn = Connection::open(path)?;

    // Enable security and high-performance PRAGMAs (SQL Optimization & SQLite Database Expert standards)
    conn.execute_batch("
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA cache_size = -64000;         -- 64MB memory page cache (default is 2MB)
        PRAGMA temp_store = MEMORY;          -- In-memory temporary tables, sorting, and CTEs
        PRAGMA mmap_size = 268435456;        -- 256MB memory-mapped I/O for fast read performance
        PRAGMA page_size = 4096;             -- Optimal OS page alignment
    ")?;

    create_tables(&conn)?;
    Ok(conn)
}

fn create_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            author_name TEXT NOT NULL,
            avatar_url TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reference_documents (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            name TEXT NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE
        );

        -- Index for foreign key cascades and owner document listing (ORDER BY created_at DESC)
        CREATE INDEX IF NOT EXISTS idx_reference_documents_owner_created 
            ON reference_documents(owner_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS reference_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL,
            owner_id TEXT,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB NOT NULL,
            metadata TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT reference_chunks_document_chunk_key UNIQUE (document_id, chunk_index),
            CONSTRAINT reference_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES reference_documents(id) ON DELETE CASCADE,
            CONSTRAINT reference_chunks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE,
            CONSTRAINT ck_reference_chunks_metadata_json CHECK (json_valid(metadata))
        );

        -- Partial index for foreign key cascading and owner-based chunk filtering
        CREATE INDEX IF NOT EXISTS reference_chunks_owner_id_idx 
            ON reference_chunks(owner_id) 
            WHERE owner_id IS NOT NULL;

        -- FTS5 Full-Text Search (SQLite counterpart of Postgres tsvector / GIN)
        CREATE VIRTUAL TABLE IF NOT EXISTS reference_chunks_fts USING fts5(
            content,
            content='reference_chunks',
            content_rowid='id',
            tokenize='porter unicode61 remove_diacritics 2'
        );

        -- FTS5 synchronization triggers
        CREATE TRIGGER IF NOT EXISTS reference_chunks_fts_ai AFTER INSERT ON reference_chunks BEGIN
            INSERT INTO reference_chunks_fts(rowid, content) VALUES (new.id, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS reference_chunks_fts_ad AFTER DELETE ON reference_chunks BEGIN
            INSERT INTO reference_chunks_fts(reference_chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS reference_chunks_fts_au AFTER UPDATE OF content ON reference_chunks BEGIN
            INSERT INTO reference_chunks_fts(reference_chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
            INSERT INTO reference_chunks_fts(rowid, content) VALUES (new.id, new.content);
        END;

        -- Parent inheritance triggers:
        -- 1. Validate that provided owner_id matches parent reference_documents owner_id on insert
        CREATE TRIGGER IF NOT EXISTS reference_chunks_inherit_parent_check_insert
        BEFORE INSERT ON reference_chunks
        FOR EACH ROW
        WHEN NEW.owner_id IS NOT NULL AND NEW.owner_id != (SELECT owner_id FROM reference_documents WHERE id = NEW.document_id)
        BEGIN
            SELECT RAISE(ABORT, 'reference_chunks owner_id must match parent reference_documents owner_id');
        END;

        -- 2. If owner_id is omitted (NULL) on insert, inherit owner_id from parent reference_documents
        CREATE TRIGGER IF NOT EXISTS reference_chunks_inherit_parent_ai
        AFTER INSERT ON reference_chunks
        FOR EACH ROW
        WHEN NEW.owner_id IS NULL
        BEGIN
            UPDATE reference_chunks
            SET owner_id = (SELECT owner_id FROM reference_documents WHERE id = NEW.document_id)
            WHERE id = NEW.id;
        END;

        -- 3. If owner_id is explicitly updated, ensure it matches parent reference_documents owner_id
        CREATE TRIGGER IF NOT EXISTS reference_chunks_inherit_parent_check_update_owner
        BEFORE UPDATE OF owner_id ON reference_chunks
        FOR EACH ROW
        WHEN NEW.owner_id IS NOT NULL AND NEW.owner_id != (SELECT owner_id FROM reference_documents WHERE id = NEW.document_id)
        BEGIN
            SELECT RAISE(ABORT, 'reference_chunks owner_id must match parent reference_documents owner_id');
        END;

        -- 4. If document_id is updated, automatically re-inherit owner_id from the new parent document
        CREATE TRIGGER IF NOT EXISTS reference_chunks_inherit_parent_au_doc
        AFTER UPDATE OF document_id ON reference_chunks
        FOR EACH ROW
        BEGIN
            UPDATE reference_chunks
            SET owner_id = (SELECT owner_id FROM reference_documents WHERE id = NEW.document_id)
            WHERE id = NEW.id;
        END;

        -- Vector index via sqlite-vec (vec0 virtual table) with owner_id partition key
        -- Partition key physically isolates vectors per user, preventing KNN leakage and speeding up queries
        CREATE VIRTUAL TABLE IF NOT EXISTS reference_chunks_vec USING vec0(
            id INTEGER PRIMARY KEY,
            owner_id TEXT PARTITION KEY,
            embedding float[768] distance_metric=cosine
        );

        -- Synchronization triggers for sqlite-vec
        CREATE TRIGGER IF NOT EXISTS reference_chunks_vec_ai AFTER INSERT ON reference_chunks BEGIN
            INSERT INTO reference_chunks_vec(id, owner_id, embedding)
            VALUES (
                new.id,
                COALESCE(new.owner_id, (SELECT owner_id FROM reference_documents WHERE id = new.document_id)),
                new.embedding
            );
        END;

        CREATE TRIGGER IF NOT EXISTS reference_chunks_vec_ad AFTER DELETE ON reference_chunks BEGIN
            DELETE FROM reference_chunks_vec WHERE id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS reference_chunks_vec_au AFTER UPDATE OF embedding, owner_id ON reference_chunks BEGIN
            DELETE FROM reference_chunks_vec WHERE id = old.id;
            INSERT INTO reference_chunks_vec(id, owner_id, embedding)
            VALUES (
                new.id,
                COALESCE(new.owner_id, (SELECT owner_id FROM reference_documents WHERE id = new.document_id)),
                new.embedding
            );
        END;
    ")?;

    Ok(())
}

/// Upserts a user profile into SQLite mirror matching Supabase profiles.
pub fn upsert_profile(
    conn: &Connection,
    id: &str,
    author_name: &str,
    avatar_url: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO profiles (id, author_name, avatar_url, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
             author_name = excluded.author_name,
             avatar_url = excluded.avatar_url,
             updated_at = CURRENT_TIMESTAMP",
        rusqlite::params![id, author_name, avatar_url],
    )?;
    Ok(())
}

/// Inserts or updates a reference document.
pub fn insert_reference_document(
    conn: &Connection,
    id: &str,
    owner_id: &str,
    name: &str,
    chunk_count: i32,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO reference_documents (id, owner_id, name, chunk_count)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             chunk_count = excluded.chunk_count",
        rusqlite::params![id, owner_id, name, chunk_count],
    )?;
    Ok(())
}

/// Summary of a reference document.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReferenceDocumentSummary {
    pub id: String,
    pub owner_id: String,
    pub name: String,
    pub chunk_count: i32,
    pub created_at: String,
}

/// Lists reference documents for an owner.
pub fn list_reference_documents(
    conn: &Connection,
    owner_id: &str,
) -> rusqlite::Result<Vec<ReferenceDocumentSummary>> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, owner_id, name, chunk_count, created_at
         FROM reference_documents
         WHERE owner_id = ?1
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(rusqlite::params![owner_id], |row| {
        Ok(ReferenceDocumentSummary {
            id: row.get(0)?,
            owner_id: row.get(1)?,
            name: row.get(2)?,
            chunk_count: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

/// Deletes a reference document owned by owner_id.
pub fn delete_reference_document(
    conn: &Connection,
    document_id: &str,
    owner_id: &str,
) -> rusqlite::Result<bool> {
    let affected = conn.execute(
        "DELETE FROM reference_documents WHERE id = ?1 AND owner_id = ?2",
        rusqlite::params![document_id, owner_id],
    )?;
    Ok(affected > 0)
}

/// DTO for inserting a reference chunk in batch.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NewReferenceChunk {
    pub document_id: String,
    pub owner_id: Option<String>,
    pub chunk_index: i32,
    pub content: String,
    pub embedding: Vec<u8>,
    pub metadata: Option<String>,
}

/// Optimized batch insert for reference chunks within a single transaction.
pub fn insert_reference_chunks_batch(
    conn: &mut Connection,
    chunks: &[NewReferenceChunk],
) -> rusqlite::Result<()> {
    if chunks.is_empty() {
        return Ok(());
    }

    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare_cached(
            "INSERT INTO reference_chunks (document_id, owner_id, chunk_index, content, embedding, metadata)
             VALUES (?1, COALESCE(?2, (SELECT owner_id FROM reference_documents WHERE id = ?1)), ?3, ?4, ?5, COALESCE(?6, '{}'))",
        )?;

        for chunk in chunks {
            stmt.execute(rusqlite::params![
                chunk.document_id,
                chunk.owner_id,
                chunk.chunk_index,
                chunk.content,
                chunk.embedding,
                chunk.metadata,
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Hybrid search result combining semantic distance and keyword BM25 score.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HybridSearchResult {
    pub id: i64,
    pub document_id: String,
    pub document_name: String,
    pub owner_id: String,
    pub chunk_index: i32,
    pub content: String,
    pub metadata: String,
    pub score: f64,
}

/// Sanitizes raw user input into a safe FTS5 query with quoted alphanumeric terms.
pub fn sanitize_fts_query(query: &str) -> String {
    let terms: Vec<String> = query
        .split_whitespace()
        .filter_map(|w| {
            let clean: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_')
                .collect();
            if clean.is_empty() {
                None
            } else {
                Some(format!("\"{}\"", clean))
            }
        })
        .collect();

    terms.join(" OR ")
}

/// Optimized hybrid search combining FTS5 and sqlite-vec with Reciprocal Rank Fusion (RRF),
/// strictly isolated to `owner_id` partition to prevent cross-user data leakage on shared devices.
pub fn hybrid_search(
    conn: &Connection,
    query_text: &str,
    query_embedding: &[u8],
    limit: usize,
    owner_id: &str,
    rrf_k: usize,
) -> rusqlite::Result<Vec<HybridSearchResult>> {
    let clean_owner_id = owner_id.trim();
    if clean_owner_id.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "owner_id is required to isolate search by user".to_string(),
        ));
    }

    let sanitized_text = sanitize_fts_query(query_text);

    if sanitized_text.is_empty() {
        let mut stmt = conn.prepare_cached(
            "SELECT
                c.id,
                c.document_id,
                d.name,
                c.owner_id,
                c.chunk_index,
                c.content,
                c.metadata,
                (1.0 / (?4 + v.rank_ix)) AS score
            FROM (
                SELECT
                    v.id,
                    ROW_NUMBER() OVER (ORDER BY v.distance ASC) AS rank_ix
                FROM reference_chunks_vec v
                WHERE v.embedding MATCH ?1
                  AND v.owner_id = ?2
                  AND v.k = ?3
            ) v
            JOIN reference_chunks c ON c.id = v.id
            JOIN reference_documents d ON d.id = c.document_id
            WHERE c.owner_id = ?2
            ORDER BY score DESC
            LIMIT ?3;"
        )?;

        let rows = stmt.query_map(
            rusqlite::params![
                query_embedding,
                clean_owner_id,
                limit as i64,
                rrf_k as f64,
            ],
            |row| {
                Ok(HybridSearchResult {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    document_name: row.get(2)?,
                    owner_id: row.get(3)?,
                    chunk_index: row.get(4)?,
                    content: row.get(5)?,
                    metadata: row.get(6)?,
                    score: row.get(7)?,
                })
            },
        )?;

        return rows.collect();
    }

    let mut stmt = conn.prepare_cached(
        "WITH params AS (
            SELECT ?1 AS q_text, ?2 AS q_vec, ?3 AS lim, ?4 AS owner_filter, ?5 AS k_val
        ),
        fts_matches AS (
            SELECT
                c.id,
                ROW_NUMBER() OVER (ORDER BY bm25(reference_chunks_fts) ASC) AS rank_ix
            FROM reference_chunks_fts f
            JOIN reference_chunks c ON c.id = f.rowid
            WHERE (SELECT q_text FROM params) != ''
              AND reference_chunks_fts MATCH (SELECT q_text FROM params)
              AND c.owner_id = (SELECT owner_filter FROM params)
            LIMIT (SELECT lim * 2 FROM params)
        ),
        vec_matches AS (
            SELECT
                v.id,
                ROW_NUMBER() OVER (ORDER BY v.distance ASC) AS rank_ix
            FROM reference_chunks_vec v
            WHERE v.embedding MATCH (SELECT q_vec FROM params)
              AND v.owner_id = (SELECT owner_filter FROM params)
              AND v.k = (SELECT lim * 2 FROM params)
        ),
        combined AS (
            SELECT
                COALESCE(f.id, v.id) AS id,
                (COALESCE(1.0 / ((SELECT k_val FROM params) + f.rank_ix), 0.0) +
                 COALESCE(1.0 / ((SELECT k_val FROM params) + v.rank_ix), 0.0)) AS score
            FROM fts_matches f
            FULL OUTER JOIN vec_matches v ON f.id = v.id
        )
        SELECT
            c.id,
            c.document_id,
            d.name,
            c.owner_id,
            c.chunk_index,
            c.content,
            c.metadata,
            comb.score
        FROM combined comb
        JOIN reference_chunks c ON c.id = comb.id
        JOIN reference_documents d ON d.id = c.document_id
        WHERE c.owner_id = (SELECT owner_filter FROM params)
        ORDER BY comb.score DESC
        LIMIT (SELECT lim FROM params);"
    )?;

    let rows = stmt.query_map(
        rusqlite::params![
            sanitized_text,
            query_embedding,
            limit as i64,
            clean_owner_id,
            rrf_k as i64,
        ],
        |row| {
            Ok(HybridSearchResult {
                id: row.get(0)?,
                document_id: row.get(1)?,
                document_name: row.get(2)?,
                owner_id: row.get(3)?,
                chunk_index: row.get(4)?,
                content: row.get(5)?,
                metadata: row.get(6)?,
                score: row.get(7)?,
            })
        },
    )?;

    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        register_extensions();
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("
            PRAGMA foreign_keys = ON;
        ").unwrap();
        create_tables(&conn).unwrap();
        conn
    }

    #[test]
    fn test_schema_fts_and_vector_sync() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO profiles (id, author_name) VALUES ('usr-1', 'Jane Austen')",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-10', 'usr-1', 'Pride and Prejudice', 1)",
            [],
        ).unwrap();

        let mut dummy_vector = vec![0.0f32; 768];
        dummy_vector[0] = 1.0; // Give first dimension a value
        let dummy_bytes: &[u8] = unsafe {
            std::slice::from_raw_parts(
                dummy_vector.as_ptr() as *const u8,
                dummy_vector.len() * std::mem::size_of::<f32>(),
            )
        };

        conn.execute(
            "INSERT INTO reference_chunks (id, document_id, owner_id, chunk_index, content, embedding, metadata)
             VALUES (100, 'doc-10', 'usr-1', 0, 'It is a truth universally acknowledged...', ?1, '{\"chapter\": 1}')",
            [dummy_bytes],
        ).unwrap();

        // 1. FTS5 search verification
        let mut fts_stmt = conn.prepare(
            "SELECT rowid FROM reference_chunks_fts WHERE reference_chunks_fts MATCH 'truth'"
        ).unwrap();
        let rowid: i64 = fts_stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(rowid, 100);

        // 2. Vector search verification (sqlite-vec KNN match partitioned by owner_id)
        let mut vec_stmt = conn.prepare(
            "SELECT id, distance FROM reference_chunks_vec WHERE embedding MATCH ?1 AND owner_id = 'usr-1' AND k = 1"
        ).unwrap();
        let (matched_id, distance): (i64, f32) = vec_stmt.query_row([dummy_bytes], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).unwrap();
        assert_eq!(matched_id, 100);
        assert!(distance < 0.001, "Distance should be very close to 0 for exact match");

        // 3. Cascade delete parent document should delete chunk, FTS entry, and vector entry
        conn.execute("DELETE FROM reference_documents WHERE id = 'doc-10'", []).unwrap();
        let count: i64 = conn.query_row("SELECT count(*) FROM reference_chunks", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);

        let vec_count: i64 = conn.query_row("SELECT count(*) FROM reference_chunks_vec", [], |r| r.get(0)).unwrap();
        assert_eq!(vec_count, 0);
    }

    #[test]
    fn test_inherit_parent_triggers() {
        let conn = setup_test_db();

        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-1', 'User 1')", []).unwrap();
        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-2', 'User 2')", []).unwrap();
        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-1', 'usr-1', 'Doc 1', 0)", []).unwrap();
        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-2', 'usr-2', 'Doc 2', 0)", []).unwrap();

        let dummy_bytes = vec![0u8; 768 * 4];

        // 1. Inserting chunk with mismatched owner_id (usr-2 instead of usr-1) should be rejected
        let err = conn.execute(
            "INSERT INTO reference_chunks (document_id, owner_id, chunk_index, content, embedding)
             VALUES ('doc-1', 'usr-2', 0, 'some content', ?1)",
            [&dummy_bytes],
        );
        assert!(err.is_err(), "Mismatched owner_id should be rejected");

        // 2. Inserting chunk with owner_id = NULL should automatically inherit parent's owner_id ('usr-1')
        conn.execute(
            "INSERT INTO reference_chunks (id, document_id, owner_id, chunk_index, content, embedding)
             VALUES (50, 'doc-1', NULL, 0, 'inherited content', ?1)",
            [&dummy_bytes],
        ).unwrap();

        let inherited_owner_id: String = conn.query_row(
            "SELECT owner_id FROM reference_chunks WHERE id = 50",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(inherited_owner_id, "usr-1", "owner_id should have been inherited from Doc 1");

        // 3. Updating document_id from doc-1 to doc-2 should update owner_id from usr-1 to usr-2
        conn.execute(
            "UPDATE reference_chunks SET document_id = 'doc-2' WHERE id = 50",
            [],
        ).unwrap();

        let updated_owner_id: String = conn.query_row(
            "SELECT owner_id FROM reference_chunks WHERE id = 50",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(updated_owner_id, "usr-2", "owner_id should update when document_id changes");
    }

    #[test]
    fn test_unique_document_chunk_index_constraint() {
        let conn = setup_test_db();

        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-1', 'User 1')", []).unwrap();
        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-1', 'usr-1', 'Doc 1', 0)", []).unwrap();

        let dummy_bytes = vec![0u8; 768 * 4];

        conn.execute(
            "INSERT INTO reference_chunks (document_id, owner_id, chunk_index, content, embedding)
             VALUES ('doc-1', 'usr-1', 0, 'chunk 0', ?1)",
            [&dummy_bytes],
        ).unwrap();

        // Inserting chunk with the same document_id and chunk_index should fail
        let duplicate_err = conn.execute(
            "INSERT INTO reference_chunks (document_id, owner_id, chunk_index, content, embedding)
             VALUES ('doc-1', 'usr-1', 0, 'chunk 0 duplicate', ?1)",
            [&dummy_bytes],
        );
        assert!(duplicate_err.is_err(), "Duplicate (document_id, chunk_index) must violate unique constraint");
    }

    #[test]
    fn test_batch_insert_and_hybrid_search() {
        let mut conn = setup_test_db();

        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-1', 'H.G. Wells')", []).unwrap();
        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-1', 'usr-1', 'The Time Machine', 2)", []).unwrap();

        let mut vec1 = vec![0.0f32; 768];
        vec1[0] = 1.0;
        let mut vec2 = vec![0.0f32; 768];
        vec2[1] = 1.0;

        let vec1_bytes = unsafe {
            std::slice::from_raw_parts(vec1.as_ptr() as *const u8, vec1.len() * 4)
        }.to_vec();

        let vec2_bytes = unsafe {
            std::slice::from_raw_parts(vec2.as_ptr() as *const u8, vec2.len() * 4)
        }.to_vec();

        let chunks = vec![
            NewReferenceChunk {
                document_id: "doc-1".to_string(),
                owner_id: None, // Will be inherited
                chunk_index: 0,
                content: "The Time Traveller was expounding a recondite matter to us.".to_string(),
                embedding: vec1_bytes.clone(),
                metadata: Some("{\"chapter\": 1}".to_string()),
            },
            NewReferenceChunk {
                document_id: "doc-1".to_string(),
                owner_id: Some("usr-1".to_string()),
                chunk_index: 1,
                content: "The thing the Time Traveller held in his hand was a glittering metallic framework.".to_string(),
                embedding: vec2_bytes.clone(),
                metadata: Some("{\"chapter\": 2}".to_string()),
            },
        ];

        // 1. Batch insert execution
        insert_reference_chunks_batch(&mut conn, &chunks).unwrap();

        let count: i64 = conn.query_row("SELECT count(*) FROM reference_chunks", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 2);

        // 2. Hybrid search test (FTS query 'metallic' + vector similarity with vec2) strictly filtered to owner usr-1
        let results = hybrid_search(
            &conn,
            "metallic",
            &vec2_bytes,
            5,
            "usr-1",
            50,
        ).unwrap();

        assert!(!results.is_empty(), "Hybrid search should return results");
        // Chunk index 1 has both keyword match 'metallic' and exact vector match with vec2
        assert_eq!(results[0].chunk_index, 1);
        assert_eq!(results[0].document_name, "The Time Machine");
        assert_eq!(results[0].owner_id, "usr-1");
        assert!(results[0].score > 0.0);

        // 3. Pure vector search with empty query string
        let empty_text_results = hybrid_search(
            &conn,
            "",
            &vec2_bytes,
            5,
            "usr-1",
            50,
        ).unwrap();
        assert!(!empty_text_results.is_empty(), "Pure vector search should return results when text is empty");
        assert_eq!(empty_text_results[0].chunk_index, 1);

        // 4. Pure vector search with symbols only (sanitizes to empty string)
        let symbols_text_results = hybrid_search(
            &conn,
            "?!@#$%",
            &vec2_bytes,
            5,
            "usr-1",
            50,
        ).unwrap();
        assert!(!symbols_text_results.is_empty(), "Vector search should succeed when query has only symbols");
        assert_eq!(symbols_text_results[0].chunk_index, 1);
    }

    #[test]
    fn test_multi_user_isolation_on_shared_device() {
        let mut conn = setup_test_db();

        // Simulate two users sharing the same PC: Alice and Bob
        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-alice', 'Alice')", []).unwrap();
        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-bob', 'Bob')", []).unwrap();

        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-alice', 'usr-alice', 'Alice Private Journal', 1)", []).unwrap();
        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-bob', 'usr-bob', 'Bob Pasta Recipe', 1)", []).unwrap();

        let mut alice_vec = vec![0.0f32; 768];
        alice_vec[0] = 1.0;
        let alice_bytes = unsafe {
            std::slice::from_raw_parts(alice_vec.as_ptr() as *const u8, alice_vec.len() * 4)
        }.to_vec();

        let mut bob_vec = vec![0.0f32; 768];
        bob_vec[1] = 1.0;
        let bob_bytes = unsafe {
            std::slice::from_raw_parts(bob_vec.as_ptr() as *const u8, bob_vec.len() * 4)
        }.to_vec();

        let chunks = vec![
            NewReferenceChunk {
                document_id: "doc-alice".to_string(),
                owner_id: Some("usr-alice".to_string()),
                chunk_index: 0,
                content: "Confidential financial strategy and secret plans for Q4.".to_string(),
                embedding: alice_bytes.clone(),
                metadata: Some("{\"confidential\": true}".to_string()),
            },
            NewReferenceChunk {
                document_id: "doc-bob".to_string(),
                owner_id: Some("usr-bob".to_string()),
                chunk_index: 0,
                content: "Delicious homemade tomato basil pasta recipe with olive oil.".to_string(),
                embedding: bob_bytes.clone(),
                metadata: Some("{\"dish\": \"pasta\"}".to_string()),
            },
        ];
        insert_reference_chunks_batch(&mut conn, &chunks).unwrap();

        // 1. Bob (friend on the PC) searches for "financial" or Alice's vector -> MUST RETURN 0 results
        let bob_financial_search = hybrid_search(
            &conn,
            "financial",
            &alice_bytes,
            10,
            "usr-bob",
            60,
        ).unwrap();
        assert!(
            !bob_financial_search.iter().any(|r| r.owner_id == "usr-alice" || r.document_id == "doc-alice"),
            "Bob must NEVER see Alice's confidential documents on a shared device"
        );
        assert!(
            bob_financial_search.iter().all(|r| r.owner_id == "usr-bob"),
            "All returned chunks must belong strictly to Bob"
        );

        // 2. Alice searches for "financial" -> MUST return her document
        let alice_search = hybrid_search(
            &conn,
            "financial",
            &alice_bytes,
            10,
            "usr-alice",
            60,
        ).unwrap();
        assert_eq!(alice_search.len(), 1);
        assert_eq!(alice_search[0].document_id, "doc-alice");
        assert_eq!(alice_search[0].owner_id, "usr-alice");

        // 3. Bob searches for "pasta" -> MUST return his document
        let bob_search = hybrid_search(
            &conn,
            "pasta",
            &bob_bytes,
            10,
            "usr-bob",
            60,
        ).unwrap();
        assert_eq!(bob_search.len(), 1);
        assert_eq!(bob_search[0].document_id, "doc-bob");
        assert_eq!(bob_search[0].owner_id, "usr-bob");

        // 4. Searching with empty or blank owner_id MUST fail
        let empty_owner_err = hybrid_search(&conn, "pasta", &bob_bytes, 10, "", 60);
        assert!(empty_owner_err.is_err(), "Empty owner_id must be rejected");

        let whitespace_owner_err = hybrid_search(&conn, "pasta", &bob_bytes, 10, "   ", 60);
        assert!(whitespace_owner_err.is_err(), "Whitespace owner_id must be rejected");

        // 5. Listing documents for Bob only returns Bob's documents
        let bob_docs = list_reference_documents(&conn, "usr-bob").unwrap();
        assert_eq!(bob_docs.len(), 1);
        assert_eq!(bob_docs[0].id, "doc-bob");

        // 6. Bob cannot delete Alice's document
        let bob_delete_alice = delete_reference_document(&conn, "doc-alice", "usr-bob").unwrap();
        assert!(!bob_delete_alice, "Bob cannot delete Alice's document");
        let alice_doc_still_exists = list_reference_documents(&conn, "usr-alice").unwrap();
        assert_eq!(alice_doc_still_exists.len(), 1);
    }

    #[test]
    fn test_query_plan_uses_indexes() {
        let conn = setup_test_db();

        // 1. Test index usage for reference_documents owner listing
        let mut stmt = conn.prepare(
            "EXPLAIN QUERY PLAN SELECT id, name FROM reference_documents WHERE owner_id = ?1 ORDER BY created_at DESC"
        ).unwrap();
        let plan: String = stmt.query_row(["usr-1"], |r| r.get(3)).unwrap();
        assert!(
            plan.contains("idx_reference_documents_owner_created"),
            "Query plan should use composite index: {plan}"
        );

        // 2. Test unique index usage for reference_chunks lookup
        let mut stmt2 = conn.prepare(
            "EXPLAIN QUERY PLAN SELECT id, content FROM reference_chunks WHERE document_id = ?1 ORDER BY chunk_index"
        ).unwrap();
        let plan2: String = stmt2.query_row(["doc-1"], |r| r.get(3)).unwrap();
        assert!(
            plan2.contains("reference_chunks_document_chunk_key") || plan2.contains("sqlite_autoindex"),
            "Query plan should use chunk key index: {plan2}"
        );
    }

    #[test]
    fn test_json_validation_constraint() {
        let conn = setup_test_db();

        conn.execute("INSERT INTO profiles (id, author_name) VALUES ('usr-1', 'Author')", []).unwrap();
        conn.execute("INSERT INTO reference_documents (id, owner_id, name, chunk_count) VALUES ('doc-1', 'usr-1', 'Doc', 0)", []).unwrap();

        let dummy_bytes = vec![0u8; 768 * 4];

        // Inserting invalid JSON should be rejected by the CHECK constraint
        let err = conn.execute(
            "INSERT INTO reference_chunks (document_id, owner_id, chunk_index, content, embedding, metadata)
             VALUES ('doc-1', 'usr-1', 0, 'content', ?1, 'invalid-json{')",
            [&dummy_bytes],
        );
        assert!(err.is_err(), "Invalid JSON in metadata should be rejected by CHECK constraint");
    }
}


