use chrono::{DateTime, Utc};
use cn_domain::{User, UserId, UserRole};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(sqlx::FromRow)]
struct UserRow {
    id: Uuid,
    email: String,
    display_name: String,
    avatar_url: Option<String>,
    email_verified: bool,
    green_points_balance: i64,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

pub struct UpsertUserInput {
    pub id: UserId,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub email_verified: bool,
}

pub struct PgUserRepo {
    pool: PgPool,
}

impl PgUserRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn upsert(&self, input: UpsertUserInput) -> AppResult<User> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            INSERT INTO users (id, email, display_name, avatar_url, email_verified)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                display_name = CASE
                    WHEN EXCLUDED.display_name <> '' THEN EXCLUDED.display_name
                    ELSE users.display_name
                END,
                avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
                email_verified = users.email_verified OR EXCLUDED.email_verified,
                updated_at = now()
            RETURNING id, email::text, display_name, avatar_url, email_verified,
                      green_points_balance, created_at, updated_at
            "#,
        )
        .bind(input.id.as_uuid())
        .bind(&input.email)
        .bind(&input.display_name)
        .bind(&input.avatar_url)
        .bind(input.email_verified)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        sqlx::query(
            r#"
            INSERT INTO user_roles (user_id, role)
            VALUES ($1, 'citizen')
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(input.id.as_uuid())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        self.hydrate(row).await
    }

    pub async fn get_by_id(&self, id: UserId) -> AppResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, email::text, display_name, avatar_url, email_verified,
                   green_points_balance, created_at, updated_at
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        match row {
            Some(row) => Ok(Some(self.hydrate(row).await?)),
            None => Ok(None),
        }
    }

    pub async fn recycling_stats(&self, user_id: UserId) -> AppResult<(i64, i64)> {
        let row = sqlx::query_as::<_, (i64, i64)>(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE status = 'confirmed')::bigint,
                COALESCE(SUM(weight_grams) FILTER (WHERE status = 'confirmed'), 0)::bigint
            FROM deposits
            WHERE user_id = $1
            "#,
        )
        .bind(user_id.as_uuid())
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row)
    }

    pub async fn get_by_email(&self, email: &str) -> AppResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, email::text, display_name, avatar_url, email_verified,
                   green_points_balance, created_at, updated_at
            FROM users
            WHERE email = $1
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        match row {
            Some(row) => Ok(Some(self.hydrate(row).await?)),
            None => Ok(None),
        }
    }

    pub async fn grant_role(&self, user_id: UserId, role: UserRole) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO user_roles (user_id, role)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(user_id.as_uuid())
        .bind(role.as_str())
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    async fn hydrate(&self, row: UserRow) -> AppResult<User> {
        let roles = sqlx::query_scalar::<_, String>(
            "SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role",
        )
        .bind(row.id)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?
        .into_iter()
        .filter_map(|r| UserRole::parse(&r))
        .collect();

        Ok(User {
            id: UserId::from(row.id),
            email: row.email,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            email_verified: row.email_verified,
            green_points_balance: row.green_points_balance,
            roles,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}
