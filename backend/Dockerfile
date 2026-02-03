FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for SQLite and general tools
RUN apt-get update && apt-get install -y --no-install-recommends \
  sqlite3 \
  && rm -rf /var/lib/apt/lists/*

# Install uv for extremely fast dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy requirements
COPY requirements.txt .

# Install dependencies using uv
# --system is used because we are in a container and don't need a venv
RUN uv pip install --no-cache --system -r requirements.txt

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
