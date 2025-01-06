from shared.logger import create_logger
create_logger(level="INFO")

from controllers.plan_controller import PlanController
from entities.plan import Plan
from loguru import logger
import argparse
import traceback
def update_plan_activity_ids(dry_run: bool = False):
    """
    Updates all plans by adding activity_ids from their sessions.
    
    Args:
        dry_run (bool): If True, only prints the changes without executing them.
    """
    plan_controller = PlanController()
    
    # Get all plans from the database
    all_plans = [Plan(**plan) for plan in plan_controller.db_gateway.scan()]
    logger.info(f"Found {len(all_plans)} plans to process")
    
    for plan in all_plans:
        # Get unique activity IDs from sessions
        session_activity_ids = {session.activity_id for session in plan.sessions if session.activity_id}
        
        # Initialize activity_ids if it doesn't exist
        if not hasattr(plan, 'activity_ids'):
            plan.activity_ids = []
            
        # Find new activity IDs that aren't in the plan's activity_ids
        new_activity_ids = session_activity_ids - set(plan.activity_ids)
        
        if new_activity_ids:
            if dry_run:
                logger.info(f"Plan {plan.id} ({plan.goal}) would add activity IDs: {new_activity_ids}")
            else:
                plan.activity_ids.extend(list(new_activity_ids))
                plan_controller.update_plan(plan)
                logger.info(f"Updated plan {plan.id} ({plan.goal}) with new activity IDs: {new_activity_ids}")
        else:
            logger.info(f"No new activity IDs to add for plan {plan.id} ({plan.goal})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Update plan activity IDs based on their sessions.')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without executing them')
    args = parser.parse_args()
    
    try:
        update_plan_activity_ids(dry_run=args.dry_run)
        logger.info("Script completed successfully!")
    except Exception as e:
        logger.error(traceback.format_exc())
        logger.error(f"Error running script: {str(e)}") 
