import sys
import os
from loguru import logger

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, project_root)

from backend.gateways.users import UsersGateway # type: ignore
from backend.gateways.activities import ActivitiesGateway # type: ignore
from backend.entities.user import User # type: ignore

def update_last_active_at():
    """
    Updates the last_active_at field for all users based on their most recent activity entry.
    """
    users_gateway = UsersGateway()
    activities_gateway = ActivitiesGateway()

    all_users: list[User] = users_gateway.get_all_users()
    logger.info(f"Found {len(all_users)} users to process.")

    updated_count = 0
    for user in all_users:
        try:
            # Get the most recent activity entry for the user
            recent_activities = activities_gateway.get_most_recent_activity_entries(
                user_id=user.id, limit=1
            )

            if recent_activities:
                last_activity_entry = recent_activities[0]
                new_last_active_at = last_activity_entry.created_at

                if user.last_active_at != new_last_active_at:
                    logger.info(
                        f"Updating last_active_at for user {user.id} ({user.name}) from {user.last_active_at} to {new_last_active_at}"
                    )
                    user.last_active_at = new_last_active_at
                    users_gateway.update_user(user)
                    updated_count += 1
                else:
                    logger.info(
                        f"User {user.id} ({user.name}) last_active_at is already up to date: {user.last_active_at}"
                    )
            else:
                logger.info(
                    f"No activity entries found for user {user.id} ({user.name}). Skipping update."
                )
        except Exception as e:
            logger.error(
                f"Error processing user {user.id} ({user.name}): {e}"
            )

    logger.info(f"Script finished. Updated {updated_count} users.")

if __name__ == "__main__":
    logger.info("Starting update_last_active_at script...")
    update_last_active_at()
    logger.info("update_last_active_at script completed.")
