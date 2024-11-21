from app import app
from mangum import Mangum

lambda_handler = Mangum(app)
