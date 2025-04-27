document.addEventListener('DOMContentLoaded', function() {
    // Load available directories
    fetch('/api/directories')
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('directorySelect');
            data.directories.forEach(dir => {
                const option = document.createElement('option');
                option.value = dir;
                option.textContent = dir;
                select.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching directories:', error);
            document.getElementById('status').textContent = 'Error loading directories. Please enter manually.';
        });

    function updateInputField(value) {
        document.getElementById('directoryInput').value = value;
    }

    function scanDirectory() {
        console.log('scanDirectory function called');
        const directory = document.getElementById('directoryInput').value;
        console.log('Directory to scan:', directory);
        if (!directory) {
            console.log('No directory provided');
            document.getElementById('status').textContent = 'Please select or enter a directory path.';
            return;
        }

        console.log('Sending POST request to /api/scan for directory:', directory);
        fetch('/api/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ directory: directory }),
        })
            .then(response => {
                console.log('Scan response received:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('Scan data received:', data);
                if (data.error) {
                    console.log('Scan error received:', data.error);
                    document.getElementById('status').textContent = 'Error scanning directory: ' + data.error;
                    return;
                }

                document.getElementById('status').textContent = 'Scan complete.';
                document.getElementById('totalFiles').textContent = data.files_scanned;
                document.getElementById('metadataFiles').textContent = data.files_with_metadata;
                displayResults(data.video_files);
            })
            .catch(error => {
                console.error('Error during scan request:', error);
                document.getElementById('status').textContent = 'Error scanning directory: ' + error.message;
            });
    }

    function displayResults(files) {
        console.log('Displaying results for', files.length, 'files');
        const tbody = document.getElementById('resultsBody');
        tbody.innerHTML = '';

        files.forEach((file, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" id="file_${index}" value="${file.path}"></td>
                <td title="${file.filename}">${file.filename}</td>
                <td title="${file.title || 'N/A'}">${file.title || 'N/A'}</td>
                <td title="${file.comments || 'N/A'}">${file.comments || 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
        
        // Store files for sorting
        window.currentFiles = files;
        setupSorting();
    }

    function setupSorting() {
        const headers = ['filename', 'title', 'comments'];
        headers.forEach((header, index) => {
            const th = document.getElementsByTagName('th')[index + 1]; // +1 to skip 'Select' column
            th.style.cursor = 'pointer';
            th.onclick = function() {
                sortTable(header);
            };
        });
    }

    function sortTable(key) {
        const files = window.currentFiles;
        const tbody = document.getElementById('resultsBody');
        let direction = 1;
        if (tbody.dataset.sortKey === key) {
            direction = tbody.dataset.sortDirection === 'asc' ? -1 : 1;
        }
        tbody.dataset.sortKey = key;
        tbody.dataset.sortDirection = direction === 1 ? 'asc' : 'desc';

        files.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            return valA > valB ? direction : -direction;
        });

        tbody.innerHTML = '';
        files.forEach((file, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" id="file_${index}" value="${file.path}"></td>
                <td title="${file.filename}">${file.filename}</td>
                <td title="${file.title || 'N/A'}">${file.title || 'N/A'}</td>
                <td title="${file.comments || 'N/A'}">${file.comments || 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function selectAll() {
        const checkboxes = document.querySelectorAll('#resultsTable input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = true);
    }

    function cleanSelected() {
        const checkboxes = document.querySelectorAll('#resultsTable input[type="checkbox"]:checked');
        const selectedFiles = Array.from(checkboxes).map(checkbox => checkbox.value);
        const status = document.getElementById('status');

        if (selectedFiles.length === 0) {
            status.textContent = 'No files selected to clean.';
            return;
        }

        console.log('Sending POST request to /api/clean for files:', selectedFiles);
        fetch('/api/clean', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: selectedFiles }),
        })
            .then(response => {
                console.log('Clean response received:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('Clean data received:', data);
                status.textContent = `Cleaned metadata for ${data.cleaned_files.length} files.`;
                if (data.errors.length > 0) {
                    status.textContent += ` Errors occurred for ${data.errors.length} files. Check console for details.`;
                    console.error('Errors during cleaning:', data.errors);
                }
                // Refresh the results after cleaning
                scanDirectory();
            })
            .catch(error => {
                console.error('Error during clean request:', error);
                status.textContent = 'Error cleaning metadata: ' + error.message;
            });
    }

    // ASCII spinner for visual feedback
    const spinnerFrames = ['-', '\\', '|', '/'];
    let spinnerIndex = 0;
    let spinnerInterval;

    function startSpinner(statusElement, baseText) {
        statusElement.textContent = `${baseText} ${spinnerFrames[spinnerIndex]}`;
        spinnerInterval = setInterval(() => {
            spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
            statusElement.textContent = `${baseText} ${spinnerFrames[spinnerIndex]}`;
        }, 100);
    }

    function stopSpinner(statusElement, finalMessage) {
        if (spinnerInterval) {
            clearInterval(spinnerInterval);
            spinnerInterval = null;
        }
        statusElement.textContent = finalMessage;
    }
});
