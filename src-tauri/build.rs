fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
      "load_store_json",
      "load_vault_json",
      "save_vault_json",
      "clear_plain_store",
      "load_storage_info_json",
      "start_update_installer",
    ])),
  )
  .expect("failed to build tauri app manifest");
}
