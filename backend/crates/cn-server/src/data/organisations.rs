use cn_domain::{Organisation, OrganisationId, UserId};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(sqlx::FromRow)]
struct OrgRow {
    id: Uuid,
    name: String,
    slug: String,
}

#[derive(Debug, Clone)]
pub struct Membership {
    pub organisation_id: OrganisationId,
    pub user_id: UserId,
    pub member_role: String,
    pub name: String,
    pub slug: String,
}

pub struct PgOrganisationRepo {
    pool: PgPool,
}

impl PgOrganisationRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list(&self) -> AppResult<Vec<Organisation>> {
        let rows = sqlx::query_as::<_, OrgRow>(
            "SELECT id, name, slug::text FROM organisations ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows.into_iter().map(into_org).collect())
    }

    pub async fn get(&self, id: OrganisationId) -> AppResult<Option<Organisation>> {
        let row = sqlx::query_as::<_, OrgRow>(
            "SELECT id, name, slug::text FROM organisations WHERE id = $1",
        )
        .bind(id.as_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(row.map(into_org))
    }

    pub async fn create(&self, name: &str, slug: &str) -> AppResult<Organisation> {
        let row = sqlx::query_as::<_, OrgRow>(
            r#"
            INSERT INTO organisations (name, slug)
            VALUES ($1, $2)
            RETURNING id, name, slug::text
            "#,
        )
        .bind(name)
        .bind(slug)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| {
            if let sqlx::Error::Database(db) = &err
                && db.constraint() == Some("organisations_slug_key")
            {
                return AppError::Conflict("organisation slug already exists".into());
            }
            AppError::Internal(err.into())
        })?;
        Ok(into_org(row))
    }

    pub async fn memberships_for_user(&self, user_id: UserId) -> AppResult<Vec<Membership>> {
        let rows = sqlx::query_as::<_, (Uuid, Uuid, String, String, String)>(
            r#"
            SELECT m.organisation_id, m.user_id, m.member_role, o.name, o.slug::text
            FROM organisation_members m
            JOIN organisations o ON o.id = m.organisation_id
            WHERE m.user_id = $1
            ORDER BY o.name
            "#,
        )
        .bind(user_id.as_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(rows
            .into_iter()
            .map(|(organisation_id, user_id, member_role, name, slug)| Membership {
                organisation_id: OrganisationId::from(organisation_id),
                user_id: UserId::from(user_id),
                member_role,
                name,
                slug,
            })
            .collect())
    }

    pub async fn is_member(&self, organisation_id: OrganisationId, user_id: UserId) -> AppResult<bool> {
        let found = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM organisation_members
                WHERE organisation_id = $1 AND user_id = $2
            )
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(user_id.as_uuid())
        .fetch_one(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(found)
    }

    pub async fn invite_email(
        &self,
        organisation_id: OrganisationId,
        email: &str,
        member_role: &str,
    ) -> AppResult<()> {
        let role = normalize_member_role(member_role)?;
        sqlx::query(
            r#"
            INSERT INTO organisation_invitations (organisation_id, email, member_role)
            VALUES ($1, $2, $3)
            ON CONFLICT (organisation_id, email) DO UPDATE SET member_role = EXCLUDED.member_role
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(email)
        .bind(role)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }

    pub async fn apply_invitations(&self, user_id: UserId, email: &str) -> AppResult<usize> {
        let inserted = sqlx::query(
            r#"
            INSERT INTO organisation_members (organisation_id, user_id, member_role)
            SELECT organisation_id, $1, member_role
            FROM organisation_invitations
            WHERE email = $2
            ON CONFLICT (organisation_id, user_id) DO UPDATE
                SET member_role = EXCLUDED.member_role
            "#,
        )
        .bind(user_id.as_uuid())
        .bind(email)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

        sqlx::query("DELETE FROM organisation_invitations WHERE email = $1")
            .bind(email)
            .execute(&self.pool)
            .await
            .map_err(|err| AppError::Internal(err.into()))?;

        Ok(inserted.rows_affected() as usize)
    }

    pub async fn add_member(
        &self,
        organisation_id: OrganisationId,
        user_id: UserId,
        member_role: &str,
    ) -> AppResult<()> {
        let role = normalize_member_role(member_role)?;
        sqlx::query(
            r#"
            INSERT INTO organisation_members (organisation_id, user_id, member_role)
            VALUES ($1, $2, $3)
            ON CONFLICT (organisation_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role
            "#,
        )
        .bind(organisation_id.as_uuid())
        .bind(user_id.as_uuid())
        .bind(role)
        .execute(&self.pool)
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
        Ok(())
    }
}

fn normalize_member_role(role: &str) -> AppResult<&'static str> {
    match role.trim().to_ascii_lowercase().as_str() {
        "admin" => Ok("admin"),
        "member" | "" => Ok("member"),
        _ => Err(AppError::BadRequest("member role must be member or admin".into())),
    }
}

fn into_org(row: OrgRow) -> Organisation {
    Organisation {
        id: OrganisationId::from(row.id),
        name: row.name,
        slug: row.slug,
    }
}
