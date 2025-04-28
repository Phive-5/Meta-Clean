# Base image with Node.js
FROM node:18-alpine

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Install Python and pip for mutagen
RUN apk add --no-cache python3 py3-pip

# Install mutagen and additional dependencies for MKV support
RUN pip3 install mutagen --break-system-packages
RUN pip3 install pymediainfo --break-system-packages

# Install exiftool for metadata manipulation
RUN apk add --no-cache exiftool

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3000

# Add Unraid labels
LABEL net.unraid.icon="https://raw.githubusercontent.com/yourusername/yourrepository/main/icon.png"
LABEL net.unraid.description="Phive-MetaClean-Docker - A tool to clean metadata from video files"
LABEL net.unraid.category="Media Tools"

# Command to run the application
CMD ["node", "server.js"]
