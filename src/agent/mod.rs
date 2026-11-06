pub mod client;
pub mod types;

pub enum AgentEvent {
    Delta(String),
    Error(String),
    Done,
}
