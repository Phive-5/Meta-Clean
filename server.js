const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get BASE_DIRS from environment variable or default to an empty array
const BASE_DIRS = process.env.BASE_DIRS ? process.env.BASE_DIRS.split(',').map(dir => dir.trim()) : [];

// Utility to check if a path is within BASE_DIRS
function isPathAllowed(filePath) {
    console.log('Checking if path is allowed:', filePath);
    return BASE_DIRS.some(baseDir => {
        const resolvedBase = path.resolve(baseDir);
        const resolvedTarget = path.resolve(filePath);
        const isAllowed = resolvedTarget.startsWith(resolvedBase);
        console.log(`Comparing base: ${resolvedBase} with target: ${resolvedTarget} - Allowed: ${isAllowed}`);
        return isAllowed;
    });
}

// Endpoint to get list of base directories or subdirectories dynamically
app.get('/api/directories', async (req, res) => {
    console.log('GET /api/directories request received');
    try {
        let directories = [];
        // If BASE_DIRS has multiple entries, use them directly
        if (BASE_DIRS.length > 1) {
            directories = BASE_DIRS;
        } else if (BASE_DIRS.length === 1) {
            // If only one base directory, list its subdirectories for more granular control
            const baseDir = BASE_DIRS[0];
            const subDirs = await fs.readdir(baseDir, { withFileTypes: true });
            directories.push(baseDir); // Include the base directory itself
            for (const dirent of subDirs) {
                if (dirent.isDirectory()) {
                    directories.push(path.join(baseDir, dirent.name));
                }
            }
        }
        console.log('Responded with directory list:', directories);
        res.json({ directories });
    } catch (error) {
        console.error('Error listing directories:', error);
        res.status(500).json({ error: 'Failed to list directories' });
    }
});

// Endpoint to scan directory for video files with metadata
app.post('/api/scan', async (req, res) => {
    console.log('POST /api/scan request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    const { directory } = req.body;
    console.log('Directory to scan:', directory);

    if (!directory || !isPathAllowed(directory)) {
        console.log('Invalid directory access attempted:', directory);
        return res.status(400).json({ error: 'Invalid directory path or access denied' });
    }

    console.log('Starting directory scan for:', directory);
    try {
        const results = await scanDirectory(directory);
        console.log('Scan completed, sending response with results:', {
            files_scanned: results.totalFiles,
            files_with_metadata: results.videoFiles.length,
            video_files: results.videoFiles
        });
        res.json({
            files_scanned: results.totalFiles,
            files_with_metadata: results.videoFiles.length,
            video_files: results.videoFiles
        });
    } catch (error) {
        console.error('Error during scan:', error);
        res.status(500).json({ error: error.message });
    }
});

// Function to scan directory
async function scanDirectory(dirPath) {
    console.log('Scanning directory:', dirPath);
    let totalFiles = 0;
    let videoFiles = [];

    try {
        console.log('Attempting to read directory contents for:', dirPath);
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        console.log(`Found ${entries.length} entries in ${dirPath}`);

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            console.log('Processing entry:', fullPath);

            if (entry.isDirectory()) {
                console.log(`${fullPath} is a directory, recursing...`);
                const subDirResults = await scanDirectory(fullPath);
                totalFiles += subDirResults.totalFiles;
                videoFiles = videoFiles.concat(subDirResults.videoFiles);
            } else if (entry.isFile()) {
                totalFiles++;
                console.log(`Checking if ${fullPath} is a video file`);
                const extension = path.extname(entry.name).toLowerCase();
                const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi'];

                if (videoExtensions.includes(extension)) {
                    console.log(`${fullPath} is a video file, extracting metadata`);
                    try {
                        const metadata = await getVideoMetadata(fullPath);
                        if (metadata.title || metadata.comments) {
                            console.log(`Video file with metadata found: ${fullPath}`);
                            videoFiles.push({
                                path: fullPath,
                                filename: entry.name,
                                title: metadata.title || '',
                                comments: metadata.comments || ''
                            });
                        } else {
                            console.log(`No relevant metadata found for ${fullPath}`);
                        }
                    } catch (err) {
                        console.error(`Error extracting metadata from ${fullPath}:`, err);
                    }
                } else {
                    console.log(`${fullPath} is not a video file (extension: ${extension})`);
                }
            } else {
                console.log(`${fullPath} is neither a file nor directory, skipping`);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }

    console.log(`Finished scanning ${dirPath}. Total files: ${totalFiles}, Video files with metadata: ${videoFiles.length}`);
    return { totalFiles, videoFiles };
}

// Function to get video metadata using fluent-ffmpeg
function getVideoMetadata(filePath) {
    console.log('Getting metadata for:', filePath);
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error(`Error probing ${filePath}:`, err);
                return resolve({ title: '', comments: '' });
            }
            console.log(`Metadata retrieved for ${filePath}`);
            const tags = metadata.format.tags || {};
            console.log(`Format tags for ${filePath}:`, tags);
            resolve({
                title: tags.title || '',
                comments: tags.comment || tags.COMMENT || ''
            });
        });
    });
}

// Endpoint to clean metadata for selected files
app.post('/api/clean', async (req, res) => {
    console.log('POST /api/clean request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    const { files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
        console.log('Invalid file list provided for cleaning');
        return res.status(400).json({ error: 'No files provided' });
    }

    const cleanedFiles = [];
    const errors = [];

    for (const filePath of files) {
        if (!isPathAllowed(filePath)) {
            console.log('Access denied to file outside allowed directories:', filePath);
            errors.push({ file: filePath, error: 'Access denied' });
            continue;
        }
        try {
            console.log(`Cleaning metadata for: ${filePath}`);
            await cleanMetadata(filePath);
            cleanedFiles.push(filePath);
        } catch (error) {
            console.error(`Error cleaning metadata for ${filePath}:`, error);
            errors.push({ file: filePath, error: error.message });
        }
    }

    console.log(`Metadata cleaning complete. Cleaned: ${cleanedFiles.length}, Errors: ${errors.length}`);
    res.json({
        cleaned_files: cleanedFiles,
        errors: errors
    });
});

// Function to clean metadata using Python script
function cleanMetadata(filePath) {
    console.log('Initiating metadata cleaning for:', filePath);
    return new Promise((resolve, reject) => {
        const command = `python3 clean_metadata.py "${filePath}"`;
        console.log(`Executing command: ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Python script for ${filePath}:`, error);
                console.error(stderr);
                return reject(new Error(`Failed to clean metadata: ${error.message}`));
            }
            console.log(stdout);
            console.log('Metadata cleaning completed for:', filePath);
            resolve();
        });
    });
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Base directories:', BASE_DIRS);
});
