<div align="center">

# 🎯

# Welcome to your<br/>**tracking.so*ftware***

An app that helps you achieve your activity goals, together.

[Open App](https://app.tracking.so)

<a href="https://ko-fi.com/alexramalho">
  <img src="https://img.shields.io/badge/Support-❤️-black?style=for-the-badge" alt="Support open source" />
</a>

<img src="assets/img1.PNG" width="400px" alt="iPhone screenshot" />
</div>

<br/>

## Running locally

To run the project locally, follow these steps:

1. Navigate to the frontend directory and start the development server:

   ```sh
   cd frontend
   yarn dev
   ```

2. Navigate to the backend directory and start the backend server:
   ```sh
   cd backend
   python -m main
   ```

## Installing dependencies

1. Ensure all dependencies are installed beforehand.

   **frontend**

   ```sh
   yarn
   ```

   **backend** <small>We recommended to use a local virtual environment (.venv):</smalll>

   ```sh
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Make sure you have a [ngrok account and auth token setup](https://ngrok.com/docs/getting-started/)
3. Make sure you create and link your [clerk](https://clerk.com/) account and link the necessary env vars
   - frontend
     - `CLERK_SECRET_KEY`
     - `CLERK_JWT_PUBLIC_KEY`
   - backend
     - `CLERK_JWT_PUBLIC_KEY` (get this in API Keys > Show JWT Public Key)
4.
