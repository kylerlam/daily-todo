FROM python:3.13-slim-bookworm@sha256:281d39ff02e3b389401586134ff9e6572954687822a58055ec07a60ded4e0b7f
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/data DIST_DIR=/app/dist TZ=Asia/Hong_Kong
COPY backend/ ./backend/
COPY dist/ ./dist/
EXPOSE 8080
CMD ["python", "backend/server.py"]
