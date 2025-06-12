# PraxisCORE Deployment Guide

## Overview

PraxisCORE v6.3.0-SNAPSHOT has been successfully built and containerized for deployment. This is a modular JVM runtime for cyberphysical programming with real-time capabilities.

## Prerequisites

- Java 21+ (for local development)
- Docker (for containerized deployment)
- Maven (included via wrapper)

## Build Status

✅ **Local Build**: Successful  
✅ **Docker Image**: Built successfully  
✅ **Test Suite**: All tests passed  

## Local Development

### Building from Source

```bash
# Build the application
./mvnw clean package -DskipTests

# Run tests
./mvnw test

# Run test suite
./praxiscore-bin/target/praxiscore/bin/praxis -f ./testsuite/
```

### Running Locally

```bash
# Interactive mode
./praxiscore-bin/target/praxiscore/bin/praxis --interactive

# With network access on port 8080
./praxiscore-bin/target/praxiscore/bin/praxis --network all --port 8080

# Run a script file
./praxiscore-bin/target/praxiscore/bin/praxis -f path/to/script.pxr
```

## Docker Deployment

### Quick Deploy

Use the provided deployment script:

```bash
# Deploy with default settings (port 8080)
./deploy.sh

# Deploy with custom tag and port
./deploy.sh v1.0 9090
```

### Manual Docker Commands

```bash
# Build image
docker build -t praxiscore:latest .

# Run container
docker run -d \
  --name praxiscore-runtime \
  -p 8080:8080 \
  -v $(pwd)/data:/opt/praxiscore/data \
  praxiscore:latest

# View logs
docker logs praxiscore-runtime

# Access container shell
docker exec -it praxiscore-runtime /bin/bash
```

## Configuration

### Environment Variables

- `PRAXIS_HOME`: Application home directory (default: `/opt/praxiscore`)
- `PRAXIS_USER_DIR`: User data directory (default: `/opt/praxiscore/data`)

### Ports

- **8080**: Default application port (configurable)
- Network access supports both local loopback and external connections

### Data Persistence

The container mounts a volume at `/opt/praxiscore/data` for user projects and data persistence.

## Cloud Deployment Options

### 1. Docker-based Platforms

- **Railway**: `railway up` (requires railway.json configuration)
- **DigitalOcean App Platform**: Deploy from GitHub with Dockerfile
- **Google Cloud Run**: `gcloud run deploy`
- **AWS ECS/Fargate**: Use the built Docker image

### 2. Traditional VPS

```bash
# Transfer files
scp -r praxiscore-bin/target/praxiscore/ user@server:/opt/

# Install Java 21 on server
sudo apt update && sudo apt install openjdk-21-jdk

# Run on server
cd /opt/praxiscore && ./bin/praxis --network all --port 8080
```

## Monitoring and Management

### Health Checks

The Docker container includes a health check endpoint. Container status can be monitored via:

```bash
docker ps --filter name=praxiscore-runtime
docker inspect praxiscore-runtime --format='{{.State.Health.Status}}'
```

### Application Logs

```bash
# Real-time logs
docker logs -f praxiscore-runtime

# Recent logs
docker logs --tail 100 praxiscore-runtime
```

## Architecture Notes

- **Multi-module Maven project** with 26+ modules
- **Forest-of-actors runtime** architecture
- **Real-time system support** with runtime code changes
- **Network-enabled** for remote connections
- **Platform-independent** Java application

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change the host port in deployment commands
2. **Memory issues**: Add `-m 2g` to docker run for memory limits
3. **Network access**: Ensure `--network all` for external connections

### Debug Mode

```bash
# Run with verbose logging
docker run -it --rm praxiscore:latest ./bin/praxis --show-environment --interactive
```

## Security Considerations

- Container runs as non-root user `praxis`
- Network access is configurable (local vs external)
- Data directory is isolated and mountable
- No sensitive data is embedded in the image

## Next Steps

1. Set up CI/CD pipeline for automated builds
2. Configure monitoring and alerting
3. Set up backup strategy for data directory
4. Consider load balancing for multiple instances