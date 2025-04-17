import sys
import os

# Temporarily redirect stdout/stderr to suppress import noise
original_stdout = sys.stdout
original_stderr = sys.stderr
sys.stdout = open(os.devnull, 'w')
sys.stderr = open(os.devnull, 'w')

try:
    from app import app
finally:
    # Restore stdout/stderr
    sys.stdout.close()
    sys.stderr.close()
    sys.stdout = original_stdout
    sys.stderr = original_stderr

existing_routes = set()
# this should iterate through all the routes in the app and add them to ../aws-infrastructure/allowed-routes.txt
with open("../aws-infrastructure/allowed-routes.txt", "w") as f:
    f.write("# this is a generated file, do not edit!\n")
    for route in app.routes:
        route_path = route.path.strip()
        if route_path not in existing_routes:
            f.write(route_path + "\n")
            existing_routes.add(route_path)

print("✅ Done updating allowed routes")