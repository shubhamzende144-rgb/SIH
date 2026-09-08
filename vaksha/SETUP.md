# Vaksha Voice Integrity Platform - Setup Guide

This guide will help you set up and run the Vaksha Voice Integrity Platform on your local machine.

## Prerequisites

1. **Python 3.10+**: Ensure Python is installed.
2. **FFmpeg**: Required for processing audio files (like MP3/M4A).
   - **Mac**: `brew install ffmpeg`
   - **Linux**: `sudo apt-get install ffmpeg`
   - **Windows**: Install via `winget install ffmpeg` or download from the official site.
3. **Supabase Account**: A Supabase project is required to store trusted voice identities and embeddings.

## 1. Environment Setup

Clone the repository and navigate to the `vaksha` directory:
```bash
cd vaksha
```

Create a virtual environment and install the required dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install supabase  # Required for database synchronization
```

## 2. Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit the `.env` file and configure your variables:
```ini
MOCK_ENGINES=0
DATABASE_URL=sqlite:///./data/vaksha.db

# Supabase Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Optional Hugging Face Token (if your models require auth)
HF_TOKEN=
```

> **IMPORTANT**: You must use the `SUPABASE_SERVICE_ROLE_KEY` (not the public anon key) because the application needs permission to write and delete records in the Supabase tables.

## 3. Database Initialization

Run the seed script to create the local SQLite database schema (`data/vaksha.db`) and set up the default admin user:

```bash
python scripts/seed.py
```

## 4. Running the Server

Start the FastAPI application using Uvicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- The UI will be available at: http://localhost:8000
- The API Documentation (Swagger) will be at: http://localhost:8000/docs

## 5. Supabase Schema Setup

Ensure your Supabase project has the following tables created:

**Table: `people`**
- `id` (uuid, primary key, default `uuid_generate_v4()`)
- `person_code` (text, unique)
- `name` (text)
- `role` (text)
- `role_title` (text)
- `org` (text)
- `official_callback` (text)
- `consent` (boolean)
- `created_at` (timestamp, default `now()`)
*(Optional extra columns as per your schema: `phone`, `callback_phone`)*

**Table: `voiceprints`**
- `id` (uuid, primary key)
- `person_id` (uuid, foreign key to `people.id`)
- `embedding` (vector or JSON/text depending on your setup)
- `created_at` (timestamp, default `now()`)

## Troubleshooting

- **Audio File Errors (`Internal Server Error` on Enroll)**: Make sure `ffmpeg` is fully installed. Check by running `ffmpeg -version` in your terminal.
- **Supabase Sync Errors**: Verify that your `.env` contains the correct URL and Service Role Key. Ensure the table columns exactly match the schema above.
- **Port 8000 in Use**: If you get an `Address already in use` error, kill the existing process using `lsof -ti:8000 | xargs kill -9` (on Mac/Linux).
