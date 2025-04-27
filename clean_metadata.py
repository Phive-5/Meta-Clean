#!/usr/bin/env python3
import sys
import json
from mutagen.mp4 import MP4, MP4Cover
from mutagen.id3 import ID3, TIT2, COMM
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis
import os

def clean_metadata(file_path):
    try:
        # Check file extension to determine format
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in ['.mp4', '.m4v', '.m4a']:
            video = MP4(file_path)
            # Remove title and comments
            if '©nam' in video:
                del video['©nam']
            if '©cmt' in video:
                del video['©cmt']
            # Optionally, clear all tags if possible
            video.clear()
            video.save()
            return {'status': 'success', 'message': f'Cleaned metadata for {file_path}'}
        
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

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'status': 'error', 'message': 'No files provided'}))
        return
    
    results = []
    for file_path in sys.argv[1:]:
        result = clean_metadata(file_path)
        results.append(result)
    
    print(json.dumps(results))

if __name__ == '__main__':
    main()
