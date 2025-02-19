const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const FB = require('fb');
const { IgApiClient } = require('instagram-private-api');
const axios = require('axios');

class PlatformAuth {
  constructor() {
    this.platforms = {
      youtube: this.authenticateYoutube.bind(this),
      facebook: this.authenticateFacebook.bind(this),
      instagram: this.authenticateInstagram.bind(this),
      dailymotion: this.authenticateDailymotion.bind(this)
    };
  }

  async authenticate(platform, credentials) {
    if (!this.platforms[platform]) {
      throw new Error(`Authentication not supported for platform: ${platform}`);
    }

    return await this.platforms[platform](credentials);
  }

  async authenticateYoutube(credentials) {
    try {
      const { clientId, clientSecret, redirectUri } = credentials;
      const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

      // Set credentials if provided
      if (credentials.tokens) {
        oauth2Client.setCredentials(credentials.tokens);
      }

      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });

      return { client: youtube, auth: oauth2Client };
    } catch (error) {
      throw new Error(`YouTube authentication failed: ${error.message}`);
    }
  }

  async authenticateFacebook(credentials) {
    try {
      const { accessToken } = credentials;
      FB.setAccessToken(accessToken);

      return new Promise((resolve, reject) => {
        FB.api('/me', (response) => {
          if (!response || response.error) {
            reject(new Error('Facebook authentication failed'));
          }
          resolve({ client: FB, userId: response.id });
        });
      });
    } catch (error) {
      throw new Error(`Facebook authentication failed: ${error.message}`);
    }
  }

  async authenticateInstagram(credentials) {
    try {
      const { username, password } = credentials;
      const ig = new IgApiClient();
      ig.state.generateDevice(username);

      await ig.simulate.preLoginFlow();
      const loggedInUser = await ig.account.login(username, password);
      await ig.simulate.postLoginFlow();

      return { client: ig, user: loggedInUser };
    } catch (error) {
      throw new Error(`Instagram authentication failed: ${error.message}`);
    }
  }

  async authenticateDailymotion(credentials = null) {
    try {
      // Use provided credentials or fall back to environment variables
      const email = credentials?.email || process.env.DAILYMOTION_EMAIL;
      const password = credentials?.password || process.env.DAILYMOTION_PASSWORD;
      const clientId = credentials?.clientId || process.env.DAILYMOTION_CLIENT_ID;
      const clientSecret = credentials?.clientSecret || process.env.DAILYMOTION_CLIENT_SECRET;

      // Validate required credentials
      if (!email || !password || !clientId || !clientSecret) {
        throw new Error('Missing required Dailymotion credentials');
      }

      // Attempt authentication
      const response = await axios.post('https://api.dailymotion.com/oauth/token',
        new URLSearchParams({
          grant_type: 'password',
          client_id: clientId,
          client_secret: clientSecret,
          username: email,
          password: password,
          scope: 'read write manage_videos'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.access_token) {
        throw new Error('Failed to obtain access token from Dailymotion');
      }

      return {
        client: null, // Dailymotion doesn't provide a client instance
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 400) {
          throw new Error('Invalid Dailymotion credentials');
        } else if (status === 401) {
          throw new Error('Unauthorized: Please check your Dailymotion credentials');
        } else if (status === 403) {
          throw new Error('Access forbidden: Please check your Dailymotion API permissions');
        }
      }
      throw new Error(`Dailymotion authentication failed: ${error.message}`);
    }
  }

  async refreshTokens(platform, auth) {
    switch (platform) {
      case 'youtube':
        if (auth.credentials.refresh_token) {
          const { tokens } = await auth.refreshAccessToken();
          auth.setCredentials(tokens);
          return tokens;
        }
        break;

      case 'dailymotion':
        if (auth.refreshToken) {
          const response = await axios.post('https://api.dailymotion.com/oauth/token',
            new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: process.env.DAILYMOTION_CLIENT_ID,
              client_secret: process.env.DAILYMOTION_CLIENT_SECRET,
              refresh_token: auth.refreshToken
            }).toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
              },
              validateStatus: (status) => status === 200
            }
          );

          if (!response.data || !response.data.access_token) {
            throw new Error('Token refresh failed: Invalid response from Dailymotion API');
          }

          const data = response.data;
          return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
          };
        }
        break;

      default:
        throw new Error(`Token refresh not implemented for ${platform}`);
    }

    return null;
  }
}

module.exports = new PlatformAuth();