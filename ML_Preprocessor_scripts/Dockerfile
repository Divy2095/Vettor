# Python ML Pipeline Dockerfile
FROM python:3.11-slim

WORKDIR /app/ml_pipeline

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Skip spaCy model download at build time on free tier to keep build fast and stable
RUN echo 'Skipping spaCy model download during build'

# Copy application code
COPY ml_api_server.py .
COPY pipeline ./pipeline
COPY search ./search
COPY scripts ./scripts
COPY data ./data

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app/ml_pipeline
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import flask, fitz; print('OK')" || exit 1

# Default command for Render/container deployments
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 1 --threads 2 --timeout 120 --graceful-timeout 30 ml_api_server:app"]
