# Mulyo

## Description

A Node.js and Express.js server designed to handle user authentication using JWT and Passport-Google-OAuth20, manage user data, and perform reading list operations by being deployed as serverless function on Netlify.

### Problem Statement

The project aims to address the challenge of efficiently managing user authentication, data storage, and reading list functionalities for a manga website. By leveraging serverless architecture, it seeks to minimize cold start times and enhance scalability, ensuring a seamless user experience.

1. **Cold Start Time:** Most hosting providers, including Render, have a cold start time of about 20 seconds, resulting in a significant delay before responding to user requests or they are simply premium.

2. **Lack of Such APIs:** While searching GitHub for APIs, we found that most of them were either lacking features, premium or were simply not good enough.

### Solution

To address the aforementioned challenges, the following solutions were implemented:

1. **Mulyo:** A serverless function hosting platform that offers a more efficient and scalable solution while maintaining quality and features. This project was developed upon [Daniel Asakpa's](https://github.com/danielasakpa) own [Manga Website Serverless Backend](https://github.com/danielasakpa/Netlify-Serverless-Manga-Server) which we found was a good starting point with the base features prebaked into it.
It however lacked features such as:
- Series Management
- Lack of consideration for Netlify Function's 6MB upload limit
- Administrator Routes
- Debugging Tools
- Etc

This project aims to resolve these issues through monthly or bi-monthly updates.

2. **Netlify Serverless Functions:** Netlify's serverless functions were chosen as they provided a more efficient and scalable solution compared to the previous hosting provider. Serverless functions offered a more flexible architecture.

## Setup

### Environmental Variables

To use this project, you need to set the following environmental variables:

- MONGO_URI: Your MongoDB connection string
- JWT_SECRET: A JWT secret key for authentication
- FRONT_JWT_SECRET: A JWT secret key for front-end authentication
- GOOGLE_CLIENT_ID : A Google OAuth client ID for authentication
- GOOGLE_CLIENT_SECRET: A Google OAuth client secret for authentication
- CLIENT_URL: Your frontend client URL
- SERVER_URL: Your server URL
- SESSION_SECRET: Session secret key used for session management
- CLOUDINARYNAME: Cloudinary name
- CLOUDINARYKEY: Cloudinary key
- CLOUDINARYSECRET: Cloudinary secret
- CLOUDINARYENVVAR: Cloudinary environment variable
- NODE_ENV: Node environment variable (development || production)
- AUTH_SESSION_TOKEN: Authentication session token
- FIREBASE_API_KEY: Your Firebase API key
- FIREBASE_AUTH_DOMAIN: Your Firebase authentication domain
- FIREBASE_PROJECT_ID: Your Firebase project ID
- FIREBASE_APP_ID: Your Firebase app ID

## Getting Started

1. Clone the repository: `git clone <repository-url>`
2. Install dependencies: `npm install`
3. Start the server: `npm start`

### Additional Steps

4. Set up the required environmental variables by creating a `.env` file in the root directory of the project and filling in the necessary values for ENVs.
5. Run the server locally using `npm start` if you have a development environment setup.
6. Once the server is running, you can access the provided endpoints for user authentication, user data management, and reading list operations.
7. Test the endpoints using tools like Postman or by integrating them into your client-side application.

By following these steps, you should be able to effectively use the functionalities provided by the server and integrate them into your applications.

## Updating packages
You can update the packages by running `npm run update` in the project directory.

## Deployment

After testing locally, consider deploying the server to a production environment using Netlify to make it accessible to users. Ensure that you update environmental variables and configurations accordingly for the production environment.
 
### Deploying on Netlify:

1. Ensure you have a Netlify account and the Netlify CLI installed.
2. Navigate to the project directory.
3. Run `netlify login` to authenticate with your Netlify account.
4. Run `netlify init` to initialize your project on Netlify.
5. Follow the prompts to link your repository and set up the deployment settings.
6. Once configured, run `npm run build` to deploy your project to Netlify.
