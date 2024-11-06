from loguru import logger
import sys

if __name__ == "__main__":
    import uvicorn
    from pyngrok import ngrok

    port = 8000
    public_url = ngrok.connect(port).public_url
    logger.info(
        "Webhook link to use (NGROK tunnel):\n"
        + public_url
        + "/clerk/webhook",
    )

    ssl_keyfile = "../localhost.key"
    ssl_certfile = "../localhost.crt"

    if "--https" in sys.argv:
        uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True, ssl_keyfile=ssl_keyfile, ssl_certfile=ssl_certfile)
    else:
        uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
