use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use std::env;
use tokio_postgres::Client;

pub async fn get_client() -> Result<Client, String> {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:REDACTED_ROTATE_ME@db.SUPABASE_PROJECT_REF.supabase.co:5432/postgres".to_string()
    });

    let connector = TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("TLS build error: {}", e))?;
    let tls = MakeTlsConnector::new(connector);

    let (client, connection) = tokio_postgres::connect(&database_url, tls)
        .await
        .map_err(|e| format!("DB connect error: {}", e))?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Database connection error: {}", e);
        }
    });

    Ok(client)
}
