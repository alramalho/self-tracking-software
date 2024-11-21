# Dockerfile for backend lambda
FROM python:3.11 as build-image

# Define function directory
ARG FUNCTION_DIR="/function"

# Create function directory
RUN mkdir -p ${FUNCTION_DIR}
COPY . ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

# Install dependencies
RUN pip install --no-cache-dir awslambdaric
RUN pip install --no-cache-dir -r requirements.txt

# Use more specific entry point for Lambda
ENTRYPOINT [ "/usr/local/bin/python", "-m", "awslambdaric" ]
CMD [ "lambda_app.lambda_handler" ]
