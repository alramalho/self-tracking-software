
from app import app

# this should iterate through all the routes in the app and add them to ../aws-infrastructure/allowed-routes.txt
with open("../aws-infrastructure/allowed-routes.txt", "w") as f:
    f.write("# this is a generated file, do not edit!\n")
    for route in app.routes:
        f.write(route.path + "\n")

print("✅ Done")