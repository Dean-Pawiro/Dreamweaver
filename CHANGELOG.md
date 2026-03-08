# Changelog

All notable changes to Dreamweaver will be documented in this file.

## [Unreleased] - 2026-03-07

### Added
- **Aspect Ratio Selection**: 5 aspect ratio options for image generation (1:1, 16:9, 9:16, 3:2, 2:3)
- **8 Pollinations Models**: Support for flux, zimage, flux-2-dev, imagen-4, grok-imagine, klein, klein-large, gptimage
- **Message Deletion**: Delete individual chat messages and image prompts via hover-activated trash icon
- **Image Gallery Management**: Remove chat associations from gallery images
- **HD Quality Settings**: All Pollinations images generated with `quality=hd` and `enhance=true` parameters
- **Hover UI Controls**: Clean interface with opacity-based hover visibility for close/delete buttons
- **localStorage Persistence**: Aspect ratio and model selections persist across sessions

### Changed
- **Image Generation Context**: Reduced from 8 to 4 recent messages to prevent token limit errors
- **Pollinations API**: Implemented proper width/height dimension calculation from aspect ratios
- **Delete Button Positioning**: Moved to top-right corner with absolute positioning for better UX
- **Database Schema**: Added `kind` field to differentiate between messages and image_prompts in unified queries

### Fixed
- **Aspect Ratio Bug**: Fixed 1:1 default issue - now properly converts aspect ratios to pixel dimensions
- **400 Error on Deletion**: Implemented dual-table deletion logic for messages vs image_prompts
- **Token Context Overflow**: Reduced context window for image generation to stay within 8192 token limit
- **Delete Button Visibility**: Changed from opacity to display:none for more reliable hover behavior

### Technical Details
- Aspect ratios converted to dimensions: 16:9 = 1792×1024, 9:16 = 1024×1792, 3:2 = 1536×1024, 2:3 = 1024×1536
- Base resolution: 1024px on shortest dimension
- Database tables: `messages` and `image_prompts` unified in `getChatHistory()` with UNION ALL
- Message deletion routes based on `kind` field ("message" or "image_prompt")
