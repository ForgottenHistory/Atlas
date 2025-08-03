#!/usr/bin/env python3
import os
import fnmatch
from pathlib import Path

def parse_gitignore(gitignore_path):
    """Parse .gitignore file and return list of patterns."""
    patterns = []
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    patterns.append(line)
    return patterns

def should_ignore(file_path, ignore_patterns):
    """Check if file should be ignored based on .gitignore patterns."""
    file_path = file_path.replace('\\', '/')  # Normalize path separators
    
    for pattern in ignore_patterns:
        # Handle directory patterns
        if pattern.endswith('/'):
            if fnmatch.fnmatch(file_path + '/', '*/' + pattern) or fnmatch.fnmatch(file_path + '/', pattern):
                return True
        # Handle file patterns
        elif fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(os.path.basename(file_path), pattern):
            return True
        # Handle patterns with path separators
        elif '/' in pattern and fnmatch.fnmatch(file_path, '*/' + pattern):
            return True
    
    return False

def count_lines(file_path):
    """Count lines in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except (OSError, UnicodeDecodeError):
        return 0

def is_text_file(file_path):
    """Check if file is likely a text file based on extension."""
    text_extensions = {
        '.py', '.js', '.html', '.css', '.cpp', '.c', '.h', '.java', '.rb', '.php',
        '.go', '.rs', '.swift', '.kt', '.ts', '.jsx', '.tsx', '.vue', '.scss',
        '.sass', '.less', '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat',
        '.cmd', '.xml', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
        '.txt', '.md', '.rst', '.tex', '.r', '.R', '.m', '.pl', '.lua', '.vim',
        '.cs', '.vb', '.fs', '.scala', '.clj', '.hs', '.elm', '.dart', '.jl'
    }
    return Path(file_path).suffix.lower() in text_extensions

def categorize_file(file_path):
    """Categorize file as client, server, or other based on path."""
    normalized_path = file_path.replace('\\', '/').lower()
    
    if '/client/' in normalized_path or normalized_path.startswith('client/'):
        return 'client'
    elif '/server/' in normalized_path or normalized_path.startswith('server/'):
        return 'server'
    else:
        return 'other'

def print_file_list(title, file_list):
    """Print a formatted list of files with line counts."""
    if not file_list:
        print(f"\n{title}: No files found")
        return
    
    print(f"\n{title}:")
    print(f"{'Lines':<8} {'File'}")
    print("-" * 60)
    
    total_lines = 0
    for file_path, line_count in file_list:
        print(f"{line_count:<8} {file_path}")
        total_lines += line_count
    
    print(f"\nFiles in {title.lower()}: {len(file_list)}")
    print(f"Total lines in {title.lower()}: {total_lines}")

def main():
    root_dir = "."
    gitignore_path = os.path.join(root_dir, '.gitignore')
    ignore_patterns = parse_gitignore(gitignore_path)
    
    # Add common patterns to ignore
    ignore_patterns.extend([
        '.git/',
        '__pycache__/',
        '*.pyc',
        '.DS_Store',
        'node_modules/',
        '.vscode/',
        '.idea/',
        '*.log'
    ])
    
    client_files = []
    server_files = []
    other_files = []
    
    for root, dirs, files in os.walk(root_dir):
        # Filter out ignored directories
        dirs[:] = [d for d in dirs if not should_ignore(os.path.relpath(os.path.join(root, d), root_dir), ignore_patterns)]
        
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, root_dir)
            
            # Skip if file should be ignored or is not a text file
            if should_ignore(rel_path, ignore_patterns) or not is_text_file(file_path):
                continue
            
            line_count = count_lines(file_path)
            if line_count > 0:
                category = categorize_file(rel_path)
                file_entry = (rel_path, line_count)
                
                if category == 'client':
                    client_files.append(file_entry)
                elif category == 'server':
                    server_files.append(file_entry)
                else:
                    other_files.append(file_entry)
    
    # Sort each list by line count (descending)
    client_files.sort(key=lambda x: x[1], reverse=True)
    server_files.sort(key=lambda x: x[1], reverse=True)
    other_files.sort(key=lambda x: x[1], reverse=True)
    
    # Print results for each category
    print("=" * 60)
    print("CODE ANALYSIS BY CATEGORY")
    print("=" * 60)
    
    print_file_list("CLIENT FILES", client_files)
    print_file_list("SERVER FILES", server_files)
    print_file_list("OTHER FILES", other_files)
    
    # Print overall summary
    total_files = len(client_files) + len(server_files) + len(other_files)
    total_lines = (sum(count for _, count in client_files) + 
                   sum(count for _, count in server_files) + 
                   sum(count for _, count in other_files))
    
    print("\n" + "=" * 60)
    print("OVERALL SUMMARY")
    print("=" * 60)
    print(f"Total files analyzed: {total_files}")
    print(f"Total lines of code: {total_lines}")
    print(f"Client files: {len(client_files)}")
    print(f"Server files: {len(server_files)}")
    print(f"Other files: {len(other_files)}")

if __name__ == "__main__":
    main()