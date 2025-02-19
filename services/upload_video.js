require('dotenv').config();  // Add this at the top
const DailymotionUploader = require('./dailymotion_uploader');  // Changed import
const platformAuth = require('./platform_auth');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadVideo() {
    try {
        const videoPath = 'G:\\AI CODE GEN\\smm work 5\\downloads\\Record of Ragnarok Season 1.mp4';
        
        if (!fs.existsSync(videoPath)) {
            console.error('Video file not found!');
            return;
        }

        console.log("Dailymotion සමඟ සම්බන්ධ වෙමින්...");
        const authResult = await platformAuth.authenticate('dailymotion', {
            email: process.env.DAILYMOTION_EMAIL,
            password: process.env.DAILYMOTION_PASSWORD,
            clientId: process.env.DAILYMOTION_CLIENT_ID,
            clientSecret: process.env.DAILYMOTION_CLIENT_SECRET
        });

        const uploader = new DailymotionUploader();
        console.log("වීඩියෝව උඩුගත කරමින් පවතී...");

        let startTime = Date.now();

        uploader.on('progress', (data) => {
            const minutes = ((Date.now() - startTime) / 60000).toFixed(1);
            console.log(`ප්‍රගතිය: ${data.progress.toFixed(2)}% (${minutes} mins)`);
        });

        const result = await uploader.upload(
            videoPath,
            authResult.accessToken,
            {
                title: "Record of Ragnarok Season 1",
                description: "Anime Series - Full Episode",
                channel: "tv",           // Changed to tv channel
                language: "en",
                tags: ["anime", "Record of Ragnarok", "animation"],
                published: true,
                private: false,
                explicit: false,
                // Add these important parameters
                allow_embed: true,
                syndication: true,
                category: "animation"    // Specific category
            }
        );

        // Single status check and URL display
        if (result && result.id) {
            console.log("\nවීඩියෝව සාර්ථකව උඩුගත කරන ලදී!");
            console.log(`Video ID: ${result.id}`);
            console.log(`Watch URL: https://www.dailymotion.com/video/${result.id}`);
            console.log("Video is processing - please wait 10-15 minutes");
            
            // Wait 30 seconds and check status
            console.log("Checking video status...");
            await sleep(30000);
            
            try {
                const checkUrl = `https://api.dailymotion.com/video/${result.id}?fields=status,processing_progress`;
                const statusCheck = await axios.get(checkUrl, {
                    headers: { 'Authorization': `Bearer ${authResult.accessToken}` }
                });
                console.log("Processing Status:", statusCheck.data.status);
                console.log("Processing Progress:", statusCheck.data.processing_progress + "%");
            } catch (err) {
                console.log("Status check failed - video is still processing");
            }
        }

        // Add verification of video status
        if (result && result.id) {
            // Try to verify the video status
            try {
                const videoStatus = await axios.get(`https://api.dailymotion.com/video/${result.id}`, {
                    headers: {
                        'Authorization': `Bearer ${authResult.accessToken}`
                    }
                });
                console.log("Video Status:", videoStatus.data.status);
            } catch (statusError) {
                console.log("Could not verify video status");
            }

            console.log("\nවීඩියෝව සාර්ථකව උඩුගත කරන ලදී!");
            console.log(`URL: https://www.dailymotion.com/video/${result.id}`);
            console.log("Processing may take up to 30 minutes...");
        }

        console.log("\nවීඩියෝව සාර්ථකව උඩුගත කරන ලදී!");
        console.log(`URL: https://www.dailymotion.com/embed/video/${result.id}`);
        console.log(`Direct URL: https://www.dailymotion.com/video/${result.id}`);
        console.log("Note: Video might take a few minutes to appear on your channel");

    } catch (error) {
        console.error('Upload failed:', error.message);
        process.exit(1);
    }
}

uploadVideo();