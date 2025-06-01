import os
from loguru import logger
import sys
import subprocess
import threading

if __name__ == "__main__":
    import uvicorn

    port = 8000
    
    # Start localtunnel in a separate thread
    def start_localtunnel():
        try:
            logger.info("Starting localtunnel...")
            # Run localtunnel command with Popen for better output handling
            process = subprocess.Popen(
                ["lt", "--port", str(port), "--subdomain", "alex-trackingsoftware"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Read the output to get the tunnel URL
            for line in process.stdout:
                logger.info(f"LocalTunnel output: {line.strip()}")
                if "your url is:" in line.lower() or "https://" in line:
                    # Extract URL from the output
                    if "https://" in line:
                        public_url = line.strip().split()[-1]
                        if public_url.startswith("https://"):
                            logger.ingo(
                                "\033[94mWebhook link to use (LocalTunnel):\n"
                                + public_url
                                + "/clerk/webhook\n"
                                + public_url
                                + "/stripe/webhook\033[0m"
                            )
                            os.environ["API_URL"] = public_url
                            break
            
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to start localtunnel: {e}")
            logger.error(f"Error output: {e.stderr}")
        except FileNotFoundError:
            logger.error("localtunnel (lt) command not found. Please install it with: npm install -g localtunnel")
        except Exception as e:
            logger.error(f"Unexpected error starting localtunnel: {e}")

    # Start localtunnel in background
    logger.info("Initializing localtunnel in background...")
    tunnel_thread = threading.Thread(target=start_localtunnel, daemon=True)
    tunnel_thread.start()

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
