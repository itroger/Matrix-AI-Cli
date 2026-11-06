use clap::Parser;

const DEFAULT_URL: &str = "http://localhost:8000";

#[derive(Parser, Debug)]
#[command(disable_help_flag = true)]
struct Args {
    #[arg(short = 'u', long = "url", env = "AGENT_URL", default_value = DEFAULT_URL)]
    url: String,
}

pub fn load_config() -> String {
    let args = Args::parse();
    args.url.trim_end_matches('/').to_string()
}
