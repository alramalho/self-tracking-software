<div align="center">

# 🎯


# Welcome to your<br/>**tracking.so*ftware***

[Open App](https://app.tracking.so)

[👋 Join the community](https://discord.gg/xMVb7YmQMQ)  of builders & lifestyle enthusiasts

<a href="https://ko-fi.com/alexramalho">
  <img src="https://img.shields.io/badge/Support-❤️-black?style=for-the-badge" alt="Support open source" />
</a>

<div class="flex flex-col items-center gap-4">

  <a href="https://discord.gg/xMVb7YmQMQ" style="
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: hsl(0 0% 9%);
    color: white;
    text-decoration: none;
    transition: background-color 150ms;
    cursor: pointer;
    border: 1px solid hsl(0 0% 9%);
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  ">
    
  </a>

  <img src="assets/img1.PNG" width="400px" alt="iPhone screenshot" />
</div>
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
