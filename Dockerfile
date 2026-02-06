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

ENV PYTHONPATH=/app/src

# Copy the application code
COPY . .
# Copy and set up entrypoint
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Run the server
CMD ["./entrypoint.sh"]
