fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
      "load_store_json",
      "save_store_json",
      "search_blocks_json",
      "load_graph_json",
      "load_storage_info_json",
      "start_update_installer",
    ])),
  )
  .expect("failed to build tauri app manifest");
}
