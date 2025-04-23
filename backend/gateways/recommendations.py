from typing import List, Optional, Dict, Optional
from entities.recommendation import Recommendation
from gateways.database.dynamodb import DynamoDBGateway
from loguru import logger
from entities.user import User
from gateways.vector_database.pinecone import PineconeVectorDB
from datetime import datetime
from pytz import UTC
import numpy as np
import pytz
from typing import Tuple
import asyncio
from geopy.geocoders import Nominatim
from decimal import Decimal
import json
import os


def get_timezone_cache_path() -> str:
    abs_path = os.path.abspath(__file__)
    file_dir_path = abs_path.replace(f"/{os.path.basename(abs_path)}", "").replace(
        os.getcwd(), ""
    )
    file_path = f"{file_dir_path}/../shared/timezone_to_loc_cache.json"

    if file_path[0] == "/":
        file_path = file_path[1:]

    return file_path


def calculate_age_sim(age1: int, age2: int) -> float:
    k = 2
    return float(np.exp(-k * (np.log(age1 / age2)) ** 2))


def tanh_fit(x, A=0.61244, B=-0.77700, C=2.34078, D=0.39498):
    """
    Four‑parameter hyperbolic‑tangent fit to the data:
      x = 1     → y ≈ 1.0
      x = 10    → y ≈ 0.95
      x = 100   → y ≈ 0.80
      x = 1000  → y ≈ 0.40
      x = 10000 → y ≈ 0.00

    Model: y = A * tanh(B * log10(x) + C) + D, clamped at y >= 0
    """
    x = np.asarray(x)
    return np.maximum(A * np.tanh(B * np.log10(x) + C) + D, 0)


def calculate_geo_sim(loc_1: Tuple[float, float], loc_2: Tuple[float, float]) -> float:
    distance = np.sqrt((loc_1[0] - loc_2[0]) ** 2 + (loc_1[1] - loc_2[1]) ** 2)
    distance_in_km = distance * 111.32
    return max(1, float(tanh_fit(distance_in_km)))


def timezone_to_approx_latlong(timezone_str: str) -> Optional[Tuple[float, float]]:

    with open(get_timezone_cache_path(), "r") as f:
        timezone_cache = json.load(f)

        if timezone_str in timezone_cache:
            return timezone_cache[timezone_str]

        if timezone_str not in pytz.all_timezones:
            logger.error(f"Invalid timezone: {timezone_str}")
            return None

        try:
            geolocator = Nominatim(user_agent="timezone_converter")
            location_hint = timezone_str.split("/")[-1].replace("_", " ")
            location = geolocator.geocode(location_hint, timeout=10)  # Added timeout

            if location:
                result = (location.latitude, location.longitude)
                timezone_cache[timezone_str] = result
                with open(get_timezone_cache_path(), "w") as f:
                    json.dump(timezone_cache, f, indent=4)
            else:
                logger.error(f"No location found for {timezone_str}")
                result = None
        except Exception as e:
            logger.error(f"Geocoding error for {timezone_str}: {e}")
            result = None

        return result


class RecommendationsGateway:
    def __init__(self):
        self.db_gateway = DynamoDBGateway("recommendations")
        self.users_vector_database = PineconeVectorDB(namespace="users")
        self.plans_vector_database = PineconeVectorDB(namespace="plans")

    def get(self, id: str) -> Optional[Recommendation]:
        data = self.db_gateway.query("id", id)
        if len(data) > 0:
            return Recommendation(**data[0])
        return None

    def get_all_user_reccomendations_by_user_id(
        self, user_id: str
    ) -> List[Recommendation]:
        data = self.db_gateway.query_by_criteria({"user_id": user_id})
        return [
            Recommendation(**item)
            for item in data
            if item["recommendation_object_type"] == "user"
        ]

    def upsert_recommendation(self, recommendation: Recommendation) -> Recommendation:
        self.db_gateway.write(recommendation.dict())
        logger.info(f"Recommendation created: {recommendation.id}")
        return recommendation

    async def compute_recommended_users(self, current_user: User) -> Dict:
        from gateways.users import UsersGateway
        from controllers.plan_controller import PlanController

        self.delete_all_for_user(current_user.id)
        users_gateway = UsersGateway()
        all_users = users_gateway.get_all_users()
        users_looking_for_partners = [
            u for u in all_users if u.looking_for_ap and u.id != current_user.id
        ]
        users_looking_for_partners_ids = [u.id for u in users_looking_for_partners]

        results = {}  # target id to scores hash store

        # calculate profile sim
        if current_user.profile:
            profile_search_result = self.users_vector_database.query(
                query=current_user.profile,
                top_k=50,
                filter={"user_id": {"$in": users_looking_for_partners_ids}},
            )

            for result in profile_search_result:
                if result.fields["user_id"] not in results:
                    results[result.fields["user_id"]] = {}
                results[result.fields["user_id"]]["profile_sim_score"] = result.score

        # calculate plan sim

        user_plans = PlanController().get_all_user_active_plans(current_user)
        if len(user_plans) > 0:
            plan_search_result = self.plans_vector_database.query(
                query=user_plans[0].goal,
                top_k=50,
                filter={"user_id": {"$in": users_looking_for_partners_ids}},
            )

            for result in plan_search_result:
                if result.fields["user_id"] not in results:
                    results[result.fields["user_id"]] = {}
                results[result.fields["user_id"]]["plan_sim_score"] = result.score

        # calculate geo sim

        async def process_user_geo_sim(target_user, results):
            loc_1 = timezone_to_approx_latlong(current_user.timezone)
            loc_2 = timezone_to_approx_latlong(target_user.timezone)

            if not loc_1:
                return

            if not loc_2:
                logger.warning(
                    f"Target user {target_user.username} failed to convert timezone to locs: {loc_2}"
                )
                return

            if target_user.id not in results:
                results[target_user.id] = {}

            results[target_user.id]["geo_sim_score"] = calculate_geo_sim(loc_1, loc_2)
            logger.debug(
                f"Geo sim score for {target_user.username}: {results[target_user.id]['geo_sim_score']}"
            )

        tasks = []
        for target_user in users_looking_for_partners:
            tasks.append(process_user_geo_sim(target_user, results))

        await asyncio.gather(*tasks)

        # calculate age sim
        for target_user in users_looking_for_partners:
            if target_user.age and current_user.age:
                if target_user.id not in results:
                    results[target_user.id] = {}
                results[target_user.id]["age_sim_score"] = calculate_age_sim(
                    current_user.age, target_user.age
                )
            else:
                logger.warning(
                    f"User {target_user.username} or current user {current_user.username} has no age"
                )

        # calculate final scores
        for (
            result_key
        ) in results.keys():  # Renamed 'result' to 'result_key' to avoid confusion
            scores = []
            metadata = {}
            if "profile_sim_score" in results[result_key]:
                metadata["profile_sim_score"] = results[result_key]["profile_sim_score"]
                scores.append(results[result_key]["profile_sim_score"])
            else:
                scores.append(0)

            if "plan_sim_score" in results[result_key]:
                scores.append(results[result_key]["plan_sim_score"])
                metadata["plan_sim_score"] = results[result_key]["plan_sim_score"]
            else:
                scores.append(0)

            if "geo_sim_score" in results[result_key]:
                scores.append(results[result_key]["geo_sim_score"])
                metadata["geo_sim_score"] = results[result_key]["geo_sim_score"]
            else:
                scores.append(0)

            if "age_sim_score" in results[result_key]:
                scores.append(results[result_key]["age_sim_score"])
                metadata["age_sim_score"] = results[result_key]["age_sim_score"]
            else:
                scores.append(0)

            if len(scores) > 0:
                final_score = float(np.average(scores))
            else:
                final_score = 0

            results[result_key]["final_score"] = final_score

            recommendation = Recommendation.new(
                user_id=current_user.id,
                recommendation_object_type="user",
                recommendation_object_id=result_key,
                score=final_score,
                metadata=metadata,
            )
            self.upsert_recommendation(recommendation)

        logger.info(
            f"Computed {len(results)} recommendations for user {current_user.username}"
        )
        users_gateway.update_fields(
            current_user.id,
            {
                "recommendations_outdated": False,
                "recommendations_last_calculated_at": datetime.now(UTC).isoformat(),
            },
        )
        return results

    def delete_all_for_user(self, user_id: str):
        self.db_gateway.delete_all("user_id", user_id)
        logger.warning(f"Deleted all recommendations for user {user_id}")
