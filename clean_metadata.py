#!/usr/bin/env python3

import sys
import json
import os
import subprocess
import tempfile
import shutil
from mutagen.mp4 import MP4, MP4Cover

"""
Cleans metadata from various video file formats.
Returns a JSON response with the status of the operation.
This script focuses exclusively on video formats as per the application scope.
"""
def clean_metadata(file_path):
    try:
        # Check file extension to determine format
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in ['.mp4', '.m4v', '.m4a']:
            video = MP4(file_path)
            # Remove title and comments
            if 'nam' in video:
                del video['nam']
            if 'cmt' in video:
                del video['cmt']
            # Optionally, clear all tags if possible
            video.clear()
            video.save()
            return {'status': 'success', 'message': f'Cleaned metadata for {file_path}'}
        
        elif ext in ['.mkv']:
            # Use mkvpropedit from MKVToolNix to remove metadata in-place
            # Note: 'comment' is not a valid direct property, focusing on title
            command = ['mkvpropedit', file_path, '--edit', 'info', '--delete', 'title']
            print(f"Debug: Attempting to run command: {command}", file=sys.stderr)
            try:
                result = subprocess.run(command, capture_output=True, text=True)
                if result.returncode == 0:
                    return {'status': 'success', 'message': f'Cleaned metadata for {file_path} using mkvpropedit'}
                else:
                    error_msg = result.stderr if result.stderr else 'Unknown error'
                    if result.stdout:
                        error_msg += f" (stdout: {result.stdout})"
                    return {'status': 'error', 'message': f'Error cleaning metadata for {file_path} using mkvpropedit: {error_msg}'}
            except FileNotFoundError:
                return {'status': 'error', 'message': f'Error cleaning metadata for {file_path}: mkvpropedit not found in system path'}
            except Exception as e:
                return {'status': 'error', 'message': f'Error cleaning metadata for {file_path} using mkvpropedit: {str(e)}'}
        
        elif ext in ['.avi', '.wmv', '.mov', '.flv', '.webm']:
            # Use ffmpeg to create a copy of the video without metadata
            temp_file = tempfile.mktemp(suffix=ext)
            command = ['ffmpeg', '-i', file_path, '-map_metadata', '-1', '-c', 'copy', temp_file]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode == 0:
                # Replace original file with the cleaned one using shutil.move to handle cross-device moves
                shutil.move(temp_file, file_path)
                return {'status': 'success', 'message': f'Cleaned metadata for {file_path} using ffmpeg'}
            else:
                # Clean up temporary file if it exists
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                return {'status': 'error', 'message': f'Error cleaning metadata for {file_path} using ffmpeg: {result.stderr}'}
        
        else:
            return {'status': 'error', 'message': f'Unsupported video format for {file_path}'}
    except Exception as e:
        return {'status': 'error', 'message': f'Error cleaning metadata for {file_path}: {str(e)}'}

# Main function to handle command line input
def main():
    if len(sys.argv) < 2:
        print(json.dumps({'status': 'error', 'message': 'No file path provided'}))
        sys.exit(1)
    file_path = sys.argv[1]
    result = clean_metadata(file_path)
    print(json.dumps([result]))

if __name__ == '__main__':
    main()
