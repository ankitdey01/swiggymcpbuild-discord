import fs from "fs";
import path from "path";

/**
 * Recursively retrieves all file paths from a directory.
 * Uses path.resolve() for cross-platform compatibility instead of manual string concatenation.
 * 
 * @param directory - The directory path to scan
 * @returns Array of absolute file paths
 */
export const getAllFiles = (directory: string): string[] => {
    const fileArray: string[] = [];
    
    try {
        const files = fs.readdirSync(directory);

        for (const file of files) {
            const filePath = path.join(directory, file);
            
            try {
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    fileArray.push(...getAllFiles(filePath));
                } else {
                    fileArray.push(path.resolve(filePath));
                }
            } catch (error) {
                // Skip files/directories that can't be accessed (permission issues, broken symlinks)
                continue;
            }
        }
    } catch (error) {
        // If the directory itself can't be read, return empty array
        return [];
    }

    return fileArray;
};