import { videoGenerator } from './video-generator';
import fs from 'fs';

async function testSettings() {
  console.log('🧪 Starting Video Settings Verification Test (V2)...');
  try {
    const result = await videoGenerator.createDemoVideo();
    if (result.success && result.videoPath) {
      console.log('✅ Demo video created successfully with Ultrafast settings!');
      if (fs.existsSync(result.videoPath)) {
        fs.unlinkSync(result.videoPath);
      }
    } else {
      console.error('❌ Test failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test execution error:', error);
  }
}

testSettings();
