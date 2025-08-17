#!/usr/bin/env python3
import os
import fnmatch
from pathlib import Path
from datetime import datetime

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

def write_file_list(md_file, title, file_list):
    """Write a formatted list of files with line counts to markdown file."""
    if not file_list:
        md_file.write(f"\n## {title}\n\nNo files found.\n")
        return
    
    md_file.write(f"\n## {title}\n\n")
    md_file.write("| Lines | File |\n")
    md_file.write("|-------|------|\n")
    
    total_lines = 0
    for file_path, line_count in file_list:
        md_file.write(f"| {line_count:,} | `{file_path}` |\n")
        total_lines += line_count
    
    md_file.write(f"\n**Summary:**\n")
    md_file.write(f"- Files: {len(file_list):,}\n")
    md_file.write(f"- Total lines: {total_lines:,}\n")

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
    
    # Generate markdown file
    output_file = "code_analysis.md"
    
    with open(output_file, 'w', encoding='utf-8') as md_file:
        # Write header
        md_file.write("# Code Analysis Report\n\n")
        md_file.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        md_file.write(f"**Directory:** `{os.path.abspath(root_dir)}`\n\n")
        
        # Write table of contents
        md_file.write("## Table of Contents\n\n")
        if client_files:
            md_file.write("- [Client Files](#client-files)\n")
        if server_files:
            md_file.write("- [Server Files](#server-files)\n")
        if other_files:
            md_file.write("- [Other Files](#other-files)\n")
        md_file.write("- [Overall Summary](#overall-summary)\n")
        
        # Write file lists
        write_file_list(md_file, "Client Files", client_files)
        write_file_list(md_file, "Server Files", server_files)
        write_file_list(md_file, "Other Files", other_files)
        
        # Write overall summary
        total_files = len(client_files) + len(server_files) + len(other_files)
        total_lines = (sum(count for _, count in client_files) + 
                       sum(count for _, count in server_files) + 
                       sum(count for _, count in other_files))
        
        md_file.write("\n## Overall Summary\n\n")
        md_file.write("| Metric | Count |\n")
        md_file.write("|--------|-------|\n")
        md_file.write(f"| Total files analyzed | {total_files:,} |\n")
        md_file.write(f"| Total lines of code | {total_lines:,} |\n")
        md_file.write(f"| Client files | {len(client_files):,} |\n")
        md_file.write(f"| Server files | {len(server_files):,} |\n")
        md_file.write(f"| Other files | {len(other_files):,} |\n")
        
        # Add distribution chart (text-based)
        if total_files > 0:
            client_pct = (len(client_files) / total_files) * 100
            server_pct = (len(server_files) / total_files) * 100
            other_pct = (len(other_files) / total_files) * 100
            
            md_file.write("\n### File Distribution\n\n")
            md_file.write("| Category | Files | Percentage |\n")
            md_file.write("|----------|-------|------------|\n")
            md_file.write(f"| Client | {len(client_files):,} | {client_pct:.1f}% |\n")
            md_file.write(f"| Server | {len(server_files):,} | {server_pct:.1f}% |\n")
            md_file.write(f"| Other | {len(other_files):,} | {other_pct:.1f}% |\n")
    
    print(f"Code analysis complete! Report saved to: {output_file}")
    print(f"Total files analyzed: {total_files}")
    print(f"Total lines of code: {total_lines:,}")

if __name__ == "__main__":
    main()