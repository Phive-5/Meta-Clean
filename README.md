# Phive-MetaClean-Docker

## Overview

Phive-MetaClean-Docker is a Dockerized application designed to scan video files for metadata and clean it, helping maintain privacy and organize media collections. This version is optimized for deployment on Unraid servers, utilizing Node.js with Express for the backend and a web frontend for user interaction.

## Features

- **Directory Scanning**: Scan specified directories for video files and identify those with metadata.
- **Metadata Cleaning**: Remove metadata from selected video files to ensure privacy.
- **Web Interface**: User-friendly interface to select directories, view scan results, and initiate cleaning.
- **Docker Deployment**: Easily deployable on Unraid servers with pre-configured directory mappings.

## Prerequisites

- Docker installed on your system or Unraid server.
- FFmpeg installed within the Docker container (already included in the image).

## Installation

1. **Pull the Docker Image**:
   ```bash
   docker pull galvatrondeva/phive-metaclean-docker:latest
   ```

2. **Run the Container on Unraid**:
   - Access your Unraid Web UI.
   - Go to the "Docker" tab and click "Add Container".
   - Use the following configuration:
     - **Repository**: `galvatrondeva/phive-metaclean-docker:latest`
     - **Port Mappings**: Map container port `3000` to a host port of your choice (e.g., `3005`).
     - **Volume Mappings**: Map your media directories (e.g., `/Movies`, `/TV Shows`) to the container with the same paths.
   - Start the container.

3. **Access the Web Interface**:
   - Open your browser and navigate to `http://your-unraid-ip:chosen-port` (e.g., `http://192.168.1.100:3005`).

## Usage

1. **Select Directory**:
   - Use the dropdown to select a pre-configured directory or enter a custom path within the allowed directories.
2. **Scan for Metadata**:
   - Click "Scan Directory" to search for video files with metadata.
3. **Review Results**:
   - View the list of files with metadata, including filename, path, title, and comments.
4. **Clean Metadata**:
   - Select files and click "Clean Metadata" to remove metadata from the chosen files.

## Troubleshooting

- **Scanning Issues**: If scanning doesn't return results, check the container logs for detailed error messages. Ensure the directory paths are correctly mapped and accessible within the container.
- **Logs**: Access logs via Unraid's Docker interface to diagnose issues. The application includes detailed logging to help identify problems with directory scanning or metadata cleaning.

## Development

To contribute or modify the application:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/phive-metaclean-docker.git
   cd phive-metaclean-docker
   ```

2. **Make Changes**:
   - Edit the code as needed. The main files are:
     - `server.js`: Backend logic for scanning and cleaning.
     - `public/app.js`: Frontend JavaScript for UI interaction.
     - `public/index.html`: HTML for the web interface.

3. **Build and Test Locally**:
   ```bash
   docker build -t phive-metaclean-docker:test .
   docker run -p 3000:3000 phive-metaclean-docker:test
   ```

4. **Push Changes**:
   - Commit and push your changes to GitHub.
   - Update the Docker image on Docker Hub if necessary.

## License

[Specify your license here, e.g., MIT, GPL, etc.]

## Contact

For support or inquiries, please open an issue on the GitHub repository or contact [your contact information].
