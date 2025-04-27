# Base image with Node.js
FROM node:18-alpine

# Install FFmpeg for metadata handling
RUN apk add --no-cache ffmpeg

# Install Python and pip for metadata cleaning script
RUN apk add --no-cache python3 py3-pip

# Install mutagen for Python metadata cleaning
RUN pip3 install mutagen --break-system-packages

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose port for the application
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
