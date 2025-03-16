import os
from loguru import logger
import sys

if __name__ == "__main__":
    import uvicorn
    from pyngrok import ngrok

    port = 8000
    public_url = ngrok.connect(port).public_url
    logger.info(
        "\033[94mWebhook link to use (NGROK tunnel):\n"
        + public_url
        + "/clerk/webhook\n"
        + public_url
        + "/stripe/webhook\033[0m"
    )

    os.environ["API_URL"] = public_url
    ssl_keyfile = "../localhost.key"
    ssl_certfile = "../localhost.crt"

    # Default configuration
    uvicorn_config = {
        "app": "app:app",
        "host": "0.0.0.0",
        "port": port,
        "reload": True,
        "proxy_headers": True,
        "forwarded_allow_ips": "*",
        "ws_ping_interval": 20.0,  # Keep WebSocket connections alive
        "ws_ping_timeout": 20.0
    }

    # Check for workers flag
    if "-w" in sys.argv:
        workers_index = sys.argv.index("-w")
        if workers_index + 1 < len(sys.argv):
            workers = int(sys.argv[workers_index + 1])
            uvicorn_config["workers"] = workers
            uvicorn_config["reload"] = False  # Disable reload when using workers
            logger.warning(
                "Running with multiple workers. WebSocket connections require sticky sessions "
                "to work properly. Ensure your proxy/load balancer is configured correctly."
            )
        else:
            logger.error("Number of workers not specified after -w flag")
            sys.exit(1)

    # Add SSL configuration if HTTPS is requested
    if "--https" in sys.argv:
        uvicorn_config["ssl_keyfile"] = ssl_keyfile
        uvicorn_config["ssl_certfile"] = ssl_certfile

    uvicorn.run(**uvicorn_config)
