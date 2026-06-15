use std::fmt;

#[derive(Debug)]
pub enum TorBoxError {
    /// An error returned by the TorBox API (4xx/5xx with error payload).
    Api {
        status: u16,
        error_code: String,
        detail: String,
    },
    /// Failed to parse the JSON response.
    Deserialization(String),
    /// Network / transport error from reqwest.
    Http(String),
    /// The response was a success: false but with an unrecognized format.
    UnexpectedResponse(String),
}

impl fmt::Display for TorBoxError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TorBoxError::Api {
                status,
                error_code,
                detail,
            } => write!(f, "API error {} ({}): {}", status, error_code, detail),
            TorBoxError::Deserialization(msg) => write!(f, "Deserialization error: {}", msg),
            TorBoxError::Http(msg) => write!(f, "HTTP error: {}", msg),
            TorBoxError::UnexpectedResponse(msg) => write!(f, "Unexpected response: {}", msg),
        }
    }
}

impl std::error::Error for TorBoxError {}

impl From<reqwest::Error> for TorBoxError {
    fn from(e: reqwest::Error) -> Self {
        TorBoxError::Http(e.to_string())
    }
}

impl serde::Serialize for TorBoxError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
