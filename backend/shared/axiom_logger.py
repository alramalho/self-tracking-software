import os
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime
from loguru import logger
from constants import ENVIRONMENT, AXIOM_DATASET, AXIOM_BATCH_SIZE, AXIOM_FLUSH_INTERVAL, OTEL_ENABLED
import axiom_py

# Create a context variable to store the correlation ID
correlation_id = ContextVar('correlation_id', default=None)

def get_correlation_id():
    """Get the current correlation ID or generate a new one"""
    current_id = correlation_id.get()
    if current_id is None:
        current_id = f"{ENVIRONMENT.lower()}-{str(uuid.uuid4())}"
        correlation_id.set(current_id)
    return current_id

class AxiomSink:
    def __init__(self):
        self.enabled = OTEL_ENABLED.lower() == "true"
        self.dataset = AXIOM_DATASET
        self.batch = []
        # Smaller batch size for Lambda environments
        self.batch_size = int(AXIOM_BATCH_SIZE)
        self.last_flush = time.time()
        # Flush every 5 seconds by default, or sooner if batch is full
        self.flush_interval_seconds = float(AXIOM_FLUSH_INTERVAL)
        
        if not self.enabled:
            print("Axiom logging is disabled. Set OTEL_ENABLED=true to enable it.", file=sys.stderr)
            return

        try:
            # Initialize Axiom client (it will automatically use AXIOM_TOKEN or AXIOM_API_KEY env var)
            self.client = axiom_py.Client()
            print(f"✨ Axiom logging initialized for dataset: {self.dataset} (batch size: {self.batch_size})", file=sys.stderr)
        except Exception as e:
            print(f"Failed to initialize Axiom client: {str(e)}", file=sys.stderr)
            self.enabled = False

    def write(self, message):
        if not self.enabled:
            return

        try:
            record = message.record
            event = {
                "_time": datetime.utcfromtimestamp(record["time"].timestamp()).isoformat() + "Z",
                "level": record["level"].name,
                "message": record["message"],
                "function": record["function"],
                "file": record["file"].name,
                "line": record["line"],
                "process": record["process"].name,
                "thread": record["thread"].name,
                "environment": os.getenv("ENVIRONMENT", "unknown"),
                "service": "tracking-so-backend",
                "correlation_id": get_correlation_id()  # Add correlation ID to every log
            }

            # Add exception info if present
            if record["exception"]:
                event["error"] = str(record["exception"])
                if hasattr(record["exception"], "__traceback__"):
                    event["traceback"] = record["exception"].__traceback__.format()

            # Add any extra fields from the log context
            if record["extra"]:
                event.update(record["extra"])

            self.batch.append(event)
            
            # Flush if batch is full or if enough time has passed
            if (len(self.batch) >= self.batch_size or 
                time.time() - self.last_flush >= self.flush_interval_seconds):
                self._send_batch()

        except Exception as e:
            print(f"Error in Axiom logger: {str(e)}", file=sys.stderr)

    def _send_batch(self):
        if not self.batch or not self.enabled:
            return

        try:
            self.client.ingest_events(
                dataset=self.dataset,
                events=self.batch
            )
            
            if os.getenv("DEBUG_AXIOM_LOGGER"):
                print(f"Successfully sent {len(self.batch)} logs to Axiom", file=sys.stderr)
            
        except Exception as e:
            print(f"Error sending logs to Axiom: {str(e)}", file=sys.stderr)
        
        finally:
            self.batch = []
            self.last_flush = time.time()

def setup_axiom_logging():
    """Configure loguru to send logs to Axiom"""
    axiom_sink = AxiomSink()
    
    # Add our custom sink to loguru
    logger.add(
        axiom_sink.write,
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="{time} | {level} | {message} | {extra}",
        serialize=True  # This ensures all fields are properly serialized
    )
    
    # Register flush on exit
    import atexit
    atexit.register(axiom_sink._send_batch)
    
    # For Lambda environments, also expose the flush method
    if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return axiom_sink._send_batch
    return None 