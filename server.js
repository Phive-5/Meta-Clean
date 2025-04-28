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

/**
 * Checks if a given file path is within the allowed base directories.
 * @param {string} filePath - The file path to check.
 * @returns {boolean} - True if the path is allowed, false otherwise.
 */
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

/**
 * Endpoint to get list of base directories or subdirectories dynamically.
 */
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

/**
 * Endpoint to scan directory for video files with metadata.
 */
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

/**
 * Scans a directory recursively for video files and extracts metadata.
 * @param {string} dirPath - The directory path to scan.
 * @returns {Promise<Object>} - Object containing total files scanned and video files with metadata.
 */
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
            if (entry.isDirectory()) {
                console.log(`Entering subdirectory: ${fullPath}`);
                const subResults = await scanDirectory(fullPath);
                totalFiles += subResults.totalFiles;
                videoFiles = videoFiles.concat(subResults.videoFiles);
            } else if (entry.isFile()) {
                totalFiles++;
                const ext = path.extname(entry.name).toLowerCase();
                if (['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(ext)) {
                    console.log(`Processing video file: ${fullPath}`);
                    try {
                        const metadata = await getVideoMetadata(fullPath);
                        if (metadata && (metadata.title || metadata.comment || metadata.comments)) {
                            console.log(`Found metadata in ${entry.name}:`, {
                                title: metadata.title || 'None',
                                comment: metadata.comment || metadata.comments || 'None'
                            });
                            videoFiles.push({
                                name: entry.name,
                                path: fullPath,
                                title: metadata.title || '',
                                comment: metadata.comment || metadata.comments || ''
                            });
                        } else {
                            console.log(`No relevant metadata found in ${entry.name}`);
                        }
                    } catch (err) {
                        console.error(`Error processing ${fullPath}:`, err);
                    }
                } else {
                    console.log(`Skipping non-video file: ${fullPath}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }

    return { totalFiles, videoFiles };
}

/**
 * Extracts metadata from a video file using fluent-ffmpeg.
 * @param {string} filePath - Path to the video file.
 * @returns {Promise<Object>} - Metadata object containing tags.
 */
async function getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error(`ffprobe error for ${filePath}:`, err);
                return reject(err);
            }
            resolve(metadata.format.tags || {});
        });
    });
}

/**
 * Endpoint to clean metadata for selected files.
 */
app.post('/api/clean', async (req, res) => {
    console.log('POST /api/clean request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
        console.log('No valid files provided for cleaning:', files);
        return res.status(400).json({ error: 'No files provided for cleaning' });
    }

    // Validate all file paths before processing
    const invalidFiles = files.filter(file => !isPathAllowed(file));
    if (invalidFiles.length > 0) {
        console.log('Access denied to some files:', invalidFiles);
        return res.status(400).json({ error: 'Access denied to one or more files' });
    }

    console.log(`Cleaning metadata for ${files.length} files`);
    try {
        let successful = 0;
        let failed = 0;
        const errors = [];

        for (const filePath of files) {
            console.log(`Cleaning metadata for: ${filePath}`);
            try {
                const result = await cleanMetadata(filePath);
                if (result.success) {
                    successful++;
                    console.log(`Successfully cleaned metadata for: ${filePath}`);
                } else {
                    failed++;
                    errors.push(`Failed to clean ${filePath}: ${result.error}`);
                    console.error(`Failed to clean metadata for: ${filePath}`, result.error);
                }
            } catch (error) {
                failed++;
                errors.push(`Error cleaning ${filePath}: ${error.message}`);
                console.error(`Error cleaning metadata for: ${filePath}`, error);
            }
        }

        console.log(`Cleaning completed. Successful: ${successful}, Failed: ${failed}`);
        if (failed === 0) {
            res.json({ message: `Successfully cleaned metadata from ${successful} file(s)` });
        } else {
            res.status(500).json({ 
                message: `Cleaned ${successful} file(s), failed on ${failed} file(s)`, 
                errors: errors 
            });
        }
    } catch (error) {
        console.error('Unexpected error during cleaning:', error);
        res.status(500).json({ error: 'Unexpected error during cleaning: ' + error.message });
    }
});

/**
 * Cleans metadata from a video file using a Python script.
 * @param {string} filePath - Path to the video file.
 * @returns {Promise<Object>} - Result object with success status and error if any.
 */
async function cleanMetadata(filePath) {
    return new Promise((resolve) => {
        console.log(`Executing Python script to clean metadata for: ${filePath}`);
        const command = `python3 clean_metadata.py "${filePath.replace(/"/g, '\"')}"`;
        console.log(`Command: ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Python script for ${filePath}:`, error);
                console.error(`stderr: ${stderr}`);
                resolve({ success: false, error: error.message });
                return;
            }
            try {
                console.log(`Python script output for ${filePath}:`, stdout);
                const result = JSON.parse(stdout);
                if (result && result.length > 0 && result[0].status === 'success') {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: result[0].message || 'Unknown error from script' });
                }
            } catch (parseError) {
                console.error(`Failed to parse Python script output for ${filePath}:`, parseError);
                console.error(`stdout was: ${stdout}`);
                resolve({ success: false, error: 'Failed to parse script output' });
            }
        });
    });
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Base directories:', BASE_DIRS);
});
