use std::{
    env, fs,
    path::{Path, PathBuf},
};

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is unavailable"));
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is unavailable"));
    let default_payload = manifest_dir.join("../../src-tauri/target/release/md-code.exe");
    let payload_path = env::var_os("MD_CODE_PAYLOAD")
        .map(PathBuf::from)
        .unwrap_or(default_payload);
    let embedded_payload = out_dir.join("md-code-payload.exe");

    println!("cargo:rerun-if-env-changed=MD_CODE_PAYLOAD");
    println!("cargo:rerun-if-changed={}", payload_path.display());

    if Path::new(&payload_path).is_file() {
        fs::copy(&payload_path, &embedded_payload)
            .expect("failed to copy the MD Code executable into the installer");
        println!("cargo:rustc-env=MD_CODE_PAYLOAD_AVAILABLE=1");
    } else {
        fs::write(&embedded_payload, [])
            .expect("failed to create the development payload placeholder");
        println!(
            "cargo:warning=MD Code payload not found at {}; installer commands will only work after the main app is built",
            payload_path.display()
        );
        println!("cargo:rustc-env=MD_CODE_PAYLOAD_AVAILABLE=0");
    }

    tauri_build::build();
}
