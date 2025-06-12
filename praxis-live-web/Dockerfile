FROM python:3.11-slim

WORKDIR /app

# Copy the PraxisLIVE web files
COPY . .

# Create projects directory
RUN mkdir -p projects

# Make the server executable
RUN chmod +x server.py

# Expose the PraxisLIVE web interface port
EXPOSE 8000

# Run the PraxisLIVE web server
CMD ["python", "server.py", "8000"]