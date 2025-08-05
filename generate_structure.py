#!/usr/bin/env python3
"""
Directory Structure Generator
Generates a markdown file showing project structure while respecting .gitignore rules.
"""
import os
import fnmatch
from pathlib import Path
from typing import List, Set


def parse_gitignore(gitignore_path: str) -> List[str]:
    """Parse .gitignore file and return list of patterns."""
    patterns = []
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith('#'):
                    patterns.append(line)
    return patterns


def should_ignore(path: str, patterns: List[str], root_dir: str) -> bool:
    """Check if a path should be ignored based on gitignore patterns."""
    # Convert to relative path from root
    rel_path = os.path.relpath(path, root_dir)
    
    # Always ignore .git directory
    if '.git' in rel_path.split(os.sep):
        return True
    
    for pattern in patterns:
        # Handle directory patterns (ending with /)
        if pattern.endswith('/'):
            pattern = pattern[:-1]
            if fnmatch.fnmatch(rel_path, pattern) or fnmatch.fnmatch(os.path.basename(path), pattern):
                return True
        # Handle file patterns
        elif fnmatch.fnmatch(rel_path, pattern) or fnmatch.fnmatch(os.path.basename(path), pattern):
            return True
        # Handle patterns with wildcards
        elif '*' in pattern:
            if fnmatch.fnmatch(rel_path, pattern):
                return True
    
    return False


def get_directory_structure(root_dir: str, max_depth: int = None) -> str:
    """Generate directory structure as markdown."""
    gitignore_patterns = parse_gitignore(os.path.join(root_dir, '.gitignore'))
    
    # Add common patterns to ignore
    default_ignore = [
        '__pycache__',
        '*.pyc',
        '.DS_Store',
        'Thumbs.db',
        '.vscode',
        '.idea'
    ]
    gitignore_patterns.extend(default_ignore)
    
    structure = []
    project_name = os.path.basename(os.path.abspath(root_dir))
    structure.append(f"# {project_name} - Project Structure\n")
    structure.append("```")
    
    def walk_directory(current_path: str, prefix: str = "", depth: int = 0):
        if max_depth is not None and depth > max_depth:
            return
            
        try:
            items = sorted(os.listdir(current_path))
        except PermissionError:
            return
        
        # Separate directories and files
        dirs = []
        files = []
        
        for item in items:
            item_path = os.path.join(current_path, item)
            
            # Skip if should be ignored
            if should_ignore(item_path, gitignore_patterns, root_dir):
                continue
                
            if os.path.isdir(item_path):
                dirs.append(item)
            else:
                files.append(item)
        
        # Process directories first, then files
        all_items = dirs + files
        
        for i, item in enumerate(all_items):
            item_path = os.path.join(current_path, item)
            is_last = i == len(all_items) - 1
            is_dir = os.path.isdir(item_path)
            
            # Choose the right tree characters
            if is_last:
                current_prefix = "└── "
                next_prefix = prefix + "    "
            else:
                current_prefix = "├── "
                next_prefix = prefix + "│   "
            
            # Add directory indicator
            display_name = f"{item}/" if is_dir else item
            structure.append(f"{prefix}{current_prefix}{display_name}")
            
            # Recursively process directories
            if is_dir:
                walk_directory(item_path, next_prefix, depth + 1)
    
    # Start the walk
    walk_directory(root_dir)
    structure.append("```")
    
    return "\n".join(structure)


def main():
    """Main function to generate project structure."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate project structure markdown")
    parser.add_argument("directory", nargs="?", default=".", 
                       help="Directory to analyze (default: current directory)")
    parser.add_argument("-o", "--output", default="PROJECT_STRUCTURE.md",
                       help="Output file name (default: PROJECT_STRUCTURE.md)")
    parser.add_argument("-d", "--max-depth", type=int, default=None,
                       help="Maximum directory depth to traverse")
    
    args = parser.parse_args()
    
    # Get absolute path
    root_dir = os.path.abspath(args.directory)
    
    if not os.path.exists(root_dir):
        print(f"Error: Directory '{root_dir}' does not exist")
        return
    
    print(f"Generating structure for: {root_dir}")
    print(f"Output file: {args.output}")
    
    # Generate structure
    structure_md = get_directory_structure(root_dir, args.max_depth)
    
    # Write to file
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(structure_md)
    
    print(f"✅ Project structure saved to {args.output}")
    
    # Also print to console for immediate use
    print("\n" + "="*50)
    print(structure_md)


if __name__ == "__main__":
    main()