FROM python:3.11-slim

# System deps (if you need build tools, add them here)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Workdir
WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your app
COPY . .

# Environment
ENV PYTHONUNBUFFERED=1
ENV FLASK_RUN_HOST=0.0.0.0

# Expose app port (must match gunicorn binding & docker-compose)
EXPOSE 5050

# Use gunicorn with app factory
# app:create_app() matches your FLASK_APP definition
#CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5050", "app:create_app()"]
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5050", "--timeout", "60", "--graceful-timeout", "30", "--access-logfile", "-", "--error-logfile", "-", "app:create_app()"]

