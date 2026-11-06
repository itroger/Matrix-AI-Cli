use crate::agent::types::{ChatRequest, Part, Role, UIMessage};
use crate::AgentEvent;
use futures_util::StreamExt;
use reqwest::Client;
use tokio::sync::mpsc;

pub async fn chat_stream(
    url: &str,
    history: &[(Role, String)],
    input: &str,
    tx: mpsc::UnboundedSender<AgentEvent>,
) {
    let client = Client::new();
    let mut messages: Vec<UIMessage> = history
        .iter()
        .enumerate()
        .map(|(i, (role, text))| UIMessage {
            id: i.to_string(),
            role: *role,
            parts: vec![Part {
                part_type: "text".to_string(),
                text: text.clone(),
            }],
        })
        .collect();
    let next_id = messages.len().to_string();
    messages.push(UIMessage {
        id: next_id,
        role: Role::User,
        parts: vec![Part {
            part_type: "text".to_string(),
            text: input.to_string(),
        }],
    });
    let req = ChatRequest {
        messages,
        prefer_cloud: false,
    };

    let res = match client
        .post(format!("{}/api/chat", url))
        .json(&req)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let _ = tx.send(AgentEvent::Error(e.to_string()));
            return;
        }
    };

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        let _ = tx.send(AgentEvent::Error(format!("Agent 返回 {}: {}", status, body)));
        return;
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk = match chunk {
            Ok(c) => c,
            Err(_) => continue,
        };
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(pos) = buffer.find('\n') {
            let line: String = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();
            if line.is_empty() || !line.starts_with("data:") {
                continue;
            }
            let data = line[5..].trim();
            if data == "[DONE]" {
                let _ = tx.send(AgentEvent::Done);
                return;
            }
            let evt: crate::agent::types::StreamEvent = match serde_json::from_str(data) {
                Ok(e) => e,
                Err(_) => continue,
            };
            match evt.event_type.as_str() {
                "text-delta" => {
                    let text = evt.delta.or(evt.text_delta).unwrap_or_default();
                    if !text.is_empty() {
                        let _ = tx.send(AgentEvent::Delta(text));
                    }
                }
                "error" => {
                    let msg = evt.error_text.unwrap_or_else(|| "未知错误".to_string());
                    let _ = tx.send(AgentEvent::Error(format!("Agent 流错误: {}", msg)));
                    return;
                }
                "finish" => {
                    let _ = tx.send(AgentEvent::Done);
                    return;
                }
                _ => {}
            }
        }
    }
    let _ = tx.send(AgentEvent::Done);
}
