import os
import sys
import time
import uuid
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
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
        self.batch_size = int(AXIOM_BATCH_SIZE)
        self.last_flush = time.time()
        self.flush_interval_seconds = float(AXIOM_FLUSH_INTERVAL)
        self.session = None
        self.loop = None
        self.executor = ThreadPoolExecutor(max_workers=1)
        
        if not self.enabled:
            print("Axiom logging is disabled. Set OTEL_ENABLED=true to enable it.", file=sys.stderr)
            return

        try:
            # Initialize Axiom client
            self.client = axiom_py.Client()
            print(f"✨ Axiom logging initialized for dataset: {self.dataset} (batch size: {self.batch_size})", file=sys.stderr)
            
            # Get or create event loop
            try:
                self.loop = asyncio.get_event_loop()
            except RuntimeError:
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
            
        except Exception as e:
            print(f"Failed to initialize Axiom client: {str(e)}", file=sys.stderr)
            self.enabled = False

    async def _send_logs_async(self, events):
        """Asynchronously send logs to Axiom"""
        if not events:
            return
            
        try:
            # Create session if needed
            if self.session is None:
                self.session = aiohttp.ClientSession()
            
            # Prepare the request
            url = f"https://api.axiom.co/v1/datasets/{self.dataset}/ingest"
            headers = {
                "Authorization": f"Bearer {os.getenv('AXIOM_TOKEN') or os.getenv('AXIOM_API_KEY')}",
                "Content-Type": "application/json"
            }
            
            # Send request asynchronously
            async with self.session.post(url, json=events, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Error sending logs to Axiom: {error_text}", file=sys.stderr)
                elif os.getenv("DEBUG_AXIOM_LOGGER"):
                    print(f"Successfully sent {len(events)} logs to Axiom", file=sys.stderr)
                    
        except Exception as e:
            print(f"Error sending logs to Axiom: {str(e)}", file=sys.stderr)

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
                "correlation_id": get_correlation_id()
            }

            if record["exception"]:
                event["error"] = str(record["exception"])
                if hasattr(record["exception"], "__traceback__"):
                    event["traceback"] = record["exception"].__traceback__.format()

            if record["extra"]:
                event.update(record["extra"])

            self.batch.append(event)
            
            # If batch is full or enough time has passed, send logs asynchronously
            if (len(self.batch) >= self.batch_size or 
                time.time() - self.last_flush >= self.flush_interval_seconds):
                batch_to_send = self.batch
                self.batch = []
                self.last_flush = time.time()
                
                # Schedule the async send in the event loop
                asyncio.run_coroutine_threadsafe(
                    self._send_logs_async(batch_to_send), 
                    self.loop
                )

        except Exception as e:
            print(f"Error in Axiom logger: {str(e)}", file=sys.stderr)

    def _send_batch(self):
        """Flush remaining logs before shutdown"""
        if not self.enabled or not self.batch:
            return

        try:
            # Send final batch synchronously since we're shutting down
            self.loop.run_until_complete(self._send_logs_async(self.batch))
            self.batch = []
            
            # Close the session
            if self.session:
                self.loop.run_until_complete(self.session.close())
                
        except Exception as e:
            print(f"Error in final log flush: {str(e)}", file=sys.stderr)
        finally:
            self.executor.shutdown(wait=False)

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