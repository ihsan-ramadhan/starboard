use axum::{
    extract::{FromRequestParts, Request},
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    middleware::Next,
    response::Response,
};
use deadpool_postgres::Pool;
use std::sync::Arc;

use crate::AppState;

#[derive(Clone)]
pub struct AuthUser {
    pub role: String,
}

impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = (StatusCode, String);

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))
    }
}

pub fn create_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub async fn auth_middleware(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Response {
    let token = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    let user = match token {
        Some(t) => resolve_user(&state.pool, &t).await,
        None => None,
    };

    match user {
        Some(u) => {
            req.extensions_mut().insert(u);
            next.run(req).await
        }
        None => Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .body(axum::body::Body::from("Unauthorized"))
            .unwrap(),
    }
}

async fn resolve_user(pool: &Pool, token: &str) -> Option<AuthUser> {
    let client = pool.get().await.ok()?;
    let row = client
        .query_opt(
            r#"
            SELECT u.role
            FROM sessions s
            JOIN users u ON u.id = s."userId"
            WHERE s.token = $1 AND s."expiresAt" > now()
            "#,
            &[&token],
        )
        .await
        .ok()?;
    row.map(|r| AuthUser {
        role: r.get(0),
    })
}