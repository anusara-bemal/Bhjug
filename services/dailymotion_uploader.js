const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { EventEmitter } = require('events');

class DailymotionUploader extends EventEmitter {
    constructor() {
        super();
        this.baseUrl = 'https://api.dailymotion.com';
    }

    async upload(filePath, accessToken, metadata) {
        try {
            // Step 1: Get upload URL
            console.log('Getting upload URL...');
            const uploadUrlResponse = await axios.get('https://api.dailymotion.com/file/upload', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!uploadUrlResponse.data || !uploadUrlResponse.data.upload_url) {
                throw new Error('Failed to get upload URL from Dailymotion');
            }

            // Step 2: Upload the file
            console.log('Starting file upload...');
            const fileStream = fs.createReadStream(filePath);
            const form = new FormData();
            form.append('file', fileStream);

            const uploadResponse = await axios.post(uploadUrlResponse.data.upload_url, form, {
                headers: {
                    ...form.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 0,
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const progress = (progressEvent.loaded / progressEvent.total) * 100;
                        this.emit('progress', { progress });
                        console.log(`Upload progress: ${progress.toFixed(2)}%`);
                    }
                }
            });

            if (!uploadResponse.data || !uploadResponse.data.url) {
                console.log('Upload response:', uploadResponse.data);
                throw new Error('Invalid upload response from Dailymotion');
            }

            // Step 3: Create video with URL
            console.log('Creating video...');
            const createVideoResponse = await axios.post('https://api.dailymotion.com/me/videos', 
                {
                    url: uploadResponse.data.url,
                    title: metadata.title || 'Untitled Video',
                    published: false,
                    private: true,
                    channel: "videogames"
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Video created successfully!');
            return createVideoResponse.data;

        } catch (error) {
            console.error('Upload error details:', error.response?.data || error.message);
            this.emit('error', error);
            throw error;
        }
    }
}

module.exports = DailymotionUploader;