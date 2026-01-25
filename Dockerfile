FROM python:3.11-slim

# Install system dependencies (ffmpeg is required for yt-dlp audio extraction)
RUN apt-get update && \
    apt-get install -y ffmpeg curl wget nodejs && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /app

ENV PYTHONUNBUFFERED=1

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .
# Run the server using gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "3600", "--access-logfile", "-", "--error-logfile", "-", "server:app"]
