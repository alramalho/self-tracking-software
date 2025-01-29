from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from loguru import logger
import os

def init_telemetry(app):
    # Only initialize if OTEL_ENABLED is set to true
    if not os.getenv("OTEL_ENABLED", "").lower() == "true":
        logger.info("OpenTelemetry tracing is disabled. Set OTEL_ENABLED=true to enable it.")
        return None

    try:
        # Create a resource identifying our service
        resource = Resource(attributes={
            SERVICE_NAME: "tracking-so-backend"
        })

        # Create a TracerProvider with the service resource
        provider = TracerProvider(resource=resource)

        # Configure the OTLP exporter
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces")
        otlp_headers = {
            "Authorization": f"Bearer {os.getenv('AXIOM_TOKEN', '')}",
        }

        dataset = os.getenv("AXIOM_DATASET")
        if dataset:
            otlp_headers["X-Axiom-Dataset"] = dataset

        logger.debug(f"Configuring OTLP exporter with endpoint: {otlp_endpoint}")
        logger.debug(f"Headers configured: {', '.join(otlp_headers.keys())}")

        otlp_exporter = OTLPSpanExporter(
            endpoint=otlp_endpoint,
            headers=otlp_headers,
            timeout=30  # Increase timeout to 30 seconds
        )

        # Create a BatchSpanProcessor for efficient exporting
        processor = BatchSpanProcessor(otlp_exporter)
        provider.add_span_processor(processor)

        # Set the TracerProvider as the global default
        trace.set_tracer_provider(provider)

        # Instrument FastAPI
        FastAPIInstrumentor.instrument_app(app)

        # Instrument the requests library
        RequestsInstrumentor().instrument()
        
        logger.info("✨ OpenTelemetry tracing initialized:")
        logger.info(f"  • Service Name: tracking-so-backend")
        logger.info(f"  • Dataset: {dataset}")
        logger.info(f"  • Endpoint: {otlp_endpoint}")
        logger.info(f"  • Instrumented: FastAPI, Requests")

        return provider

    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {str(e)}")
        logger.exception(e)
        return None 