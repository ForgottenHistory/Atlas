const sharp = require('sharp');
const logger = require('../logger/Logger');

class GifFrameExtractor {
  constructor() {
    this.maxFrameSize = 5 * 1024 * 1024; // 5MB per frame
  }

  /**
   * Extract key frames from GIF buffer
   * @param {Buffer} gifBuffer - GIF file buffer
   * @returns {Promise<Array>} - Array of frame buffers with metadata
   */
  async extractKeyFrames(gifBuffer) {
    try {
      // Get GIF metadata to determine frame count
      const metadata = await sharp(gifBuffer, { animated: true }).metadata();
      
      if (!metadata.pages || metadata.pages < 2) {
        logger.debug('GIF has only one frame, treating as static image', {
          source: 'imageProcessing',
          pages: metadata.pages
        });
        return [{ buffer: gifBuffer, frameIndex: 0, description: 'static' }];
      }

      const totalFrames = metadata.pages;
      const firstFrameIndex = 0;
      const middleFrameIndex = Math.floor(totalFrames / 2);

      logger.info('Extracting key frames from GIF', {
        source: 'imageProcessing',
        totalFrames: totalFrames,
        extracting: [firstFrameIndex, middleFrameIndex]
      });

      // Extract first frame
      const firstFrame = await this.extractSingleFrame(gifBuffer, firstFrameIndex);
      
      // Extract middle frame (if different from first)
      const frames = [firstFrame];
      if (middleFrameIndex !== firstFrameIndex) {
        const middleFrame = await this.extractSingleFrame(gifBuffer, middleFrameIndex);
        frames.push(middleFrame);
      }

      return frames;

    } catch (error) {
      logger.error('Failed to extract GIF frames', {
        source: 'imageProcessing',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract a single frame from GIF
   * @param {Buffer} gifBuffer - GIF file buffer
   * @param {number} frameIndex - Frame index to extract
   * @returns {Promise<Object>} - Frame data
   */
  async extractSingleFrame(gifBuffer, frameIndex) {
    try {
      // Extract specific frame and convert to JPEG
      const frameBuffer = await sharp(gifBuffer, { animated: true, page: frameIndex })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Validate frame size
      if (frameBuffer.length > this.maxFrameSize) {
        logger.warn('Frame size exceeds limit, compressing', {
          source: 'imageProcessing',
          frameIndex: frameIndex,
          originalSize: `${(frameBuffer.length / 1024 / 1024).toFixed(2)}MB`
        });

        // Compress further if needed
        const compressedBuffer = await sharp(frameBuffer)
          .jpeg({ quality: 60 })
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();

        return {
          buffer: compressedBuffer,
          frameIndex: frameIndex,
          description: frameIndex === 0 ? 'first_frame' : 'middle_frame',
          compressed: true
        };
      }

      return {
        buffer: frameBuffer,
        frameIndex: frameIndex,
        description: frameIndex === 0 ? 'first_frame' : 'middle_frame',
        compressed: false
      };

    } catch (error) {
      logger.error('Failed to extract single frame', {
        source: 'imageProcessing',
        frameIndex: frameIndex,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if buffer contains a GIF
   * @param {Buffer} buffer - File buffer
   * @returns {boolean} - True if GIF
   */
  isGif(buffer) {
    // Check GIF signature
    const gifSignature = buffer.slice(0, 6);
    return gifSignature.equals(Buffer.from('GIF87a')) || 
           gifSignature.equals(Buffer.from('GIF89a'));
  }

  /**
   * Validate GIF for processing
   * @param {Buffer} buffer - GIF buffer
   * @returns {Object} - Validation result
   */
  async validateGif(buffer) {
    try {
      const metadata = await sharp(buffer, { animated: true }).metadata();
      
      const issues = [];
      if (metadata.width > 2048 || metadata.height > 2048) {
        issues.push('GIF dimensions too large');
      }
      
      if (metadata.pages > 100) {
        issues.push('Too many frames');
      }

      return {
        isValid: issues.length === 0,
        issues: issues,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          frames: metadata.pages,
          format: metadata.format
        }
      };
    } catch (error) {
      return {
        isValid: false,
        issues: ['Invalid GIF format'],
        error: error.message
      };
    }
  }
}

module.exports = GifFrameExtractor;