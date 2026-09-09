#[cfg(windows)]
fn normalize_proxy(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    let selected = if value.contains('=') {
        value
            .split(';')
            .filter_map(|entry| entry.split_once('='))
            .find(|(scheme, _)| scheme.trim().eq_ignore_ascii_case("https"))
            .or_else(|| {
                value
                    .split(';')
                    .filter_map(|entry| entry.split_once('='))
                    .find(|(scheme, _)| scheme.trim().eq_ignore_ascii_case("http"))
            })
            .map(|(_, address)| address.trim())?
    } else {
        value
    };

    if selected.contains("://") {
        Some(selected.to_string())
    } else {
        Some(format!("http://{selected}"))
    }
}

#[tauri::command]
pub fn system_http_proxy() -> Option<String> {
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};

        let settings = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
            .ok()?;
        let enabled: u32 = settings.get_value("ProxyEnable").ok()?;
        if enabled == 0 {
            return None;
        }
        let server: String = settings.get_value("ProxyServer").ok()?;
        return normalize_proxy(&server);
    }

    #[cfg(not(windows))]
    None
}
