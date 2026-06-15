use crate::api::error::TorBoxError;
use crate::api::models::*;

use reqwest::multipart;

const API_BASE: &str = "https://api.torbox.app";
const API_VERSION: &str = "v1";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

pub struct TorBoxClient {
    api_key: String,
    http: reqwest::Client,
}

impl TorBoxClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            http: reqwest::Client::new(),
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn api_url(&self, path: &str) -> String {
        format!("{}/{}/api/{}", API_BASE, API_VERSION, path)
    }

    async fn extract<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<T, TorBoxError> {
        let status = response.status().as_u16();
        let body = response.text().await?;

        if status != 200 {
            if let Ok(env) =
                serde_json::from_str::<TorBoxResponse<serde_json::Value>>(&body)
            {
                return Err(TorBoxError::Api {
                    status,
                    error_code: env.error.unwrap_or_else(|| "UNKNOWN".into()),
                    detail: env.detail,
                });
            }
            return Err(TorBoxError::UnexpectedResponse(body));
        }

        match serde_json::from_str::<TorBoxResponse<T>>(&body) {
            Ok(envelope) => {
                if !envelope.success {
                    return Err(TorBoxError::Api {
                        status,
                        error_code: envelope.error.unwrap_or_else(|| "UNKNOWN".into()),
                        detail: envelope.detail,
                    });
                }
                envelope.data.ok_or_else(|| {
                    TorBoxError::UnexpectedResponse(
                        "Response success=true but data was null".into(),
                    )
                })
            }
            Err(_) => {
                // Fallback: parse as Value, then re-serialize data into T
                if let Ok(env) =
                    serde_json::from_str::<TorBoxResponse<serde_json::Value>>(&body)
                {
                    if env.success {
                        if let Some(data) = env.data {
                            let data_str = serde_json::to_string(&data)
                                .map_err(|e| TorBoxError::Deserialization(e.to_string()))?;
                            return serde_json::from_str::<T>(&data_str)
                                .map_err(|e| TorBoxError::Deserialization(e.to_string()));
                        }
                    }
                }
                Err(TorBoxError::Deserialization(
                    "Failed to deserialize response".into(),
                ))
            }
        }
    }

    /// Extract data that may be either a list or a single object.
    /// When `id` is provided, the API returns a single object instead of a list.
    async fn extract_list_or_single<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<Vec<T>, TorBoxError> {
        let status = response.status().as_u16();
        let body = response.text().await?;

        if status != 200 {
            if let Ok(env) =
                serde_json::from_str::<TorBoxResponse<serde_json::Value>>(&body)
            {
                return Err(TorBoxError::Api {
                    status,
                    error_code: env.error.unwrap_or_else(|| "UNKNOWN".into()),
                    detail: env.detail,
                });
            }
            return Err(TorBoxError::UnexpectedResponse(body));
        }

        let env =
            serde_json::from_str::<TorBoxResponse<serde_json::Value>>(&body).map_err(
                |e| TorBoxError::Deserialization(e.to_string()),
            )?;

        if !env.success {
            return Err(TorBoxError::Api {
                status,
                error_code: env.error.unwrap_or_else(|| "UNKNOWN".into()),
                detail: env.detail,
            });
        }

        let data = env.data.ok_or_else(|| {
            TorBoxError::UnexpectedResponse("Response success=true but data was null".into())
        })?;

        // Try deserializing as array first, then as single object
        if let Ok(list) = serde_json::from_value::<Vec<T>>(data.clone()) {
            Ok(list)
        } else {
            let single = serde_json::from_value::<T>(data).map_err(|e| {
                TorBoxError::Deserialization(e.to_string())
            })?;
            Ok(vec![single])
        }
    }

    // -----------------------------------------------------------------------
    // Torrents
    // -----------------------------------------------------------------------

    /// Create a torrent via magnet link (sync).
    /// POST /api/torrents/createtorrent
    pub async fn create_torrent_magnet(
        &self,
        magnet: &str,
        seed: Option<SeedPreference>,
        allow_zip: Option<bool>,
        name: Option<&str>,
        as_queued: Option<bool>,
        add_only_if_cached: Option<bool>,
    ) -> Result<CreateTorrentData, TorBoxError> {
        let mut form = reqwest::multipart::Form::new()
            .text("magnet", magnet.to_string());

        if let Some(s) = seed {
            form = form.text("seed", s.as_i32().to_string());
        }
        if let Some(az) = allow_zip {
            form = form.text("allow_zip", az.to_string());
        }
        if let Some(n) = name {
            form = form.text("name", n.to_string());
        }
        if let Some(aq) = as_queued {
            form = form.text("as_queued", aq.to_string());
        }
        if let Some(aoc) = add_only_if_cached {
            form = form.text("add_only_if_cached", aoc.to_string());
        }

        let resp = self
            .http
            .post(self.api_url("torrents/createtorrent"))
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await?;

        self.extract::<CreateTorrentData>(resp).await
    }

    /// Create a torrent from a .torrent file (sync).
    /// POST /api/torrents/createtorrent
    pub async fn create_torrent_file(
        &self,
        file_data: Vec<u8>,
        file_name: &str,
        seed: Option<SeedPreference>,
        allow_zip: Option<bool>,
        name: Option<&str>,
        as_queued: Option<bool>,
        add_only_if_cached: Option<bool>,
    ) -> Result<CreateTorrentData, TorBoxError> {
        let file_part = multipart::Part::bytes(file_data)
            .file_name(file_name.to_string())
            .mime_str("application/x-bittorrent")
            .map_err(|e| TorBoxError::Http(e.to_string()))?;

        let mut form = reqwest::multipart::Form::new()
            .part("file", file_part);

        if let Some(s) = seed {
            form = form.text("seed", s.as_i32().to_string());
        }
        if let Some(az) = allow_zip {
            form = form.text("allow_zip", az.to_string());
        }
        if let Some(n) = name {
            form = form.text("name", n.to_string());
        }
        if let Some(aq) = as_queued {
            form = form.text("as_queued", aq.to_string());
        }
        if let Some(aoc) = add_only_if_cached {
            form = form.text("add_only_if_cached", aoc.to_string());
        }

        let resp = self
            .http
            .post(self.api_url("torrents/createtorrent"))
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await?;

        self.extract::<CreateTorrentData>(resp).await
    }

    /// Create a torrent via magnet link (async / fire-and-forget).
    /// POST /api/torrents/asynccreatetorrent
    pub async fn create_torrent_async_magnet(
        &self,
        magnet: &str,
        seed: Option<SeedPreference>,
        allow_zip: Option<bool>,
        name: Option<&str>,
        as_queued: Option<bool>,
        add_only_if_cached: Option<bool>,
    ) -> Result<(), TorBoxError> {
        let mut form = reqwest::multipart::Form::new()
            .text("magnet", magnet.to_string());

        if let Some(s) = seed {
            form = form.text("seed", s.as_i32().to_string());
        }
        if let Some(az) = allow_zip {
            form = form.text("allow_zip", az.to_string());
        }
        if let Some(n) = name {
            form = form.text("name", n.to_string());
        }
        if let Some(aq) = as_queued {
            form = form.text("as_queued", aq.to_string());
        }
        if let Some(aoc) = add_only_if_cached {
            form = form.text("add_only_if_cached", aoc.to_string());
        }

        let resp = self
            .http
            .post(self.api_url("torrents/asynccreatetorrent"))
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await?;

        self.extract::<serde_json::Value>(resp).await?;
        Ok(())
    }

    /// Control a torrent (reannounce, delete, resume, stop_seeding).
    /// POST /api/torrents/controltorrent
    pub async fn control_torrent(
        &self,
        torrent_id: Option<i64>,
        operation: TorrentOperation,
        all: Option<bool>,
    ) -> Result<(), TorBoxError> {
        let body = ControlTorrentRequest {
            torrent_id,
            operation: operation.as_str().to_string(),
            all: all.unwrap_or(false),
        };

        let resp = self
            .http
            .post(self.api_url("torrents/controltorrent"))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;

        self.extract::<serde_json::Value>(resp).await?;
        Ok(())
    }

    /// Request a download link for a torrent file.
    /// GET /api/torrents/requestdl
    pub async fn request_torrent_download_link(
        &self,
        torrent_id: i64,
        file_id: Option<i64>,
        zip_link: Option<bool>,
        user_ip: Option<&str>,
        redirect: Option<bool>,
        append_name: Option<bool>,
    ) -> Result<String, TorBoxError> {
        let mut params: Vec<(&str, String)> = vec![
            ("token", self.api_key.clone()),
            ("torrent_id", torrent_id.to_string()),
        ];

        if let Some(fid) = file_id {
            params.push(("file_id", fid.to_string()));
        }
        if let Some(zl) = zip_link {
            params.push(("zip_link", zl.to_string()));
        }
        if let Some(ip) = user_ip {
            params.push(("user_ip", ip.to_string()));
        }
        if let Some(r) = redirect {
            params.push(("redirect", r.to_string()));
        }
        if let Some(an) = append_name {
            params.push(("append_name", an.to_string()));
        }

        let resp = self
            .http
            .get(self.api_url("torrents/requestdl"))
            .query(&params)
            .send()
            .await?;

        self.extract::<String>(resp).await
    }

    /// Get the user's torrent list.
    /// GET /api/torrents/mylist
    pub async fn get_torrent_list(
        &self,
        bypass_cache: Option<bool>,
        id: Option<i64>,
        offset: Option<i64>,
        limit: Option<i64>,
    ) -> Result<Vec<TorrentListData>, TorBoxError> {
        let mut params: Vec<(&str, String)> = vec![];

        if let Some(bc) = bypass_cache {
            params.push(("bypass_cache", bc.to_string()));
        }
        if let Some(i) = id {
            params.push(("id", i.to_string()));
        }
        if let Some(o) = offset {
            params.push(("offset", o.to_string()));
        }
        if let Some(l) = limit {
            params.push(("limit", l.to_string()));
        }

        let resp = self
            .http
            .get(self.api_url("torrents/mylist"))
            .bearer_auth(&self.api_key)
            .query(&params)
            .send()
            .await?;

        self.extract_list_or_single::<TorrentListData>(resp).await
    }

    // -----------------------------------------------------------------------
    // Web Downloads
    // -----------------------------------------------------------------------

    /// Create a web download from a URL.
    /// POST /api/webdl/createwebdownload
    pub async fn create_web_download(
        &self,
        link: &str,
        password: Option<&str>,
        name: Option<&str>,
        as_queued: Option<bool>,
        add_only_if_cached: Option<bool>,
    ) -> Result<CreateWebDownloadData, TorBoxError> {
        let mut form = reqwest::multipart::Form::new()
            .text("link", link.to_string());

        if let Some(pw) = password {
            form = form.text("password", pw.to_string());
        }
        if let Some(n) = name {
            form = form.text("name", n.to_string());
        }
        if let Some(aq) = as_queued {
            form = form.text("as_queued", aq.to_string());
        }
        if let Some(aoc) = add_only_if_cached {
            form = form.text("add_only_if_cached", aoc.to_string());
        }

        let resp = self
            .http
            .post(self.api_url("webdl/createwebdownload"))
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await?;

        self.extract::<CreateWebDownloadData>(resp).await
    }

    /// Control a web download.
    /// POST /api/webdl/controlwebdownload
    pub async fn control_web_download(
        &self,
        webdl_id: Option<i64>,
        operation: WebDownloadOperation,
        all: Option<bool>,
    ) -> Result<(), TorBoxError> {
        let body = ControlWebDownloadRequest {
            webdl_id,
            operation: operation.as_str().to_string(),
            all: all.unwrap_or(false),
        };

        let resp = self
            .http
            .post(self.api_url("webdl/controlwebdownload"))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await?;

        self.extract::<serde_json::Value>(resp).await?;
        Ok(())
    }

    /// Request a download link for a web download file.
    /// GET /api/webdl/requestdl
    pub async fn request_web_download_link(
        &self,
        web_id: i64,
        file_id: Option<i64>,
        zip_link: Option<bool>,
        user_ip: Option<&str>,
        redirect: Option<bool>,
        append_name: Option<bool>,
    ) -> Result<String, TorBoxError> {
        let mut params: Vec<(&str, String)> = vec![
            ("token", self.api_key.clone()),
            ("web_id", web_id.to_string()),
        ];

        if let Some(fid) = file_id {
            params.push(("file_id", fid.to_string()));
        }
        if let Some(zl) = zip_link {
            params.push(("zip_link", zl.to_string()));
        }
        if let Some(ip) = user_ip {
            params.push(("user_ip", ip.to_string()));
        }
        if let Some(r) = redirect {
            params.push(("redirect", r.to_string()));
        }
        if let Some(an) = append_name {
            params.push(("append_name", an.to_string()));
        }

        let resp = self
            .http
            .get(self.api_url("webdl/requestdl"))
            .query(&params)
            .send()
            .await?;

        self.extract::<String>(resp).await
    }

    /// Get the user's web download list.
    /// GET /api/webdl/mylist
    pub async fn get_web_download_list(
        &self,
        bypass_cache: Option<bool>,
        id: Option<i64>,
        offset: Option<i64>,
        limit: Option<i64>,
    ) -> Result<Vec<WebDownloadListData>, TorBoxError> {
        let mut params: Vec<(&str, String)> = vec![];

        if let Some(bc) = bypass_cache {
            params.push(("bypass_cache", bc.to_string()));
        }
        if let Some(i) = id {
            params.push(("id", i.to_string()));
        }
        if let Some(o) = offset {
            params.push(("offset", o.to_string()));
        }
        if let Some(l) = limit {
            params.push(("limit", l.to_string()));
        }

        let resp = self
            .http
            .get(self.api_url("webdl/mylist"))
            .bearer_auth(&self.api_key)
            .query(&params)
            .send()
            .await?;

        self.extract_list_or_single::<WebDownloadListData>(resp).await
    }

    /// Check if web downloads are cached.
    /// GET /api/webdl/checkcached
    pub async fn check_cached_web_downloads(
        &self,
        hashes: &[String],
        format: Option<&str>,
        list_files: Option<bool>,
    ) -> Result<serde_json::Value, TorBoxError> {
        let hash_param = hashes.join(",");
        let fmt = format.unwrap_or("object");

        let mut params: Vec<(&str, String)> = vec![
            ("hash", hash_param),
            ("format", fmt.to_string()),
        ];

        if let Some(lf) = list_files {
            params.push(("list_files", lf.to_string()));
        }

        let resp = self
            .http
            .get(self.api_url("webdl/checkcached"))
            .bearer_auth(&self.api_key)
            .query(&params)
            .send()
            .await?;

        self.extract::<serde_json::Value>(resp).await
    }
}
