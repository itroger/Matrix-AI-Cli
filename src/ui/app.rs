use crate::agent::types::Role;
use crate::AgentEvent;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, BorderType, Borders, Padding, Paragraph};
use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::Frame;
use tokio::sync::mpsc;

const HELP_TEXT: &str = "**Matrix AI CLI 命令**\n\n- `/help` 查看帮助\n- `/clear` 清空当前对话\n- `/exit` 或 `/quit` 退出";

pub struct App {
    pub history: Vec<(Role, String)>,
    pub blocks: Vec<(Role, String)>,
    pub current: String,
    pub input: String,
    pub loading: bool,
    pub cursor_visible: bool,
    pub should_quit: bool,
    pub spinner_index: usize,
}

impl App {
    pub fn new() -> Self {
        Self {
            history: Vec::new(),
            blocks: Vec::new(),
            current: String::new(),
            input: String::new(),
            loading: false,
            cursor_visible: true,
            should_quit: false,
            spinner_index: 0,
        }
    }

    pub fn on_tick(&mut self) {
        self.spinner_index = self.spinner_index.wrapping_add(1);
        if self.spinner_index % 5 == 0 {
            self.cursor_visible = !self.cursor_visible;
        }
    }

    pub fn handle_key(&mut self, key: KeyEvent, url: &str, agent_tx: mpsc::UnboundedSender<AgentEvent>) {
        match key.code {
            KeyCode::Enter => {
                let text = self.input.trim().to_string();
                self.input.clear();
                if text.is_empty() || self.loading {
                    return;
                }
                if text == "/exit" || text == "/quit" {
                    self.should_quit = true;
                    return;
                }
                if text == "/clear" {
                    self.blocks.clear();
                    self.history.clear();
                    self.current.clear();
                    return;
                }
                if text == "/help" {
                    self.blocks.push((Role::User, text.clone()));
                    self.blocks.push((Role::Assistant, HELP_TEXT.to_string()));
                    return;
                }
                self.blocks.push((Role::User, text.clone()));
                self.history.push((Role::User, text.clone()));
                self.loading = true;
                self.current.clear();
                let url2 = url.to_string();
                let history2 = self.history.clone();
                let tx2 = agent_tx.clone();
                tokio::spawn(async move {
                    crate::agent::client::chat_stream(&url2, &history2, &text, tx2).await;
                });
            }
            KeyCode::Backspace => {
                self.input.pop();
            }
            KeyCode::Char(c) => {
                self.input.push(c);
            }
            KeyCode::Esc => {
                self.should_quit = true;
            }
            _ => {}
        }
    }

    pub fn handle_agent_event(&mut self, evt: AgentEvent) {
        match evt {
            AgentEvent::Delta(s) => self.current.push_str(&s),
            AgentEvent::Error(e) => {
                self.loading = false;
                if !self.current.trim().is_empty() {
                    let partial = self.current.trim().to_string();
                    self.history.push((
                        Role::Assistant,
                        format!("{}\n\n[连接异常中断: {}]", partial, e),
                    ));
                }
                self.blocks
                    .push((Role::Assistant, format!("⚠️ 连接失败: {}", e)));
                self.current.clear();
            }
            AgentEvent::Done => {
                self.loading = false;
                if !self.current.trim().is_empty() {
                    let reply = self.current.trim().to_string();
                    self.history.push((Role::Assistant, reply.clone()));
                    self.blocks.push((Role::Assistant, reply));
                }
                self.current.clear();
            }
        }
    }

    pub fn render(&self, frame: &mut Frame) {
        let area = frame.area();
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Min(3),
                Constraint::Length(1),
                Constraint::Length(3),
            ])
            .split(area);

        let mut lines: Vec<Line> = Vec::new();
        for (role, text) in &self.blocks {
            match role {
                Role::User => {
                    lines.push(
                        Line::from(format!("❯ {}", text))
                            .style(Style::default().fg(Color::Cyan)),
                    );
                }
                Role::Assistant => {
                    for l in text.lines() {
                        lines.push(Line::from(l.to_string()));
                    }
                }
            }
            lines.push(Line::from(""));
        }
        if self.loading && !self.current.is_empty() {
            for l in self.current.lines() {
                lines.push(Line::from(l.to_string()));
            }
        }
        let total = lines.len() as u16;
        let height = chunks[0].height;
        let scroll = total.saturating_sub(height);
        frame.render_widget(Paragraph::new(lines).scroll((scroll, 0)), chunks[0]);

        if self.loading {
            let spinner_chars = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
            let sc = spinner_chars
                .chars()
                .nth(self.spinner_index % spinner_chars.len())
                .unwrap_or('⠋');
            let msg = if self.current.is_empty() {
                "思考中…"
            } else {
                "生成中…"
            };
            let line = Line::from(vec![
                Span::styled(sc.to_string(), Style::default().fg(Color::Yellow)),
                Span::raw(format!(" {}", msg)),
            ]);
            frame.render_widget(Paragraph::new(line), chunks[1]);
        }

        let block = Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(Color::Magenta))
            .padding(Padding::horizontal(1));
        let prompt = Span::styled(
            "❯ ",
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        );
        let input_span = Span::raw(self.input.clone());
        let cursor = if self.cursor_visible && !self.loading {
            Span::styled("▊", Style::default().fg(Color::White))
        } else {
            Span::raw(" ")
        };
        let input_line = Line::from(vec![prompt, input_span, cursor]);
        frame.render_widget(Paragraph::new(input_line).block(block), chunks[2]);
    }
}
