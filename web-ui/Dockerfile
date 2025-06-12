FROM python:3.11-slim

WORKDIR /app

# Copy the web interface files
COPY . .

# Make the server executable
RUN chmod +x server.py

# Expose the web interface port
EXPOSE 9000

# Run the web server
CMD ["python", "server.py", "9000"]