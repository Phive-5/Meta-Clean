document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const cleanButton = document.getElementById('cleanSelectedButton');
    const directorySelect = document.getElementById('directorySelect');
    const statusDiv = document.getElementById('status');
    const toggleAllCheckbox = document.getElementById('selectAllButton');
    const notificationDiv = document.getElementById('notification');
    let isScanning = false;
    let isCleaning = false;
    let animationInterval;

    /**
     * Updates the status message with animated dots to indicate ongoing operations.
     * @param {string} message - The status message to display.
     */
    function updateStatus(message) {
        statusDiv.textContent = message;
        statusDiv.classList.add('loading');
        let dots = 0;
        if (animationInterval) {
            clearInterval(animationInterval);
        }
        animationInterval = setInterval(() => {
            if ((isScanning || isCleaning) && (statusDiv.textContent.startsWith('Scanning') || statusDiv.textContent.startsWith('Cleaning'))) {
                dots = (dots + 1) % 4;
                statusDiv.textContent = message + '.'.repeat(dots);
            } else {
                clearInterval(animationInterval);
            }
        }, 500);
    }

    /**
     * Clears the status message and stops any ongoing animation.
     */
    function clearStatus() {
        statusDiv.textContent = 'Ready';
        statusDiv.classList.remove('loading');
        if (animationInterval) {
            clearInterval(animationInterval);
        }
        updateProgressBar(0); // Reset progress bar when status is cleared
    }

    /**
     * Updates the progress bar with the given percentage.
     * @param {number} percentage - The percentage of completion (0-100).
     */
    function updateProgressBar(percentage) {
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressPercentage = document.getElementById('progressPercentage');
        
        if (percentage > 0) {
            progressContainer.style.display = 'block';
            progressBar.style.width = `${percentage}%`;
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        } else {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';
        }
    }

    /**
     * Simulates progress for the scanning operation (placeholder until server-side progress tracking is implemented).
     */
    function simulateScanProgress() {
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (isScanning) {
                progress += Math.random() * 10; // Random increment to simulate varying scan speeds
                if (progress > 90) {
                    progress = 90; // Cap at 90% until scan completes
                }
                updateProgressBar(progress);
            } else {
                clearInterval(progressInterval);
                updateProgressBar(100); // Set to 100% when scan completes
                setTimeout(() => updateProgressBar(0), 1000); // Reset after a delay
            }
        }, 300);
    }

    /**
     * Displays a temporary notification message to the user.
     * @param {string} message - The message to display.
     * @param {string} type - The type of notification ('success' or 'error').
     */
    function showNotification(message, type = 'success') {
        notificationDiv.textContent = message;
        notificationDiv.classList.add(type === 'success' ? 'success' : 'error');
        notificationDiv.style.display = 'block';
        setTimeout(() => {
            notificationDiv.style.display = 'none';
            notificationDiv.classList.remove('success', 'error');
        }, 3000);
    }

    /**
     * Disables UI controls during operations to prevent multiple actions.
     */
    function disableControls() {
        scanButton.disabled = true;
        cleanButton.disabled = true;
        directorySelect.disabled = true;
    }

    /**
     * Enables UI controls after operations complete.
     */
    function enableControls() {
        scanButton.disabled = false;
        cleanButton.disabled = false;
        directorySelect.disabled = false;
    }

    /**
     * Fetches the list of directories from the server and populates the dropdown.
     */
    async function fetchDirectories() {
        try {
            const response = await fetch('/api/directories');
            const data = await response.json();
            if (response.ok) {
                directorySelect.innerHTML = '<option value="">Select a directory</option>';
                data.directories.forEach(dir => {
                    const option = document.createElement('option');
                    option.value = dir;
                    option.textContent = dir;
                    directorySelect.appendChild(option);
                });
            } else {
                showNotification(`Error fetching directories: ${data.message}`, 'error');
            }
        } catch (error) {
            showNotification(`Error fetching directories: ${error.message}`, 'error');
        }
    }

    /**
     * Binds event listeners to UI elements for user interactions.
     */
    function bindEventListeners() {
        scanButton.addEventListener('click', scanDirectory);
        toggleAllCheckbox.addEventListener('click', selectAll);
        cleanButton.addEventListener('click', cleanSelected);
        directorySelect.addEventListener('change', function() {
            updateInputField(this.value);
        });
    }

    /**
     * Updates the directory input field with the selected value from the dropdown.
     * @param {string} value - The directory path to set in the input field.
     */
    function updateInputField(value) {
        document.getElementById('directoryInput').value = value;
    }

    /**
     * Initiates a scan of the selected directory for video files with metadata.
     */
    function scanDirectory() {
        console.log('scanDirectory function called');
        const directory = document.getElementById('directoryInput').value || directorySelect.value;
        if (!directory) {
            document.getElementById('status').textContent = 'Please enter or select a directory.';
            showNotification('Please select a directory', 'error');
            return;
        }
        isScanning = true;
        updateStatus('Scanning directory');
        simulateScanProgress(); // Start simulated progress
        console.log('Sending POST request to /api/scan with directory:', directory);
        fetch('/api/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ directory })
        })
        .then(response => {
            console.log('Response received from /api/scan', response);
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Unknown error');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Scan results received:', data);
            isScanning = false;
            document.getElementById('status').textContent = 'Scan complete.';
            // Check the structure of the response
            let files = [];
            if (Array.isArray(data)) {
                files = data;
            } else if (data.video_files && Array.isArray(data.video_files)) {
                files = data.video_files;
            } else {
                console.error('Unexpected data structure from server:', data);
                document.getElementById('status').textContent = 'Error: Unexpected data format from server.';
                return;
            }
            document.getElementById('totalFiles').textContent = data.files_scanned || files.length;
            document.getElementById('metadataFiles').textContent = data.files_with_metadata || files.length;
            displayResults(files);
            clearStatus(); // Clear status message after scan completes
            showNotification(`Scan completed: ${data.files_scanned} file(s) scanned`);
        })
        .catch(error => {
            console.error('Error scanning directory:', error);
            isScanning = false;
            if (error.message.includes('access denied')) {
                document.getElementById('status').textContent = 'Error: Access denied to the specified directory.';
            } else if (error.message.includes('No video files found')) {
                document.getElementById('status').textContent = 'No video files found in the directory.';
            } else {
                document.getElementById('status').textContent = `Error scanning directory: ${error.message}`;
            }
            showNotification(`Error: ${error.message}`, 'error');
        });
    }

    /**
     * Displays the scan results in the table format on the UI.
     * @param {Array} files - List of file objects with metadata to display.
     */
    function displayResults(files) {
        console.log('Displaying scan results');
        const tbody = document.getElementById('resultsBody');
        tbody.innerHTML = '';
        let metadataCount = 0;
        if (Array.isArray(files)) {
            files.forEach((file, index) => {
                if (file.title || file.comment || file.comments) {
                    metadataCount++;
                    const row = document.createElement('tr');
                    row.id = `row-${index}`;
                    row.innerHTML = `
                        <td><input type="checkbox" id="check-${index}" onchange="toggleRowSelection(${index})"></td>
                        <td>${file.name || file.filename || 'Unknown'}
                            <div class="tooltip">Path: ${file.path}</div>
                        </td>
                        <td>${file.title || ''}</td>
                        <td>${file.comment || file.comments || ''}</td>
                    `;
                    tbody.appendChild(row);
                }
            });
        } else {
            console.error('Files is not an array:', files);
            document.getElementById('status').textContent = 'Error: No valid file data to display.';
        }
        document.getElementById('metadataFiles').textContent = metadataCount;
        console.log(`Total files: ${files.length}, Files with metadata: ${metadataCount}`);
    }

    /**
     * Toggles the selection state of a row in the results table.
     * @param {number} index - The index of the row to toggle.
     */
    function toggleRowSelection(index) {
        const row = document.getElementById(`row-${index}`);
        const checkbox = document.getElementById(`check-${index}`);
        if (checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    }

    /**
     * Selects all rows in the results table for cleaning.
     */
    function selectAll() {
        console.log('Selecting all rows');
        const checkboxes = document.querySelectorAll('#resultsTable input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = true;
            document.getElementById(`row-${index}`).classList.add('selected');
        });
    }

    /**
     * Initiates cleaning of metadata for selected files.
     */
    function cleanSelected() {
        console.log('Cleaning metadata for selected files');
        const selectedFiles = [];
        const checkboxes = document.querySelectorAll('#resultsTable input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const filePath = row.cells[1].querySelector('.tooltip').textContent.split(': ')[1];
            selectedFiles.push(filePath);
        });
        if (selectedFiles.length === 0) {
            document.getElementById('status').textContent = 'No files selected for cleaning.';
            showNotification('No files selected for cleaning', 'error');
            return;
        }
        document.getElementById('status').textContent = 'Cleaning metadata... Please be patient';
        updateStatus('Cleaning metadata');
        console.log('Sending POST request to /api/clean with files:', selectedFiles);
        fetch('/api/clean', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: selectedFiles })
        })
        .then(response => {
            console.log('Response received from /api/clean', response);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Cleaning results received:', data);
            document.getElementById('status').textContent = data.message;
            scanDirectory();
            clearStatus();
            showNotification(data.message);
        })
        .catch(error => {
            console.error('Error cleaning metadata:', error);
            document.getElementById('status').textContent = 'Error cleaning metadata.';
            showNotification(`Error: ${error.message}`, 'error');
        });
    }

    /**
     * Starts the dot animation for status indication during operations.
     * @param {string} text - The text to display with the animation.
     * @deprecated This function is no longer used as the dot animation element is not present in the HTML.
     */
    function startDotAnimation(text) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = text;
        const dotElement = document.getElementById('dot');
        if (dotElement) {
            dotElement.classList.add('animate');
        }
    }

    /**
     * Stops the dot animation after operations complete.
     * @deprecated This function is no longer used as the dot animation element is not present in the HTML.
     */
    function stopDotAnimation() {
        const dotElement = document.getElementById('dot');
        if (dotElement) {
            dotElement.classList.remove('animate');
        }
    }

    // Initialize status
    clearStatus();
    fetchDirectories();
    bindEventListeners();
});
