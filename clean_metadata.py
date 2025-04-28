#!/usr/bin/env python3

import sys
import json
import os
import subprocess
import tempfile
import shutil
from mutagen.mp4 import MP4, MP4Cover
from mutagen.id3 import ID3, TIT2, COMM
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis

"""
Cleans metadata from various video and audio file formats.
Returns a JSON response with the status of the operation.
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
        
        elif ext in ['.mkv', '.avi', '.wmv', '.mov', '.flv', '.webm']:
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
        
        elif ext in ['.mp3']:
            audio = ID3(file_path)
            # Remove title and comments
            audio.delall('TIT2')
            audio.delall('COMM')
            audio.save()
            return {'status': 'success', 'message': f'Cleaned metadata for {file_path}'}
        
        elif ext in ['.flac']:
            audio = FLAC(file_path)
            # Remove title and comments
            if 'title' in audio:
                del audio['title']
            if 'comment' in audio:
                del audio['comment']
            audio.save()
            return {'status': 'success', 'message': f'Cleaned metadata for {file_path}'}
        
        elif ext in ['.ogg']:
            audio = OggVorbis(file_path)
            # Remove title and comments
            if 'title' in audio:
                del audio['title']
            if 'comment' in audio:
                del audio['comment']
            audio.save()
            return {'status': 'success', 'message': f'Cleaned metadata for {file_path}'}
        
        else:
            return {'status': 'error', 'message': f'Unsupported file format for {file_path}'}
    except Exception as e:
        return {'status': 'error', 'message': f'Error cleaning metadata for {file_path}: {str(e)}'}

"""
Main function to handle command line arguments and process multiple files.
"""
def main():
    if len(sys.argv) < 2:
        print(json.dumps([{'status': 'error', 'message': 'No files provided'}]))
        return
    
    results = []
    for file_path in sys.argv[1:]:
        result = clean_metadata(file_path)
        results.append(result)
    
    print(json.dumps(results))

if __name__ == '__main__':
    main()
