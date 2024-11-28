from emails.loops import sync_users_to_loops
from shared.logger import logger, create_logger


def main():
    create_logger(level="INFO")
    
    try:
        # Run sync in dry-run mode first
        logger.info("Running dry-run first...")
        dry_run_results = sync_users_to_loops(dry_run=True)
        
        logger.info("\nDry run results:")
        logger.info(f"Total users: {dry_run_results['total_users']}")
        logger.info(f"Would create: {dry_run_results['created']}")
        logger.info(f"Would update: {dry_run_results['updated']}")
        logger.info(f"Would skip: {dry_run_results['skipped']}")
        
        if dry_run_results['details']:
            logger.info("\nDetails:")
            for detail in dry_run_results['details']:
                logger.info(f"- {detail}")
        
        response = input("\nProceed with actual sync? (y/n): ")
        if response.lower() != 'y':
            logger.info("Aborted")
            return
            
        # Run actual sync
        logger.info("\nStarting actual sync...")
        results = sync_users_to_loops(dry_run=False)
        
        logger.info("\nFinal results:")
        logger.info(f"Total users: {results['total_users']}")
        logger.info(f"Created: {results['created']}")
        logger.info(f"Updated: {results['updated']}")
        logger.info(f"Skipped: {results['skipped']}")
        logger.info(f"Errors: {results['errors']}")
        
        if results['details']:
            logger.info("\nDetails:")
            for detail in results['details']:
                logger.info(f"- {detail}")
                
    except Exception as e:
        logger.error(f"Script failed: {e}")
        raise


if __name__ == "__main__":
    main()