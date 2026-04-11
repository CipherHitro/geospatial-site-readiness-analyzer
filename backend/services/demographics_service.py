import csv
import math
from functools import lru_cache
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session


DATASET_DIR = Path(__file__).resolve().parent.parent / "dataset"
DATASET_CANDIDATES = [
    "india_with_ahmedabad_enriched.csv",
    "india_relative_wealth_index.csv",
]
INCOME_NEIGHBORHOOD_RADIUS_KM = 5.0
INCOME_NEAREST_POINTS = 5


@lru_cache(maxsize=1)
def _resolve_dataset_path() -> Path:
    for filename in DATASET_CANDIDATES:
        candidate = DATASET_DIR / filename
        if candidate.exists():
            return candidate
    return DATASET_DIR / DATASET_CANDIDATES[0]


def _get_row_value(row: dict, keys: list[str]):
    for key in keys:
        value = row.get(key)
        if value not in (None, ""):
            return value
    return None


@lru_cache(maxsize=1)
def _load_wealth_samples() -> list[dict]:
    samples: list[dict] = []
    dataset_path = _resolve_dataset_path()
    if not dataset_path.exists():
        return samples

    with dataset_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        raw_samples: list[dict] = []
        has_native_rwi = False

        for row in reader:
            try:
                normalized_row = {(k or "").strip().lower(): v for k, v in row.items()}

                lat_raw = _get_row_value(normalized_row, ["latitude", "lat"])
                lng_raw = _get_row_value(normalized_row, ["longitude", "lng", "lon"])

                rwi_raw = _get_row_value(normalized_row, ["rwi"])
                est_income_raw = _get_row_value(
                    normalized_row,
                    ["est_per_capita_inr", "estimated_per_capita_inr", "per_capita_income", "income"],
                )

                wealth_raw = rwi_raw if rwi_raw is not None else est_income_raw
                if wealth_raw is None or lat_raw is None or lng_raw is None:
                    continue

                has_native_rwi = has_native_rwi or (rwi_raw is not None)

                india_relative_raw = _get_row_value(normalized_row, ["rwi_india_relative"])
                india_relative = float(india_relative_raw) if india_relative_raw not in (None, "") else None
                if india_relative is not None and math.isnan(india_relative):
                    india_relative = None

                error_raw = _get_row_value(normalized_row, ["error"])
                error_value = float(error_raw) if error_raw not in (None, "") else 0.0

                raw_samples.append(
                    {
                        "lat": float(lat_raw),
                        "lng": float(lng_raw),
                        "wealth_value": float(wealth_raw),
                        "error": error_value,
                        "rwi": float(rwi_raw) if rwi_raw is not None else None,
                        "rwi_india_relative": india_relative,
                    }
                )
            except (TypeError, ValueError, KeyError):
                continue

        if not raw_samples:
            return samples

        if has_native_rwi:
            for item in raw_samples:
                sample = {
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "rwi": float(item["rwi"] if item["rwi"] is not None else item["wealth_value"]),
                    "error": float(item["error"]),
                    "rwi_india_relative": item["rwi_india_relative"],
                }
                samples.append(sample)
            return samples

        wealth_values = [item["wealth_value"] for item in raw_samples]
        min_wealth = min(wealth_values)
        max_wealth = max(wealth_values)
        wealth_span = max_wealth - min_wealth

        for item in raw_samples:
            if wealth_span <= 0:
                normalized = 0.5
            else:
                normalized = (item["wealth_value"] - min_wealth) / wealth_span
                normalized = max(0.0, min(1.0, normalized))

            sample = {
                "lat": item["lat"],
                "lng": item["lng"],
                "rwi": normalized,
                "error": float(item["error"]),
                "rwi_india_relative": normalized,
            }
            samples.append(sample)

    return samples


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    # Great-circle distance to find the nearest wealth sample for a user point.
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c


def _relative_value(sample: dict, min_rwi: float, max_rwi: float) -> float:
    india_relative = sample.get("rwi_india_relative")
    if india_relative is not None:
        return max(0.0, min(1.0, float(india_relative)))
    if max_rwi <= min_rwi:
        return 0.5
    return max(0.0, min(1.0, (sample["rwi"] - min_rwi) / (max_rwi - min_rwi)))


@lru_cache(maxsize=1)
def _wealth_class_thresholds() -> tuple[float, float, float, float]:
    samples = _load_wealth_samples()
    if not samples:
        return (0.2, 0.4, 0.6, 0.8)

    has_india_relative = any(sample.get("rwi_india_relative") is not None for sample in samples)
    if has_india_relative:
        return (0.2, 0.4, 0.6, 0.8)

    sorted_rwi = sorted(sample["rwi"] for sample in samples)
    max_idx = len(sorted_rwi) - 1

    def _pct(p: float) -> float:
        return sorted_rwi[int(max_idx * p)]

    return (_pct(0.2), _pct(0.4), _pct(0.6), _pct(0.8))


def _classify_income_group(rwi: float, thresholds: tuple[float, float, float, float]) -> str:
    p20, p40, p60, p80 = thresholds
    if rwi <= p20:
        return "lower_class"
    if rwi <= p40:
        return "lower_middle_class"
    if rwi <= p60:
        return "middle_class"
    if rwi <= p80:
        return "upper_middle_class"
    return "upper_class"


def _income_group_percentages(group_counts: dict[str, int], total: int) -> dict[str, float]:
    keys = [
        "lower_class",
        "lower_middle_class",
        "middle_class",
        "upper_middle_class",
        "upper_class",
    ]
    if total <= 0:
        return {k: 0.0 for k in keys}
    return {k: round((group_counts.get(k, 0) / total) * 100.0, 2) for k in keys}


def _score_population(population_in_1km: float) -> float:
    # Piecewise scoring so dense urban pockets approach 100, sparse areas stay low.
    if population_in_1km <= 0:
        return 0.0
    if population_in_1km >= 30000:
        return 100.0
    return (population_in_1km / 30000.0) * 100.0


def get_income_score(lat: float, lng: float) -> dict:
    samples = _load_wealth_samples()
    min_rwi = min((sample["rwi"] for sample in samples), default=0.0)
    max_rwi = max((sample["rwi"] for sample in samples), default=1.0)

    if not samples:
        zero_groups = {
            "lower_class": 0.0,
            "lower_middle_class": 0.0,
            "middle_class": 0.0,
            "upper_middle_class": 0.0,
            "upper_class": 0.0,
        }
        return {
            "income_level_score": 0.0,
            "relative_wealth_index": 0.0,
            "people_grouping": zero_groups,
            "breakdown": {
                "nearest_sample_distance_km": 0.0,
                "nearest_sample_error": 0.0,
                "nearest_sample_rwi": 0.0,
                "samples_considered": 0,
                "samples_in_neighborhood": 0,
                "neighborhood_radius_km": INCOME_NEIGHBORHOOD_RADIUS_KM,
                "points_used_count": 0,
                "points_used": [],
                "dataset_source": _resolve_dataset_path().name,
                "class_thresholds": {
                    "p20": 0.0,
                    "p40": 0.0,
                    "p60": 0.0,
                    "p80": 0.0,
                },
            },
        }

    nearest_distance = 0.0
    nearest = samples[0]
    thresholds = _wealth_class_thresholds()
    group_counts = {
        "lower_class": 0,
        "lower_middle_class": 0,
        "middle_class": 0,
        "upper_middle_class": 0,
        "upper_class": 0,
    }
    neighborhood_count = 0

    distance_rows: list[tuple[float, dict]] = []
    for sample in samples:
        distance = _haversine_km(lat, lng, sample["lat"], sample["lng"])
        if distance <= INCOME_NEIGHBORHOOD_RADIUS_KM:
            neighborhood_count += 1
        distance_rows.append((distance, sample))

    distance_rows.sort(key=lambda row: row[0])
    used_rows = distance_rows[: max(1, min(INCOME_NEAREST_POINTS, len(distance_rows)))]

    nearest_distance, nearest = used_rows[0]

    weighted_relative_sum = 0.0
    weighted_rwi_sum = 0.0
    weight_sum = 0.0
    points_used = []

    for distance, sample in used_rows:
        # Inverse-distance weighting gives closer samples more influence.
        weight = 1.0 / max(distance, 0.05)
        sample_relative = _relative_value(sample, min_rwi, max_rwi)
        weighted_relative_sum += sample_relative * weight
        weighted_rwi_sum += float(sample["rwi"]) * weight
        weight_sum += weight

        group = _classify_income_group(sample_relative, thresholds)
        group_counts[group] += 1

        points_used.append(
            {
                "lat": round(float(sample["lat"]), 6),
                "lng": round(float(sample["lng"]), 6),
                "distance_km": round(float(distance), 3),
                "rwi": round(float(sample["rwi"]), 4),
                "error": round(float(sample["error"]), 4),
                "rwi_india_relative": (
                    None
                    if sample.get("rwi_india_relative") is None
                    else round(float(sample["rwi_india_relative"]), 4)
                ),
            }
        )

    weighted_relative = (weighted_relative_sum / weight_sum) if weight_sum > 0 else 0.0
    weighted_rwi = (weighted_rwi_sum / weight_sum) if weight_sum > 0 else 0.0

    income_level_score = round(weighted_relative * 100.0, 1)
    grouping = _income_group_percentages(group_counts, len(used_rows))

    return {
        "income_level_score": income_level_score,
        "relative_wealth_index": round(weighted_rwi, 4),
        "people_grouping": grouping,
        "breakdown": {
            "nearest_sample_distance_km": round(float(nearest_distance), 3),
            "nearest_sample_error": round(float(nearest["error"]), 4),
            "nearest_sample_rwi": round(float(nearest["rwi"]), 4),
            "samples_considered": len(samples),
            "samples_in_neighborhood": neighborhood_count,
            "neighborhood_radius_km": INCOME_NEIGHBORHOOD_RADIUS_KM,
            "points_used_count": len(points_used),
            "points_used": points_used,
            "dataset_source": _resolve_dataset_path().name,
            "class_thresholds": {
                "p20": round(thresholds[0], 4),
                "p40": round(thresholds[1], 4),
                "p60": round(thresholds[2], 4),
                "p80": round(thresholds[3], 4),
            },
        },
    }


def get_demographics_score(lat: float, lng: float, db: Session) -> dict:
    query = text(
        """
        SELECT
            COALESCE(SUM(population) FILTER (
                WHERE ST_DWithin(
                    geometry::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    1000
                )
            ), 0) AS population_in_1km,
            COALESCE(SUM(population) FILTER (
                WHERE ST_Intersects(
                    geometry,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                )
            ), 0) AS containing_cell_population
        FROM population_grid
        WHERE geometry IS NOT NULL;
        """
    )

    row = db.execute(query, {"lat": lat, "lng": lng}).mappings().first()

    population_in_1km = float(row["population_in_1km"]) if row and row["population_in_1km"] is not None else 0.0
    containing_cell_population = (
        float(row["containing_cell_population"])
        if row and row["containing_cell_population"] is not None
        else 0.0
    )
    demographics_score = _score_population(population_in_1km)
    income = get_income_score(lat, lng)

    return {
        "demographics_score": round(demographics_score, 1),
        "population": round(population_in_1km, 2),
        "income_level_score": income["income_level_score"],
        "relative_wealth_index": income["relative_wealth_index"],
        "people_grouping": income["people_grouping"],
        "breakdown": {
            "population_in_1km": round(population_in_1km, 2),
            "containing_cell_population": round(containing_cell_population, 2),
        },
        "income_breakdown": income["breakdown"],
    }
