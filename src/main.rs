mod agent;
mod config;
mod ui;

use agent::AgentEvent;
use config::load_config;
use crossterm::{
    event::{self, Event, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::{
    io::{stdout, Stdout},
    time::{Duration, Instant},
};
use tokio::sync::mpsc;
use ui::app::App;

type Tui = Terminal<CrosstermBackend<Stdout>>;

fn setup_terminal() -> std::io::Result<Tui> {
    enable_raw_mode()?;
    execute!(stdout(), EnterAlternateScreen)?;
    Terminal::new(CrosstermBackend::new(stdout()))
}

fn restore_terminal(mut terminal: Tui) -> std::io::Result<()> {
    disable_raw_mode()?;
    execute!(stdout(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let url = load_config();
    let mut terminal = setup_terminal()?;
    let (agent_tx, mut agent_rx) = mpsc::unbounded_channel::<AgentEvent>();
    let mut app = App::new();
    let mut last_tick = Instant::now();
    let tick_rate = Duration::from_millis(100);

    loop {
        terminal.draw(|f| app.render(f))?;
        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or(tick_rate);
        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    app.handle_key(key, &url, agent_tx.clone());
                }
            }
        }
        if last_tick.elapsed() >= tick_rate {
            app.on_tick();
            last_tick = Instant::now();
        }
        while let Ok(evt) = agent_rx.try_recv() {
            app.handle_agent_event(evt);
        }
        if app.should_quit {
            break;
        }
    }
    restore_terminal(terminal)?;
    Ok(())
}
