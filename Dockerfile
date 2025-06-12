# Runtime stage - using pre-built application
FROM openjdk:21-jdk-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -s /bin/bash praxis

# Set working directory
WORKDIR /opt/praxiscore

# Copy built application (assumes local build was done)
COPY praxiscore-bin/target/praxiscore ./

# Create data directory for user projects
RUN mkdir -p /opt/praxiscore/data && \
    chown -R praxis:praxis /opt/praxiscore

# Switch to app user
USER praxis

# Expose default port (will be auto-assigned)
EXPOSE 8080

# Set environment variables
ENV PRAXIS_HOME=/opt/praxiscore
ENV PRAXIS_USER_DIR=/opt/praxiscore/data

# Note: PraxisCORE uses custom protocol, not HTTP, so no health check endpoint

# Default command - run interactive mode on configurable port
CMD ["sh", "-c", "./bin/praxis --network all --port ${PORT:-8080} --interactive"]