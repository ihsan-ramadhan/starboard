use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use std::env;
use tokio_postgres::{Client, NoTls};

pub async fn get_client() -> Result<Client, String> {
    let database_url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL tidak diset. Konfigurasi koneksi database diperlukan.".to_string())?;

    if database_url.contains("sslmode=disable") || database_url.contains("localhost") || database_url.contains("127.0.0.1") || database_url.contains("172.10.") {
        let (client, connection) = tokio_postgres::connect(&database_url, NoTls)
            .await
            .map_err(|e| format!("DB connect error: {}", e))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("Database connection error: {}", e);
            }
        });

        return Ok(client);
    }

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
