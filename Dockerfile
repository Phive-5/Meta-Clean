# Base image with Node.js
FROM node:18-alpine

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Install MKVToolNix for in-place metadata editing of MKV files
RUN apk add --no-cache mkvtoolnix

# Verify mkvpropedit is installed and in PATH
RUN echo "Checking for mkvpropedit..." && which mkvpropedit && mkvpropedit --version || { echo "mkvpropedit not found, exiting with error"; exit 1; }

# Install Python and pip for mutagen
RUN apk add --no-cache python3 py3-pip

# Install mutagen and additional dependencies for MKV support
RUN pip3 install mutagen --break-system-packages

# Install exiftool for metadata manipulation - Removed as not needed for video focus
# RUN apk add --no-cache exiftool

# Set working directory
WORKDIR /app

# Add label for Unraid icon
LABEL org.opencontainers.image.icon="https://raw.githubusercontent.com/galvatrondeva/phive-metaclean-docker/main/public/favicon.ico"

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3000

# Add Unraid labels
LABEL net.unraid.icon="https://raw.githubusercontent.com/Phive-5/Meta-Clean/master/icon.png"
LABEL net.unraid.description="Phive-MetaClean-Docker - A tool to clean metadata from video files"
LABEL net.unraid.category="Media Tools"

# Command to run the application
CMD ["node", "server.js"]
