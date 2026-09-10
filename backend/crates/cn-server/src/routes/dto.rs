use chrono::{DateTime, Utc};
use cn_domain::{DeviceHealth, conserve_site_label, kg_from_grams};
use serde::Serialize;

use crate::data::collection_points::{CollectionPointRecord, InventoryRow};
use crate::data::deposits::{DepositFractionRecord, DepositRecord, LedgerEntry};
use crate::data::devices::{BinState, DeviceRecord};
use crate::data::pickups::PickupRecord;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
    pub green_points_balance: i64,
    pub conserve_points_balance: i64,
    pub naira_value: i64,
    pub deposit_count: i64,
    pub recycled_kg: f64,
    pub roles: Vec<String>,
    pub organisations: Vec<OrgMembershipResponse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrgMembershipResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub member_role: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialResponse {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub unit: String,
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_per_kg_naira: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionPointResponse {
    pub id: String,
    pub organisation_id: String,
    pub organisation_name: String,
    pub name: String,
    pub site_name: String,
    pub collection_point_name: String,
    pub slug: String,
    pub address: String,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub status: String,
    pub default_pickup_threshold_kg: f64,
    pub materials: Vec<MaterialResponse>,
    pub inventory: Vec<InventoryResponse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryResponse {
    pub collection_point_id: String,
    pub material_id: String,
    pub material_name: String,
    pub material_slug: String,
    pub weight_kg: f64,
    pub pickup_threshold_kg: f64,
    pub ready_for_pickup: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositResponse {
    pub id: String,
    pub user_id: String,
    pub collection_point_id: String,
    pub collection_point_name: String,
    pub site_name: String,
    pub organisation_id: String,
    pub material_id: String,
    pub material_name: String,
    pub material_slug: String,
    pub status: String,
    pub weight_kg: Option<f64>,
    pub price_per_kg_naira: Option<i64>,
    pub green_points: Option<i64>,
    pub conserve_points: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_green_points: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_conserve_points: Option<i64>,
    pub fractions: Vec<DepositFractionResponse>,
    pub created_at: DateTime<Utc>,
    pub measured_at: Option<DateTime<Utc>>,
    pub confirmed_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositFractionResponse {
    pub material_id: String,
    pub material_name: String,
    pub material_slug: String,
    pub weight_kg: f64,
    pub price_per_kg_naira: i64,
    pub green_points: i64,
    pub conserve_points: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerResponse {
    pub id: String,
    pub amount: i64,
    pub entry_type: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceResponse {
    pub id: String,
    pub organisation_id: String,
    pub collection_point_id: Option<String>,
    pub collection_point_name: Option<String>,
    pub site_name: Option<String>,
    pub external_id: String,
    pub device_type: String,
    pub status: String,
    pub health: String,
    pub firmware_version: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub bins: Vec<BinResponse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinResponse {
    pub material_id: String,
    pub material_slug: String,
    pub material_name: String,
    pub weight_kg: f64,
    pub fill_percent: Option<i32>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupResponse {
    pub id: String,
    pub organisation_id: String,
    pub collection_point_id: String,
    pub collection_point_name: String,
    pub site_name: String,
    pub material_id: String,
    pub material_name: String,
    pub material_slug: String,
    pub status: String,
    pub threshold_kg: f64,
    pub inventory_kg_at_ready: f64,
    pub collected_kg: Option<f64>,
    pub accepted_by: Option<String>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganisationOverview {
    pub organisation_id: String,
    pub name: String,
    pub collection_points: i64,
    pub sites: i64,
    pub devices_online: i64,
    pub devices_total: i64,
    pub material_collected_kg: f64,
    pub ready_for_pickup: i64,
}

pub fn inventory_dto(row: &InventoryRow) -> InventoryResponse {
    InventoryResponse {
        collection_point_id: row.collection_point_id.to_string(),
        material_id: row.material_id.to_string(),
        material_name: row.material_name.clone(),
        material_slug: row.material_slug.clone(),
        weight_kg: kg_from_grams(row.weight_grams),
        pickup_threshold_kg: kg_from_grams(row.pickup_threshold_grams),
        ready_for_pickup: row.weight_grams >= row.pickup_threshold_grams,
    }
}

pub fn point_dto(
    point: &CollectionPointRecord,
    materials: Vec<MaterialResponse>,
    inventory: Vec<InventoryResponse>,
) -> CollectionPointResponse {
    CollectionPointResponse {
        id: point.id.to_string(),
        organisation_id: point.organisation_id.to_string(),
        organisation_name: point.organisation_name.clone(),
        name: point.name.clone(),
        site_name: conserve_site_label(&point.name),
        collection_point_name: point.name.clone(),
        slug: point.slug.clone(),
        address: point.address.clone(),
        description: point.description.clone(),
        latitude: point.latitude,
        longitude: point.longitude,
        status: point.status.as_str().to_owned(),
        default_pickup_threshold_kg: kg_from_grams(point.default_pickup_threshold_grams),
        materials,
        inventory,
    }
}

pub fn deposit_dto(deposit: &DepositRecord, estimated: Option<i64>) -> DepositResponse {
    DepositResponse {
        id: deposit.id.to_string(),
        user_id: deposit.user_id.to_string(),
        collection_point_id: deposit.collection_point_id.to_string(),
        collection_point_name: deposit.collection_point_name.clone(),
        site_name: conserve_site_label(&deposit.collection_point_name),
        organisation_id: deposit.organisation_id.to_string(),
        material_id: deposit.material_id.to_string(),
        material_name: deposit.material_name.clone(),
        material_slug: deposit.material_slug.clone(),
        status: deposit.status.as_str().to_owned(),
        weight_kg: deposit.weight_grams.map(kg_from_grams),
        price_per_kg_naira: deposit.price_per_kg_naira,
        green_points: deposit.green_points,
        conserve_points: deposit.green_points,
        estimated_green_points: estimated,
        estimated_conserve_points: estimated,
        fractions: deposit.fractions.iter().map(fraction_dto).collect(),
        created_at: deposit.created_at,
        measured_at: deposit.measured_at,
        confirmed_at: deposit.confirmed_at,
    }
}

fn fraction_dto(line: &DepositFractionRecord) -> DepositFractionResponse {
    DepositFractionResponse {
        material_id: line.material_id.to_string(),
        material_name: line.material_name.clone(),
        material_slug: line.material_slug.clone(),
        weight_kg: kg_from_grams(line.weight_grams),
        price_per_kg_naira: line.price_per_kg_naira,
        green_points: line.green_points,
        conserve_points: line.green_points,
    }
}

pub fn ledger_dto(entry: &LedgerEntry) -> LedgerResponse {
    LedgerResponse {
        id: entry.id.to_string(),
        amount: entry.amount,
        entry_type: entry.entry_type.clone(),
        reference_type: entry.reference_type.clone(),
        reference_id: entry.reference_id.map(|id| id.to_string()),
        created_at: entry.created_at,
    }
}

pub fn device_dto(device: &DeviceRecord, bins: Vec<BinState>, now: DateTime<Utc>) -> DeviceResponse {
    let health = DeviceHealth::from_last_seen(device.last_seen_at, now);
    DeviceResponse {
        id: device.id.to_string(),
        organisation_id: device.organisation_id.to_string(),
        collection_point_id: device.collection_point_id.map(|id| id.to_string()),
        collection_point_name: device.collection_point_name.clone(),
        site_name: device
            .collection_point_name
            .as_deref()
            .map(conserve_site_label),
        external_id: device.external_id.clone(),
        device_type: device.device_type.clone(),
        status: device.status.clone(),
        health: match health {
            DeviceHealth::Online => "online".into(),
            DeviceHealth::Offline => "offline".into(),
        },
        firmware_version: device.firmware_version.clone(),
        latitude: device.latitude,
        longitude: device.longitude,
        last_seen_at: device.last_seen_at,
        bins: bins
            .into_iter()
            .map(|bin| BinResponse {
                material_id: bin.material_id.to_string(),
                material_slug: bin.material_slug,
                material_name: bin.material_name,
                weight_kg: kg_from_grams(bin.weight_grams),
                fill_percent: bin.fill_percent,
                updated_at: bin.updated_at,
            })
            .collect(),
    }
}

pub fn pickup_dto(pickup: &PickupRecord) -> PickupResponse {
    PickupResponse {
        id: pickup.id.to_string(),
        organisation_id: pickup.organisation_id.to_string(),
        collection_point_id: pickup.collection_point_id.to_string(),
        collection_point_name: pickup.collection_point_name.clone(),
        site_name: conserve_site_label(&pickup.collection_point_name),
        material_id: pickup.material_id.to_string(),
        material_name: pickup.material_name.clone(),
        material_slug: pickup.material_slug.clone(),
        status: pickup.status.as_str().to_owned(),
        threshold_kg: kg_from_grams(pickup.threshold_grams),
        inventory_kg_at_ready: kg_from_grams(pickup.inventory_grams_at_ready),
        collected_kg: pickup.collected_grams.map(kg_from_grams),
        accepted_by: pickup.accepted_by.map(|id| id.to_string()),
        accepted_at: pickup.accepted_at,
        completed_at: pickup.completed_at,
        created_at: pickup.created_at,
    }
}
