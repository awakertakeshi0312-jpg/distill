use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const STORE_KEY: &str = "distill.store.v1";
const VAULT_KEY: &str = "distill.vault.v1";
const VAULT_RECORD_LOG_KEY: &str = "distill.vaultRecordLog.v1";
const MAX_SYNC_PACKET_BYTES: u64 = 5 * 1024 * 1024;
const MAX_VAULT_RECORD_LOG_BYTES: u64 = 25 * 1024 * 1024;
const APP_IDENTIFIER: &str = "app.distill.local";
const WEBVIEW_CACHE_CLEANUP_MARKER: &str = "distill-webview-cache-cleanup-v2.done";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct DistillStore {
  blocks: Vec<ThoughtBlock>,
  projects: Vec<Project>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThoughtBlock {
  id: String,
  content: String,
  note_id: String,
  project_id: Option<String>,
  captured_at: String,
  updated_at: String,
  tags: Vec<String>,
  links: Vec<String>,
  state: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
struct Project {
  id: String,
  name: String,
  signal: String,
  status: String,
}

#[cfg(test)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
  block: ThoughtBlock,
  score: f64,
  reason: String,
  matched_fields: Vec<String>,
  matched_terms: Vec<String>,
}

#[cfg(test)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphSnapshot {
  nodes: Vec<GraphNode>,
  edges: Vec<GraphEdge>,
}

#[cfg(test)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphNode {
  id: String,
  label: String,
  kind: String,
  block_id: Option<String>,
}

#[cfg(test)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GraphEdge {
  source: String,
  target: String,
  edge_type: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageInfo {
  mode: String,
  path: String,
  backup_path: String,
  record_log_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncPacketFileInfo {
  file_name: String,
  path: String,
  bytes: u64,
  modified_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiOrgEventInput {
  event_type: String,
  summary: String,
  payload: serde_json::Value,
  work_packet_id: Option<String>,
  timestamp: String,
}

fn initialize_database(connection: &Connection) -> Result<(), String> {
  connection
    .execute_batch(
      "PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS app_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        signal TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        note_id TEXT NOT NULL,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        captured_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        state TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS block_tags (
        block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (block_id, tag)
      );

      CREATE TABLE IF NOT EXISTS block_links (
        block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        link TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (block_id, link)
      );

      CREATE TABLE IF NOT EXISTS people (
        name TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS block_people (
        block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        person TEXT NOT NULL REFERENCES people(name) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        PRIMARY KEY (block_id, person)
      );

      CREATE TABLE IF NOT EXISTS concepts (
        name TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS graph_edges (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        PRIMARY KEY (source_id, target_id, edge_type)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
        block_id UNINDEXED,
        content,
        tags,
        links,
        tokenize = 'unicode61'
      );",
    )
    .map_err(|error| error.to_string())
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
  let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;

  let db_path = data_dir.join("distill.sqlite3");
  let connection = Connection::open(db_path).map_err(|error| error.to_string())?;
  initialize_database(&connection)?;

  Ok(connection)
}

fn database_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  Ok(data_dir.join("distill.sqlite3"))
}

fn backup_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  Ok(data_dir.join("backups").join("distill-auto-backup-latest.json"))
}

fn encrypted_vault_backup_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  Ok(data_dir.join("backups").join("distill-encrypted-vault-latest.json"))
}

fn sync_recovery_vault_backup_folder(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  Ok(data_dir.join("backups").join("sync-recovery"))
}

#[cfg(all(desktop, target_os = "windows"))]
fn desktop_webview_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let _ = app;
  let local_app_data = std::env::var_os("LOCALAPPDATA")
    .map(PathBuf::from)
    .ok_or_else(|| "LOCALAPPDATA is not available.".to_string())?;
  Ok(local_app_data.join(APP_IDENTIFIER).join("EBWebView"))
}

#[cfg(all(desktop, not(target_os = "windows")))]
fn desktop_webview_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let local_data_dir = app.path().app_local_data_dir().map_err(|error| error.to_string())?;
  Ok(local_data_dir.join(APP_IDENTIFIER).join("EBWebView"))
}

#[cfg(desktop)]
fn is_distill_webview_cache_dir(path: &Path) -> bool {
  path.file_name().and_then(|value| value.to_str()) == Some("EBWebView")
    && path.parent().and_then(|parent| parent.file_name()).and_then(|value| value.to_str()) == Some(APP_IDENTIFIER)
}

#[cfg(desktop)]
fn clear_desktop_webview_cache_once(app: &AppHandle) -> Result<(), String> {
  let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;

  let marker = data_dir.join(WEBVIEW_CACHE_CLEANUP_MARKER);
  if marker.exists() {
    return Ok(());
  }

  let cache_dir = desktop_webview_cache_dir(app)?;
  if !is_distill_webview_cache_dir(&cache_dir) {
    return Err("Refusing to clear unexpected WebView cache path.".to_string());
  }

  if cache_dir.exists() {
    if let Err(error) = std::fs::remove_dir_all(&cache_dir) {
      eprintln!("Distill WebView cache cleanup could not remove {:?}: {error}", cache_dir);
      return Ok(());
    }
  }

  std::fs::write(marker, "distill webview cache cleanup v2\n").map_err(|error| error.to_string())
}

fn ai_org_kernel_root(app: &AppHandle) -> Result<PathBuf, String> {
  if let Ok(root) = std::env::var("AI_ORG_KERNEL_ROOT") {
    return Ok(PathBuf::from(root));
  }

  Ok(app.path().home_dir().map_err(|error| error.to_string())?.join("dev").join("active").join("ai-org-kernel"))
}

fn ai_org_event_path(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(ai_org_kernel_root(app)?.join("backend").join("org").join("event-bus").join("events.jsonl"))
}

fn org_event_actor() -> String {
  std::env::var("USERNAME")
    .or_else(|_| std::env::var("USER"))
    .unwrap_or_else(|_| "awake".to_string())
}

fn is_allowed_ai_org_event_type(event_type: &str) -> bool {
  matches!(
    event_type,
    "memory.save_requested" | "decision.created" | "artifact.ready"
  )
}

fn is_forbidden_ai_org_payload_key(key: &str) -> bool {
  matches!(
    key.to_ascii_lowercase().as_str(),
    "content"
      | "body"
      | "note_body"
      | "note_content"
      | "vault"
      | "vault_payload"
      | "encrypted_vault"
      | "passphrase"
      | "password"
      | "secret"
      | "token"
      | "export_content"
      | "export_contents"
  )
}

fn validate_ai_org_payload(value: &serde_json::Value) -> Result<(), String> {
  match value {
    serde_json::Value::Object(fields) => {
      for (key, child) in fields {
        if is_forbidden_ai_org_payload_key(key) {
          return Err(format!("AI Org event payload must not include private field `{key}`."));
        }
        validate_ai_org_payload(child)?;
      }
      Ok(())
    }
    serde_json::Value::Array(items) => {
      for item in items {
        validate_ai_org_payload(item)?;
      }
      Ok(())
    }
    _ => Ok(()),
  }
}

fn new_ai_org_event_id() -> String {
  let epoch_nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_nanos())
    .unwrap_or_default();
  format!("evt_{epoch_nanos}_{}", std::process::id())
}

fn write_encrypted_vault_backup(app: &AppHandle, value: &str) -> Result<(), String> {
  let path = encrypted_vault_backup_path(app)?;
  let parent = path
    .parent()
    .ok_or_else(|| "Could not resolve encrypted vault backup directory.".to_string())?;
  std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  std::fs::write(path, value).map_err(|error| error.to_string())
}

fn validate_encrypted_vault_json(value: &str) -> Result<(), String> {
  let parsed = serde_json::from_str::<serde_json::Value>(value).map_err(|error| error.to_string())?;

  if parsed.get("type").and_then(|field| field.as_str()) != Some("distill.encrypted-vault") {
    return Err("Value is not a Distill encrypted vault.".to_string());
  }

  Ok(())
}

fn validate_encrypted_vault_record_log_json(value: &str) -> Result<(), String> {
  if value.len() as u64 > MAX_VAULT_RECORD_LOG_BYTES {
    return Err("Vault record log is too large.".to_string());
  }

  let parsed = serde_json::from_str::<serde_json::Value>(value).map_err(|error| error.to_string())?;

  if parsed.get("type").and_then(|field| field.as_str()) != Some("distill.encrypted-vault-record-log") {
    return Err("Value is not a Distill encrypted vault record log.".to_string());
  }

  if parsed.get("schemaVersion").and_then(|field| field.as_i64()) != Some(1) {
    return Err("Unsupported Distill encrypted vault record log schema.".to_string());
  }

  if parsed.get("sourceStoreHash").and_then(|field| field.as_str()).is_none() {
    return Err("Vault record log is missing its source store hash.".to_string());
  }

  let entries = parsed
    .get("entries")
    .and_then(|field| field.as_array())
    .ok_or_else(|| "Vault record log entries are missing.".to_string())?;

  for entry in entries {
    let kind = entry.get("kind").and_then(|field| field.as_str()).unwrap_or("");
    if !matches!(
      kind,
      "project"
        | "thought-block"
        | "thought-block-deletion"
        | "sync-device"
        | "revoked-sync-device"
        | "sync-key"
    ) {
      return Err("Vault record log contains an unsupported entry kind.".to_string());
    }

    if entry.get("sequence").and_then(|field| field.as_i64()).filter(|value| *value > 0).is_none()
      || entry.get("id").and_then(|field| field.as_str()).is_none()
      || entry.get("revision").and_then(|field| field.as_str()).is_none()
      || entry.get("hash").and_then(|field| field.as_str()).is_none()
    {
      return Err("Vault record log entry metadata is invalid.".to_string());
    }

    let encrypted = entry
      .get("encrypted")
      .ok_or_else(|| "Vault record log entry encryption metadata is missing.".to_string())?;

    if encrypted.get("type").and_then(|field| field.as_str()) != Some("distill.encrypted-vault-record")
      || encrypted.get("value").and_then(|field| field.as_str()).is_none()
    {
      return Err("Vault record log entry is not a Distill encrypted vault record.".to_string());
    }
  }

  Ok(())
}

fn safe_sync_recovery_label(label: &str) -> String {
  let safe = label
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
        character
      } else {
        '-'
      }
    })
    .collect::<String>()
    .trim_matches('-')
    .chars()
    .take(64)
    .collect::<String>();

  if safe.is_empty() {
    "sync".to_string()
  } else {
    safe
  }
}

fn sync_recovery_file_name(label: &str) -> Result<String, String> {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| error.to_string())?
    .as_secs();
  Ok(format!("distill-pre-sync-{timestamp}-{}.json", safe_sync_recovery_label(label)))
}

fn write_sync_recovery_vault_backup(app: &AppHandle, value: &str, label: &str) -> Result<PathBuf, String> {
  let folder = sync_recovery_vault_backup_folder(app)?;
  std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
  let path = folder.join(sync_recovery_file_name(label)?);
  std::fs::write(&path, value).map_err(|error| error.to_string())?;
  Ok(path)
}

fn validate_update_installer_path(path: &Path) -> Result<PathBuf, String> {
  let canonical = path.canonicalize().map_err(|error| error.to_string())?;
  let file_name = canonical
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Installer path must point to a file.".to_string())?
    .to_lowercase();

  if canonical.extension().and_then(|value| value.to_str()) != Some("exe") {
    return Err("Update installer must be a Windows .exe file.".to_string());
  }

  if !is_distill_setup_file_name(&file_name) {
    return Err("Installer file name must match Distill_<version>_x64-setup.exe.".to_string());
  }

  Ok(canonical)
}

fn is_distill_setup_file_name(file_name: &str) -> bool {
  if !file_name.starts_with("distill_") || !file_name.ends_with("_x64-setup.exe") {
    return false;
  }

  let version = file_name
    .trim_start_matches("distill_")
    .trim_end_matches("_x64-setup.exe");
  let parts = version.split('.').collect::<Vec<_>>();

  parts.len() == 3 && parts.iter().all(|part| !part.is_empty() && part.chars().all(|character| character.is_ascii_digit()))
}

fn is_distill_sync_packet_file_name(file_name: &str) -> bool {
  file_name.starts_with("distill-sync-")
    && file_name.ends_with(".distill-sync.json")
    && file_name.chars().all(|character| {
      character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
    })
}

fn is_distill_sync_recovery_file_name(file_name: &str) -> bool {
  file_name.starts_with("distill-pre-sync-")
    && file_name.ends_with(".json")
    && file_name.chars().all(|character| {
      character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
    })
}

fn validate_sync_packet_file_name(file_name: &str) -> Result<(), String> {
  if file_name.is_empty() || Path::new(file_name).components().count() != 1 {
    return Err("Sync packet file name must not include directories.".to_string());
  }

  if !is_distill_sync_packet_file_name(file_name) {
    return Err("Sync packet file name must match distill-sync-*.distill-sync.json.".to_string());
  }

  Ok(())
}

fn validate_encrypted_sync_packet_json(value: &str) -> Result<(), String> {
  if value.len() as u64 > MAX_SYNC_PACKET_BYTES {
    return Err("Sync packet is too large.".to_string());
  }

  let parsed = serde_json::from_str::<serde_json::Value>(value).map_err(|error| error.to_string())?;

  if parsed.get("type").and_then(|field| field.as_str()) != Some("distill.encrypted-sync.packet") {
    return Err("Value is not a Distill encrypted sync packet.".to_string());
  }

  if parsed.get("schemaVersion").and_then(|field| field.as_i64()) != Some(1) {
    return Err("Unsupported Distill encrypted sync packet schema.".to_string());
  }

  Ok(())
}

fn ensure_sync_folder(path: &Path) -> Result<PathBuf, String> {
  std::fs::create_dir_all(path).map_err(|error| error.to_string())?;
  let canonical = path.canonicalize().map_err(|error| error.to_string())?;

  if !canonical.is_dir() {
    return Err("Sync folder path must point to a directory.".to_string());
  }

  Ok(canonical)
}

fn sync_packet_modified_at(metadata: &std::fs::Metadata) -> String {
  metadata
    .modified()
    .ok()
    .and_then(|timestamp| timestamp.duration_since(UNIX_EPOCH).ok())
    .map(|duration| duration.as_secs().to_string())
    .unwrap_or_else(|| "0".to_string())
}

fn quarantine_sync_packet_file(file_path: &Path) -> Result<PathBuf, String> {
  let canonical = file_path.canonicalize().map_err(|error| error.to_string())?;
  let metadata = canonical.metadata().map_err(|error| error.to_string())?;

  if !metadata.is_file() {
    return Err("Sync packet path must point to a file.".to_string());
  }

  if metadata.len() > MAX_SYNC_PACKET_BYTES {
    return Err("Sync packet is too large.".to_string());
  }

  let file_name = canonical
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Sync packet path must point to a file.".to_string())?;
  validate_sync_packet_file_name(file_name)?;

  let parent = canonical
    .parent()
    .ok_or_else(|| "Sync packet path must have a parent folder.".to_string())?;
  let quarantine_folder = parent.join(".distill-quarantine");
  std::fs::create_dir_all(&quarantine_folder).map_err(|error| error.to_string())?;

  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| error.to_string())?
    .as_secs();
  let mut candidate = quarantine_folder.join(format!("quarantined-{timestamp}-{file_name}"));
  let mut counter = 1;

  while candidate.exists() {
    candidate = quarantine_folder.join(format!("quarantined-{timestamp}-{counter}-{file_name}"));
    counter += 1;
  }

  std::fs::rename(&canonical, &candidate).map_err(|error| error.to_string())?;
  Ok(candidate)
}

fn list_sync_packet_files(folder_path: &Path) -> Result<Vec<SyncPacketFileInfo>, String> {
  let folder = ensure_sync_folder(folder_path)?;
  let mut files = Vec::new();

  for entry in std::fs::read_dir(folder).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let metadata = entry.metadata().map_err(|error| error.to_string())?;

    if !metadata.is_file() || metadata.len() > MAX_SYNC_PACKET_BYTES {
      continue;
    }

    let file_name = entry.file_name().to_string_lossy().to_string();

    if !is_distill_sync_packet_file_name(&file_name) {
      continue;
    }

    files.push(SyncPacketFileInfo {
      file_name,
      path: entry.path().display().to_string(),
      bytes: metadata.len(),
      modified_at: sync_packet_modified_at(&metadata),
    });
  }

  files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at).then_with(|| a.file_name.cmp(&b.file_name)));
  Ok(files)
}

fn list_sync_recovery_vault_files_in_folder(folder_path: &Path) -> Result<Vec<SyncPacketFileInfo>, String> {
  if !folder_path.exists() {
    return Ok(Vec::new());
  }

  let folder = folder_path.canonicalize().map_err(|error| error.to_string())?;

  if !folder.is_dir() {
    return Err("Sync recovery folder path must point to a directory.".to_string());
  }

  let mut files = Vec::new();

  for entry in std::fs::read_dir(folder).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let metadata = entry.metadata().map_err(|error| error.to_string())?;

    if !metadata.is_file() || metadata.len() > MAX_SYNC_PACKET_BYTES {
      continue;
    }

    let file_name = entry.file_name().to_string_lossy().to_string();

    if !is_distill_sync_recovery_file_name(&file_name) {
      continue;
    }

    files.push(SyncPacketFileInfo {
      file_name,
      path: entry.path().display().to_string(),
      bytes: metadata.len(),
      modified_at: sync_packet_modified_at(&metadata),
    });
  }

  files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at).then_with(|| a.file_name.cmp(&b.file_name)));
  Ok(files)
}

fn read_sync_recovery_vault_file_from_folder(folder_path: &Path, file_path: &Path) -> Result<String, String> {
  let folder = folder_path.canonicalize().map_err(|error| error.to_string())?;
  let canonical = file_path.canonicalize().map_err(|error| error.to_string())?;

  if !canonical.starts_with(&folder) {
    return Err("Sync recovery snapshot must stay inside the recovery backup folder.".to_string());
  }

  let metadata = canonical.metadata().map_err(|error| error.to_string())?;

  if !metadata.is_file() {
    return Err("Sync recovery snapshot path must point to a file.".to_string());
  }

  if metadata.len() > MAX_SYNC_PACKET_BYTES {
    return Err("Sync recovery snapshot is too large.".to_string());
  }

  let file_name = canonical
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Sync recovery snapshot path must point to a file.".to_string())?;

  if !is_distill_sync_recovery_file_name(file_name) {
    return Err("Sync recovery snapshot file name must match distill-pre-sync-*.json.".to_string());
  }

  let value = std::fs::read_to_string(canonical).map_err(|error| error.to_string())?;
  validate_encrypted_vault_json(&value)?;
  Ok(value)
}

fn normalized_store_exists(connection: &Connection) -> Result<bool, String> {
  let block_count: i64 = connection
    .query_row("SELECT COUNT(*) FROM blocks", [], |row| row.get(0))
    .map_err(|error| error.to_string())?;

  let project_count: i64 = connection
    .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
    .map_err(|error| error.to_string())?;

  Ok(block_count > 0 || project_count > 0)
}

fn load_block_edges(connection: &Connection, block: &mut ThoughtBlock) -> Result<(), String> {
  block.tags = connection
    .prepare("SELECT tag FROM block_tags WHERE block_id = ?1 ORDER BY position ASC")
    .map_err(|error| error.to_string())?
    .query_map(params![block.id], |row| row.get(0))
    .map_err(|error| error.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| error.to_string())?;

  block.links = connection
    .prepare("SELECT link FROM block_links WHERE block_id = ?1 ORDER BY position ASC")
    .map_err(|error| error.to_string())?
    .query_map(params![block.id], |row| row.get(0))
    .map_err(|error| error.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| error.to_string())?;

  Ok(())
}

fn load_normalized_store(connection: &Connection) -> Result<DistillStore, String> {
  let projects = {
    let mut statement = connection
      .prepare("SELECT id, name, signal, status FROM projects ORDER BY name ASC")
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        Ok(Project {
          id: row.get(0)?,
          name: row.get(1)?,
          signal: row.get(2)?,
          status: row.get(3)?,
        })
      })
      .map_err(|error| error.to_string())?;

    rows
      .collect::<Result<Vec<_>, _>>()
      .map_err(|error| error.to_string())?
  };

  let mut blocks = {
    let mut statement = connection
      .prepare(
        "SELECT id, content, note_id, project_id, captured_at, updated_at, state
         FROM blocks
         ORDER BY captured_at DESC",
      )
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        Ok(ThoughtBlock {
          id: row.get(0)?,
          content: row.get(1)?,
          note_id: row.get(2)?,
          project_id: row.get(3)?,
          captured_at: row.get(4)?,
          updated_at: row.get(5)?,
          tags: Vec::new(),
          links: Vec::new(),
          state: row.get(6)?,
        })
      })
      .map_err(|error| error.to_string())?;

    rows
      .collect::<Result<Vec<_>, _>>()
      .map_err(|error| error.to_string())?
  };

  for block in &mut blocks {
    load_block_edges(connection, block)?;
  }

  Ok(DistillStore { blocks, projects })
}

#[cfg(test)]
fn is_active_block(block: &ThoughtBlock) -> bool {
  block.state != "archived"
}

#[cfg(test)]
fn push_unique(values: &mut Vec<String>, value: String) {
  let trimmed = value.trim();
  if !trimmed.is_empty() && !values.iter().any(|current| current == trimmed) {
    values.push(trimmed.to_string());
  }
}

#[cfg(test)]
fn extract_people(block: &ThoughtBlock) -> Vec<String> {
  let mut people = Vec::new();
  let mut chars = block.content.chars().peekable();

  while let Some(character) = chars.next() {
    if character != '@' {
      continue;
    }

    let mut person = String::new();
    while let Some(next) = chars.peek() {
      if next.is_alphanumeric() || *next == '_' || *next == '-' {
        person.push(*next);
        chars.next();
      } else {
        break;
      }
    }

    push_unique(&mut people, person);
  }

  for link in &block.links {
    let lower = link.to_lowercase();
    if lower.starts_with("person:") {
      push_unique(&mut people, link[7..].to_string());
    } else if lower.starts_with("people/") {
      push_unique(&mut people, link[7..].to_string());
    }
  }

  people
}

#[cfg(test)]
fn save_normalized_store(connection: &mut Connection, store: &DistillStore) -> Result<(), String> {
  let transaction = connection.transaction().map_err(|error| error.to_string())?;

  transaction
    .execute("DELETE FROM graph_edges", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM block_people", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM people", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM concepts", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM block_tags", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM block_links", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM blocks_fts", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM blocks", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM projects", [])
    .map_err(|error| error.to_string())?;

  {
    let mut insert_project = transaction
      .prepare(
        "INSERT INTO projects (id, name, signal, status, updated_at)
         VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)",
      )
      .map_err(|error| error.to_string())?;

    for project in &store.projects {
      insert_project
        .execute(params![project.id, project.name, project.signal, project.status])
        .map_err(|error| error.to_string())?;
    }
  }

  {
    let mut insert_block = transaction
      .prepare(
        "INSERT INTO blocks (id, content, note_id, project_id, captured_at, updated_at, state)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      )
      .map_err(|error| error.to_string())?;

    let mut insert_tag = transaction
      .prepare("INSERT INTO block_tags (block_id, tag, position) VALUES (?1, ?2, ?3)")
      .map_err(|error| error.to_string())?;

    let mut insert_link = transaction
      .prepare("INSERT INTO block_links (block_id, link, position) VALUES (?1, ?2, ?3)")
      .map_err(|error| error.to_string())?;

    let mut insert_fts = transaction
      .prepare("INSERT INTO blocks_fts (block_id, content, tags, links) VALUES (?1, ?2, ?3, ?4)")
      .map_err(|error| error.to_string())?;

    let mut insert_person = transaction
      .prepare(
        "INSERT INTO people (name, updated_at)
         VALUES (?1, CURRENT_TIMESTAMP)
         ON CONFLICT(name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
      )
      .map_err(|error| error.to_string())?;

    let mut insert_block_person = transaction
      .prepare("INSERT INTO block_people (block_id, person, position) VALUES (?1, ?2, ?3)")
      .map_err(|error| error.to_string())?;

    let mut insert_concept = transaction
      .prepare(
        "INSERT INTO concepts (name, updated_at)
         VALUES (?1, CURRENT_TIMESTAMP)
         ON CONFLICT(name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
      )
      .map_err(|error| error.to_string())?;

    let mut insert_graph_edge = transaction
      .prepare("INSERT OR IGNORE INTO graph_edges (source_id, target_id, edge_type) VALUES (?1, ?2, ?3)")
      .map_err(|error| error.to_string())?;

    for block in &store.blocks {
      insert_block
        .execute(params![
          block.id,
          block.content,
          block.note_id,
          block.project_id,
          block.captured_at,
          block.updated_at,
          block.state
        ])
        .map_err(|error| error.to_string())?;

      for (position, tag) in block.tags.iter().enumerate() {
        insert_tag
          .execute(params![block.id, tag, position as i64])
          .map_err(|error| error.to_string())?;
      }

      for (position, link) in block.links.iter().enumerate() {
        insert_link
          .execute(params![block.id, link, position as i64])
          .map_err(|error| error.to_string())?;
      }

      insert_fts
        .execute(params![
          block.id,
          block.content,
          block.tags.join(" "),
          block.links.join(" ")
        ])
        .map_err(|error| error.to_string())?;

      if is_active_block(block) {
        if let Some(project_id) = &block.project_id {
          insert_graph_edge
            .execute(params![block.id, project_id, "project"])
            .map_err(|error| error.to_string())?;
        }

        for (position, person) in extract_people(block).iter().enumerate() {
          insert_person
            .execute(params![person])
            .map_err(|error| error.to_string())?;
          insert_block_person
            .execute(params![block.id, person, position as i64])
            .map_err(|error| error.to_string())?;
          insert_graph_edge
            .execute(params![block.id, format!("person:{person}"), "person"])
            .map_err(|error| error.to_string())?;
        }

        for link in &block.links {
          insert_concept
            .execute(params![link])
            .map_err(|error| error.to_string())?;
          insert_graph_edge
            .execute(params![block.id, format!("concept:{link}"), "concept"])
            .map_err(|error| error.to_string())?;
        }
      }
    }
  }

  transaction.commit().map_err(|error| error.to_string())?;
  Ok(())
}

fn clear_plain_store_data(connection: &mut Connection) -> Result<(), String> {
  let transaction = connection.transaction().map_err(|error| error.to_string())?;

  transaction
    .execute("DELETE FROM graph_edges", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM block_people", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM people", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM concepts", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM block_tags", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM block_links", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM blocks_fts", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM blocks", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM projects", [])
    .map_err(|error| error.to_string())?;
  transaction
    .execute("DELETE FROM app_store WHERE key = ?1", params![STORE_KEY])
    .map_err(|error| error.to_string())?;

  transaction.commit().map_err(|error| error.to_string())
}

#[cfg(test)]
fn search_terms(query: &str) -> Vec<String> {
  query
    .split_whitespace()
    .map(|term| {
      term
        .chars()
        .filter(|character| character.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
    })
    .filter(|term| !term.is_empty())
    .collect::<Vec<_>>()
}

#[cfg(test)]
fn semantic_aliases(term: &str) -> Vec<&'static str> {
  match term {
    "remember" | "remembering" => vec!["resurfaced", "recall", "revisit", "memory"],
    "trust" => vec!["explain", "reason", "evidence", "confidence"],
    "reliable" => vec!["trust", "evidence", "confidence"],
    "context" => vec!["daily", "note", "project", "meeting"],
    "ownership" => vec!["local", "export", "portable", "backup"],
    "backup" => vec!["export", "restore", "portable", "json"],
    "meaning" => vec!["semantic", "retrieval", "context"],
    "semantic" => vec!["meaning", "retrieval", "context"],
    "retrieval" => vec!["search", "semantic", "resurfaced"],
    "思い出す" => vec!["検索", "意味", "再発見"],
    "信頼" => vec!["説明", "理由", "根拠"],
    "文脈" => vec!["日次", "ノート", "プロジェクト"],
    _ => Vec::new(),
  }
}

#[cfg(test)]
fn expanded_search_terms(terms: &[String]) -> Vec<String> {
  let mut expanded = Vec::new();

  for term in terms {
    push_unique(&mut expanded, term.to_string());
    for alias in semantic_aliases(term) {
      push_unique(&mut expanded, alias.to_string());
    }
  }

  expanded
}

#[cfg(test)]
fn semantic_match_terms(block: &ThoughtBlock, terms: &[String]) -> Vec<String> {
  let profile = search_terms(&format!(
    "{} {} {}",
    block.content,
    block.tags.join(" "),
    block.links.join(" ")
  ));
  terms
    .iter()
    .filter(|term| profile.iter().any(|profile_term| profile_term.contains(term.as_str())))
    .cloned()
    .collect::<Vec<_>>()
}

#[cfg(test)]
fn fts_query(query: &str) -> Option<String> {
  let terms = search_terms(query)
    .into_iter()
    .map(|term| format!("{term}*"))
    .collect::<Vec<_>>();

  if terms.is_empty() {
    return None;
  }

  Some(terms.join(" OR "))
}

#[cfg(test)]
fn search_match_details(block: &ThoughtBlock, terms: &[String]) -> (Vec<String>, Vec<String>) {
  let content = block.content.to_lowercase();
  let tags = block
    .tags
    .iter()
    .map(|tag| tag.to_lowercase())
    .collect::<Vec<_>>();
  let links = block
    .links
    .iter()
    .map(|link| link.to_lowercase())
    .collect::<Vec<_>>();

  let content_match = terms.iter().any(|term| content.contains(term));
  let tag_match = terms
    .iter()
    .any(|term| tags.iter().any(|tag| tag.contains(term)));
  let link_match = terms
    .iter()
    .any(|term| links.iter().any(|link| link.contains(term)));

  let mut matched_fields = Vec::new();
  if content_match {
    matched_fields.push("content".to_string());
  }
  if tag_match {
    matched_fields.push("tags".to_string());
  }
  if link_match {
    matched_fields.push("links".to_string());
  }

  let mut matched_terms = terms
    .iter()
    .filter(|term| {
      content.contains(term.as_str())
        || tags.iter().any(|tag| tag.contains(term.as_str()))
        || links.iter().any(|link| link.contains(term.as_str()))
    })
    .cloned()
    .collect::<Vec<_>>();

  matched_terms.sort();
  matched_terms.dedup();

  (matched_fields, matched_terms)
}

#[tauri::command]
fn load_store_json(app: AppHandle) -> Result<Option<String>, String> {
  let connection = open_database(&app)?;

  if normalized_store_exists(&connection)? {
    return serde_json::to_string(&load_normalized_store(&connection)?)
      .map(Some)
      .map_err(|error| error.to_string());
  }

  connection
    .query_row(
      "SELECT value FROM app_store WHERE key = ?1",
      params![STORE_KEY],
      |row| row.get(0),
    )
    .optional()
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_vault_json(app: AppHandle) -> Result<Option<String>, String> {
  let connection = open_database(&app)?;

  connection
    .query_row(
      "SELECT value FROM app_store WHERE key = ?1",
      params![VAULT_KEY],
      |row| row.get(0),
    )
    .optional()
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_vault_json(app: AppHandle, value: String) -> Result<(), String> {
  let connection = open_database(&app)?;
  validate_encrypted_vault_json(&value)?;

  connection
    .execute(
      "INSERT INTO app_store (key, value, updated_at)
       VALUES (?1, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP",
      params![VAULT_KEY, value],
    )
    .map_err(|error| error.to_string())?;

  write_encrypted_vault_backup(&app, &value)?;

  Ok(())
}

#[tauri::command]
fn load_vault_record_log_json(app: AppHandle) -> Result<Option<String>, String> {
  let connection = open_database(&app)?;

  connection
    .query_row(
      "SELECT value FROM app_store WHERE key = ?1",
      params![VAULT_RECORD_LOG_KEY],
      |row| row.get(0),
    )
    .optional()
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_vault_record_log_json(app: AppHandle, value: String) -> Result<(), String> {
  let connection = open_database(&app)?;
  validate_encrypted_vault_record_log_json(&value)?;

  connection
    .execute(
      "INSERT INTO app_store (key, value, updated_at)
       VALUES (?1, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP",
      params![VAULT_RECORD_LOG_KEY, value],
    )
    .map_err(|error| error.to_string())?;

  Ok(())
}

#[tauri::command]
fn save_sync_recovery_vault_json(app: AppHandle, value: String, label: String) -> Result<String, String> {
  validate_encrypted_vault_json(&value)?;
  Ok(write_sync_recovery_vault_backup(&app, &value, &label)?.display().to_string())
}

#[tauri::command]
fn list_sync_recovery_vault_files(app: AppHandle) -> Result<String, String> {
  serde_json::to_string(&list_sync_recovery_vault_files_in_folder(&sync_recovery_vault_backup_folder(&app)?))
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn read_sync_recovery_vault_file(app: AppHandle, file_path: String) -> Result<String, String> {
  read_sync_recovery_vault_file_from_folder(&sync_recovery_vault_backup_folder(&app)?, Path::new(&file_path))
}

#[tauri::command]
fn clear_plain_store(app: AppHandle) -> Result<(), String> {
  let mut connection = open_database(&app)?;
  clear_plain_store_data(&mut connection)?;

  match std::fs::remove_file(backup_path(&app)?) {
    Ok(()) => Ok(()),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(error) => Err(error.to_string()),
  }
}

#[cfg(test)]
fn search_normalized_blocks(connection: &Connection, query: &str) -> Result<Vec<SearchResult>, String> {
  if !normalized_store_exists(connection)? {
    return Ok(Vec::new());
  }

  let Some(match_query) = fts_query(query) else {
    let store = load_normalized_store(connection)?;
    return Ok(store
      .blocks
      .into_iter()
      .take(5)
      .map(|block| SearchResult {
        block,
        score: 1.0,
        reason: "Recent capture".to_string(),
        matched_fields: Vec::new(),
        matched_terms: Vec::new(),
      })
      .collect::<Vec<_>>());
  };

  let mut statement = connection
    .prepare(
      "SELECT b.id, b.content, b.note_id, b.project_id, b.captured_at, b.updated_at, b.state, bm25(blocks_fts) AS rank
       FROM blocks_fts
       JOIN blocks b ON b.id = blocks_fts.block_id
       WHERE blocks_fts MATCH ?1
       ORDER BY rank ASC
       LIMIT 20",
    )
    .map_err(|error| error.to_string())?;

  let rows = statement
    .query_map(params![match_query], |row| {
      Ok((
        ThoughtBlock {
          id: row.get(0)?,
          content: row.get(1)?,
          note_id: row.get(2)?,
          project_id: row.get(3)?,
          captured_at: row.get(4)?,
          updated_at: row.get(5)?,
          tags: Vec::new(),
          links: Vec::new(),
          state: row.get(6)?,
        },
        row.get::<_, f64>(7)?,
      ))
    })
    .map_err(|error| error.to_string())?;

  let terms = search_terms(query);
  let expanded_terms = expanded_search_terms(&terms);
  let mut results = Vec::new();

  for row in rows {
    let (mut block, rank) = row.map_err(|error| error.to_string())?;
    load_block_edges(connection, &mut block)?;
    let (matched_fields, matched_terms) = search_match_details(&block, &terms);
    let semantic_terms = semantic_match_terms(&block, &expanded_terms);
    let semantic_hits = semantic_terms
      .iter()
      .filter(|term| !matched_terms.contains(term))
      .cloned()
      .collect::<Vec<_>>();
    let mut fields = matched_fields;
    if !semantic_hits.is_empty() && !fields.contains(&"semantic".to_string()) {
      fields.push("semantic".to_string());
    }
    let mut all_terms = matched_terms;
    for term in semantic_terms {
      push_unique(&mut all_terms, term);
    }
    results.push(SearchResult {
      block,
      score: rank.abs() + semantic_hits.len() as f64,
      reason: if semantic_hits.is_empty() {
        "FTS match - content/tags/links".to_string()
      } else {
        "FTS match - content/tags/links - Semantic overlap".to_string()
      },
      matched_fields: fields,
      matched_terms: all_terms,
    });
  }

  let existing_ids = results
    .iter()
    .map(|result| result.block.id.clone())
    .collect::<std::collections::HashSet<_>>();
  let store = load_normalized_store(connection)?;

  for block in store.blocks {
    if existing_ids.contains(&block.id) {
      continue;
    }

    let semantic_terms = semantic_match_terms(&block, &expanded_terms);
    if semantic_terms.is_empty() {
      continue;
    }

    results.push(SearchResult {
      block,
      score: semantic_terms.len() as f64,
      reason: "Semantic overlap".to_string(),
      matched_fields: vec!["semantic".to_string()],
      matched_terms: semantic_terms,
    });
  }

  results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
  results.truncate(20);

  Ok(results)
}

#[cfg(test)]
fn short_graph_label(content: &str) -> String {
  let mut label = content.chars().take(34).collect::<String>();
  if content.chars().count() > 34 {
    label.push_str("...");
  }
  label
}

#[cfg(test)]
fn load_graph_snapshot(connection: &Connection) -> Result<GraphSnapshot, String> {
  if !normalized_store_exists(connection)? {
    return Ok(GraphSnapshot {
      nodes: Vec::new(),
      edges: Vec::new(),
    });
  }

  let mut nodes = Vec::new();

  {
    let mut statement = connection
      .prepare(
        "SELECT id, content
         FROM blocks
         WHERE state != 'archived'
         ORDER BY captured_at DESC
         LIMIT 12",
      )
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        let id = row.get::<_, String>(0)?;
        let content = row.get::<_, String>(1)?;
        Ok(GraphNode {
          id: id.clone(),
          label: short_graph_label(&content),
          kind: "block".to_string(),
          block_id: Some(id),
        })
      })
      .map_err(|error| error.to_string())?;

    nodes.extend(
      rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?,
    );
  }

  {
    let mut statement = connection
      .prepare(
        "SELECT DISTINCT p.id, p.name
         FROM projects p
         JOIN blocks b ON b.project_id = p.id
         WHERE b.state != 'archived'
         ORDER BY p.name ASC",
      )
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        Ok(GraphNode {
          id: row.get(0)?,
          label: row.get(1)?,
          kind: "project".to_string(),
          block_id: None,
        })
      })
      .map_err(|error| error.to_string())?;

    nodes.extend(
      rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?,
    );
  }

  {
    let mut statement = connection
      .prepare(
        "SELECT p.name, MIN(bp.block_id) AS first_block_id, COUNT(*) AS mention_count
         FROM people p
         JOIN block_people bp ON bp.person = p.name
         GROUP BY p.name
         ORDER BY mention_count DESC, p.name ASC
         LIMIT 8",
      )
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        let name = row.get::<_, String>(0)?;
        Ok(GraphNode {
          id: format!("person:{name}"),
          label: format!("@{name}"),
          kind: "person".to_string(),
          block_id: row.get(1)?,
        })
      })
      .map_err(|error| error.to_string())?;

    nodes.extend(
      rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?,
    );
  }

  {
    let mut statement = connection
      .prepare("SELECT name FROM concepts ORDER BY name ASC LIMIT 12")
      .map_err(|error| error.to_string())?;

    let rows = statement
      .query_map([], |row| {
        let name = row.get::<_, String>(0)?;
        Ok(GraphNode {
          id: format!("concept:{name}"),
          label: name,
          kind: "concept".to_string(),
          block_id: None,
        })
      })
      .map_err(|error| error.to_string())?;

    nodes.extend(
      rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?,
    );
  }

  let node_ids = nodes
    .iter()
    .map(|node| node.id.as_str())
    .collect::<std::collections::HashSet<_>>();

  let mut statement = connection
    .prepare("SELECT source_id, target_id, edge_type FROM graph_edges ORDER BY source_id, target_id, edge_type")
    .map_err(|error| error.to_string())?;

  let edges = statement
    .query_map([], |row| {
      Ok(GraphEdge {
        source: row.get(0)?,
        target: row.get(1)?,
        edge_type: row.get(2)?,
      })
    })
    .map_err(|error| error.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| error.to_string())?
    .into_iter()
    .filter(|edge| node_ids.contains(edge.source.as_str()) && node_ids.contains(edge.target.as_str()))
    .collect::<Vec<_>>();

  Ok(GraphSnapshot { nodes, edges })
}

#[tauri::command]
fn load_storage_info_json(app: AppHandle) -> Result<String, String> {
  let info = StorageInfo {
    mode: "encrypted-vault".to_string(),
    path: database_path(&app)?.display().to_string(),
    backup_path: encrypted_vault_backup_path(&app)?.display().to_string(),
    record_log_path: format!("{}:{}", database_path(&app)?.display(), VAULT_RECORD_LOG_KEY),
  };

  serde_json::to_string(&info).map_err(|error| error.to_string())
}

#[tauri::command]
fn start_update_installer(app: AppHandle, installer_path: String) -> Result<(), String> {
  let installer = validate_update_installer_path(Path::new(&installer_path))?;
  std::process::Command::new(installer)
    .spawn()
    .map_err(|error| error.to_string())?;
  app.exit(0);
  Ok(())
}

#[tauri::command]
fn write_encrypted_sync_packet_file(folder_path: String, file_name: String, packet_json: String) -> Result<String, String> {
  validate_sync_packet_file_name(&file_name)?;
  validate_encrypted_sync_packet_json(&packet_json)?;

  let folder = ensure_sync_folder(Path::new(&folder_path))?;
  let packet_path = folder.join(file_name);
  std::fs::write(&packet_path, packet_json).map_err(|error| error.to_string())?;

  Ok(packet_path.display().to_string())
}

#[tauri::command]
fn list_encrypted_sync_packet_files(folder_path: String) -> Result<String, String> {
  serde_json::to_string(&list_sync_packet_files(Path::new(&folder_path))?).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_encrypted_sync_packet_file(file_path: String) -> Result<String, String> {
  let canonical = Path::new(&file_path).canonicalize().map_err(|error| error.to_string())?;
  let metadata = canonical.metadata().map_err(|error| error.to_string())?;

  if !metadata.is_file() {
    return Err("Sync packet path must point to a file.".to_string());
  }

  if metadata.len() > MAX_SYNC_PACKET_BYTES {
    return Err("Sync packet is too large.".to_string());
  }

  let file_name = canonical
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| "Sync packet path must point to a file.".to_string())?;
  validate_sync_packet_file_name(file_name)?;

  let packet_json = std::fs::read_to_string(canonical).map_err(|error| error.to_string())?;
  validate_encrypted_sync_packet_json(&packet_json)?;
  Ok(packet_json)
}

#[tauri::command]
fn quarantine_encrypted_sync_packet_file(file_path: String) -> Result<String, String> {
  Ok(quarantine_sync_packet_file(Path::new(&file_path))?.display().to_string())
}

#[tauri::command]
fn emit_ai_org_event(app: AppHandle, event: AiOrgEventInput) -> Result<(), String> {
  if !is_allowed_ai_org_event_type(&event.event_type) {
    return Err("Unsupported AI Org event type.".to_string());
  }

  let summary = event.summary.trim();
  if summary.is_empty() {
    return Err("AI Org event summary is required.".to_string());
  }
  if summary.len() > 240 {
    return Err("AI Org event summary must be 240 characters or less.".to_string());
  }
  validate_ai_org_payload(&event.payload)?;

  let event_path = ai_org_event_path(&app)?;
  if let Some(parent) = event_path.parent() {
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }

  let source = std::env::current_dir()
    .map(|path| path.display().to_string())
    .unwrap_or_else(|_| "distill".to_string());
  let mut payload = serde_json::Map::new();
  if let serde_json::Value::Object(fields) = event.payload {
    payload.extend(fields);
  }
  if let Some(work_packet_id) = event.work_packet_id {
    payload.insert("work_packet_id".to_string(), json!(work_packet_id));
  }

  let record = json!({
    "id": new_ai_org_event_id(),
    "timestamp": event.timestamp,
    "type": event.event_type,
    "project": "distill",
    "summary": summary,
    "source": source,
    "actor": org_event_actor(),
    "payload": serde_json::Value::Object(payload),
  });

  let mut file = std::fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(event_path)
    .map_err(|error| error.to_string())?;
  writeln!(file, "{record}").map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn test_connection() -> Connection {
    let connection = Connection::open_in_memory().expect("open in-memory sqlite");
    initialize_database(&connection).expect("initialize schema");
    connection
  }

  fn sample_store() -> DistillStore {
    DistillStore {
      projects: vec![Project {
        id: "project-search".to_string(),
        name: "Search".to_string(),
        signal: "Meaning retrieval".to_string(),
        status: "Active".to_string(),
      }],
      blocks: vec![
        ThoughtBlock {
          id: "b-1".to_string(),
          content: "Semantic search should explain trust with @Aki".to_string(),
          note_id: "daily-2026-05-06".to_string(),
          project_id: Some("project-search".to_string()),
          captured_at: "2026-05-06T10:00:00.000Z".to_string(),
          updated_at: "2026-05-06T10:00:00.000Z".to_string(),
          tags: vec!["search".to_string(), "trust".to_string()],
          links: vec!["Semantic Retrieval".to_string(), "Person: Mina".to_string()],
          state: "linked".to_string(),
        },
        ThoughtBlock {
          id: "b-2".to_string(),
          content: "Daily note keeps context".to_string(),
          note_id: "daily-2026-05-05".to_string(),
          project_id: None,
          captured_at: "2026-05-05T10:00:00.000Z".to_string(),
          updated_at: "2026-05-05T10:00:00.000Z".to_string(),
          tags: vec!["daily".to_string()],
          links: vec!["Context".to_string()],
          state: "open".to_string(),
        },
      ],
    }
  }

  #[cfg(desktop)]
  #[test]
  fn accepts_only_distill_webview_cache_cleanup_target() {
    assert!(is_distill_webview_cache_dir(
      &PathBuf::from("app.distill.local").join("EBWebView")
    ));
    assert!(!is_distill_webview_cache_dir(
      &PathBuf::from("app.distill.local").join("distill.sqlite3")
    ));
    assert!(!is_distill_webview_cache_dir(
      &PathBuf::from("other.app").join("EBWebView")
    ));
  }

  #[test]
  fn saves_and_loads_normalized_store_with_edges() {
    let mut connection = test_connection();
    let store = sample_store();

    save_normalized_store(&mut connection, &store).expect("save store");
    let loaded = load_normalized_store(&connection).expect("load store");

    assert_eq!(loaded.projects, store.projects);
    assert_eq!(loaded.blocks.len(), 2);
    assert_eq!(loaded.blocks[0].id, "b-1");
    assert_eq!(loaded.blocks[0].tags, vec!["search", "trust"]);
    assert_eq!(loaded.blocks[0].links, vec!["Semantic Retrieval", "Person: Mina"]);
  }

  #[test]
  fn clears_plain_store_tables_and_legacy_json_without_touching_vault() {
    let mut connection = test_connection();
    let store = sample_store();

    save_normalized_store(&mut connection, &store).expect("save store");
    connection
      .execute(
        "INSERT INTO app_store (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        params![STORE_KEY, "{\"blocks\":[],\"projects\":[]}"],
      )
      .expect("insert legacy store json");
    connection
      .execute(
        "INSERT INTO app_store (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        params![VAULT_KEY, "{\"type\":\"distill.encrypted-vault\"}"],
      )
      .expect("insert encrypted vault");

    clear_plain_store_data(&mut connection).expect("clear plaintext store");

    assert!(!normalized_store_exists(&connection).expect("normalized store check"));

    let legacy_json = connection
      .query_row(
        "SELECT value FROM app_store WHERE key = ?1",
        params![STORE_KEY],
        |row| row.get::<_, String>(0),
      )
      .optional()
      .expect("query legacy json");
    let vault_json = connection
      .query_row(
        "SELECT value FROM app_store WHERE key = ?1",
        params![VAULT_KEY],
        |row| row.get::<_, String>(0),
      )
      .optional()
      .expect("query vault json");

    assert!(legacy_json.is_none());
    assert_eq!(vault_json.as_deref(), Some("{\"type\":\"distill.encrypted-vault\"}"));
  }

  #[test]
  fn saves_people_concepts_and_graph_edges_for_active_blocks() {
    let mut connection = test_connection();
    save_normalized_store(&mut connection, &sample_store()).expect("save store");

    let people = connection
      .prepare("SELECT name FROM people ORDER BY name ASC")
      .expect("prepare people query")
      .query_map([], |row| row.get::<_, String>(0))
      .expect("query people")
      .collect::<Result<Vec<_>, _>>()
      .expect("collect people");

    let concepts = connection
      .prepare("SELECT name FROM concepts ORDER BY name ASC")
      .expect("prepare concepts query")
      .query_map([], |row| row.get::<_, String>(0))
      .expect("query concepts")
      .collect::<Result<Vec<_>, _>>()
      .expect("collect concepts");

    let graph_edges = connection
      .prepare("SELECT source_id, target_id, edge_type FROM graph_edges ORDER BY source_id, target_id, edge_type")
      .expect("prepare graph query")
      .query_map([], |row| {
        Ok((
          row.get::<_, String>(0)?,
          row.get::<_, String>(1)?,
          row.get::<_, String>(2)?,
        ))
      })
      .expect("query graph")
      .collect::<Result<Vec<_>, _>>()
      .expect("collect graph");

    assert_eq!(people, vec!["Aki", "Mina"]);
    assert!(concepts.contains(&"Semantic Retrieval".to_string()));
    assert!(graph_edges.contains(&(
      "b-1".to_string(),
      "project-search".to_string(),
      "project".to_string(),
    )));
    assert!(graph_edges.contains(&(
      "b-1".to_string(),
      "person:Aki".to_string(),
      "person".to_string(),
    )));
    assert!(graph_edges.contains(&(
      "b-1".to_string(),
      "concept:Semantic Retrieval".to_string(),
      "concept".to_string(),
    )));
  }

  #[test]
  fn searches_fts_and_returns_match_evidence() {
    let mut connection = test_connection();
    save_normalized_store(&mut connection, &sample_store()).expect("save store");

    let results = search_normalized_blocks(&connection, "semantic trust").expect("search blocks");

    assert!(!results.is_empty());
    assert_eq!(results[0].block.id, "b-1");
    assert!(results[0].reason.contains("FTS match - content/tags/links"));
    assert!(results[0].matched_fields.contains(&"content".to_string()));
    assert!(results[0].matched_fields.contains(&"tags".to_string()));
    assert!(results[0].matched_terms.contains(&"semantic".to_string()));
    assert!(results[0].matched_terms.contains(&"trust".to_string()));
  }

  #[test]
  fn searches_semantic_overlap_when_exact_words_differ() {
    let mut connection = test_connection();
    let mut store = sample_store();
    store.blocks.push(ThoughtBlock {
      id: "b-3".to_string(),
      content: "Old thoughts resurfaced during review".to_string(),
      note_id: "daily-2026-05-06".to_string(),
      project_id: None,
      captured_at: "2026-05-06T11:00:00.000Z".to_string(),
      updated_at: "2026-05-06T11:00:00.000Z".to_string(),
      tags: vec!["review".to_string()],
      links: vec![],
      state: "open".to_string(),
    });
    save_normalized_store(&mut connection, &store).expect("save store");

    let results = search_normalized_blocks(&connection, "remembering").expect("search semantic");

    assert_eq!(results[0].block.id, "b-3");
    assert!(results[0].reason.contains("Semantic overlap"));
    assert!(results[0].matched_fields.contains(&"semantic".to_string()));
    assert!(results[0].matched_terms.contains(&"resurfaced".to_string()));
  }


  #[test]
  fn empty_query_returns_recent_blocks_from_sqlite() {
    let mut connection = test_connection();
    save_normalized_store(&mut connection, &sample_store()).expect("save store");

    let results = search_normalized_blocks(&connection, "   ").expect("recent blocks");

    assert_eq!(results.len(), 2);
    assert_eq!(results[0].reason, "Recent capture");
    assert!(results[0].matched_fields.is_empty());
  }

  #[test]
  fn loads_graph_snapshot_from_persisted_relations() {
    let mut connection = test_connection();
    save_normalized_store(&mut connection, &sample_store()).expect("save store");

    let snapshot = load_graph_snapshot(&connection).expect("load graph snapshot");

    assert!(snapshot.nodes.iter().any(|node| node.id == "b-1" && node.kind == "block"));
    assert!(snapshot
      .nodes
      .iter()
      .any(|node| node.id == "person:Aki" && node.block_id.as_deref() == Some("b-1")));
    assert!(snapshot
      .nodes
      .iter()
      .any(|node| node.id == "concept:Semantic Retrieval" && node.kind == "concept"));
    assert!(snapshot.edges.iter().any(|edge| {
      edge.source == "b-1" && edge.target == "concept:Semantic Retrieval" && edge.edge_type == "concept"
    }));
  }

  #[test]
  fn tokenizes_search_query_for_prefix_fts() {
    assert_eq!(search_terms("Semantic, trust! #search"), vec!["semantic", "trust", "search"]);
    assert_eq!(fts_query("Semantic trust").as_deref(), Some("semantic* OR trust*"));
  }

  #[test]
  fn rejects_non_distill_update_installers() {
    let path = std::path::Path::new("not-an-installer.txt");

    assert!(validate_update_installer_path(path).is_err());
  }

  #[test]
  fn validates_distill_setup_file_name_shape() {
    assert!(is_distill_setup_file_name("distill_0.1.5_x64-setup.exe"));
    assert!(!is_distill_setup_file_name("distill_setup.exe"));
    assert!(!is_distill_setup_file_name("distill_0.1_x64-setup.exe"));
    assert!(!is_distill_setup_file_name("other_0.1.5_x64-setup.exe"));
  }

  #[test]
  fn validates_sync_packet_file_name_shape() {
    assert!(is_distill_sync_packet_file_name("distill-sync-2026-05-06T10-00.distill-sync.json"));
    assert!(!is_distill_sync_packet_file_name("distill-sync-2026-05-06.json"));
    assert!(!is_distill_sync_packet_file_name("../distill-sync-escape.distill-sync.json"));
    assert!(validate_sync_packet_file_name("distill-sync-device_1.distill-sync.json").is_ok());
    assert!(validate_sync_packet_file_name("nested/distill-sync-device.distill-sync.json").is_err());
  }

  #[test]
  fn validates_encrypted_sync_packet_json_shape() {
    let packet = json!({
      "type": "distill.encrypted-sync.packet",
      "schemaVersion": 1,
      "sourceDeviceId": "device-a",
      "createdAt": "2026-05-06T10:00:00.000Z",
      "records": []
    })
    .to_string();

    assert!(validate_encrypted_sync_packet_json(&packet).is_ok());
    assert!(validate_encrypted_sync_packet_json("{\"type\":\"other\"}").is_err());
  }

  #[test]
  fn validates_encrypted_vault_json_shape() {
    assert!(validate_encrypted_vault_json("{\"type\":\"distill.encrypted-vault\"}").is_ok());
    assert!(validate_encrypted_vault_json("{\"type\":\"distill.encrypted-sync.packet\"}").is_err());
  }

  #[test]
  fn validates_encrypted_vault_record_log_json_shape() {
    let log = json!({
      "type": "distill.encrypted-vault-record-log",
      "schemaVersion": 1,
      "createdAt": "2026-05-07T10:00:00.000Z",
      "sourceStoreHash": "fnv1a32:test",
      "entries": [
        {
          "sequence": 1,
          "kind": "thought-block",
          "id": "b-1",
          "revision": "2026-05-07T10:00:00.000Z",
          "hash": "fnv1a32:record",
          "encrypted": {
            "type": "distill.encrypted-vault-record",
            "value": "{\"type\":\"distill.encrypted-vault-record\"}"
          }
        }
      ]
    })
    .to_string();

    assert!(validate_encrypted_vault_record_log_json(&log).is_ok());
    assert!(validate_encrypted_vault_record_log_json("{\"type\":\"distill.encrypted-vault\"}").is_err());
  }

  #[test]
  fn sanitizes_sync_recovery_file_labels() {
    assert_eq!(safe_sync_recovery_label("phone-dev_1"), "phone-dev_1");
    assert_eq!(safe_sync_recovery_label("../phone dev!!"), "phone-dev");
    assert_eq!(safe_sync_recovery_label(""), "sync");
  }

  #[test]
  fn lists_and_reads_only_sync_recovery_vault_files() {
    let folder = std::env::temp_dir().join(format!(
      "distill-sync-recovery-test-{}",
      SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos()
    ));
    std::fs::create_dir_all(&folder).expect("create temp recovery folder");
    let recovery_path = folder.join("distill-pre-sync-1778078860-phone.json");
    let recovery_json = "{\"type\":\"distill.encrypted-vault\"}";
    std::fs::write(&recovery_path, recovery_json).expect("write recovery vault");
    std::fs::write(folder.join("distill-sync-not-recovery.distill-sync.json"), recovery_json)
      .expect("write ignored sync packet");
    std::fs::write(folder.join("notes.txt"), recovery_json).expect("write ignored file");

    let files = list_sync_recovery_vault_files_in_folder(&folder).expect("list recovery vaults");

    assert_eq!(files.len(), 1);
    assert_eq!(files[0].file_name, "distill-pre-sync-1778078860-phone.json");
    assert_eq!(
      read_sync_recovery_vault_file_from_folder(&folder, &recovery_path).expect("read recovery vault"),
      recovery_json
    );

    std::fs::remove_dir_all(folder).expect("remove temp recovery folder");
  }

  #[test]
  fn lists_only_distill_sync_packet_files() {
    let folder = std::env::temp_dir().join(format!(
      "distill-sync-test-{}",
      SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos()
    ));
    std::fs::create_dir_all(&folder).expect("create temp sync folder");
    std::fs::write(folder.join("distill-sync-a.distill-sync.json"), "{}").expect("write sync packet");
    std::fs::write(folder.join("notes.txt"), "ignore").expect("write ignored file");

    let files = list_sync_packet_files(&folder).expect("list sync packets");

    assert_eq!(files.len(), 1);
    assert_eq!(files[0].file_name, "distill-sync-a.distill-sync.json");

    std::fs::remove_dir_all(folder).expect("remove temp sync folder");
  }

  #[test]
  fn quarantines_sync_packet_files_out_of_scan_results() {
    let folder = std::env::temp_dir().join(format!(
      "distill-sync-quarantine-test-{}",
      SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos()
    ));
    std::fs::create_dir_all(&folder).expect("create temp sync folder");
    let packet_path = folder.join("distill-sync-danger.distill-sync.json");
    std::fs::write(&packet_path, "{\"type\":\"other\"}").expect("write sync packet");

    let quarantined_path = quarantine_sync_packet_file(&packet_path).expect("quarantine sync packet");

    assert!(!packet_path.exists());
    assert!(quarantined_path.exists());
    assert_eq!(
      quarantined_path.parent().and_then(|path| path.file_name()).and_then(|value| value.to_str()),
      Some(".distill-quarantine")
    );
    assert!(list_sync_packet_files(&folder).expect("list sync packets").is_empty());

    std::fs::remove_dir_all(folder).expect("remove temp sync folder");
  }

  #[test]
  fn validates_summary_only_ai_org_payloads() {
    assert!(is_allowed_ai_org_event_type("memory.save_requested"));
    assert!(is_allowed_ai_org_event_type("decision.created"));
    assert!(is_allowed_ai_org_event_type("artifact.ready"));
    assert!(!is_allowed_ai_org_event_type("thought.captured"));

    let safe = json!({
      "block": {
        "block_id": "b-1",
        "note_id": "daily-2026-05-06",
        "content_length": 42
      },
      "privacy": "summary_only_no_note_body"
    });
    let unsafe_payload = json!({
      "block": {
        "content": "Private note body must not be emitted"
      }
    });

    assert!(validate_ai_org_payload(&safe).is_ok());
    assert!(validate_ai_org_payload(&unsafe_payload).is_err());
  }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(desktop)]
      if let Err(error) = clear_desktop_webview_cache_once(app.handle()) {
        eprintln!("Distill WebView cache cleanup failed: {error}");
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      #[cfg(desktop)]
      app.handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      load_store_json,
      load_vault_json,
      save_vault_json,
      load_vault_record_log_json,
      save_vault_record_log_json,
      save_sync_recovery_vault_json,
      list_sync_recovery_vault_files,
      read_sync_recovery_vault_file,
      clear_plain_store,
      load_storage_info_json,
      start_update_installer,
        write_encrypted_sync_packet_file,
        list_encrypted_sync_packet_files,
        read_encrypted_sync_packet_file,
        quarantine_encrypted_sync_packet_file,
        emit_ai_org_event
      ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

