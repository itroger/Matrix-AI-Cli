use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

#[derive(Serialize)]
pub struct Part {
    #[serde(rename = "type")]
    pub part_type: String,
    pub text: String,
}

#[derive(Serialize)]
pub struct UIMessage {
    pub id: String,
    pub role: Role,
    pub parts: Vec<Part>,
}

#[derive(Serialize)]
pub struct ChatRequest {
    pub messages: Vec<UIMessage>,
    #[serde(rename = "preferCloud")]
    pub prefer_cloud: bool,
}

#[derive(Deserialize)]
pub struct StreamEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(default)]
    pub delta: Option<String>,
    #[serde(default, rename = "textDelta")]
    pub text_delta: Option<String>,
    #[serde(default, rename = "errorText")]
    pub error_text: Option<String>,
}
