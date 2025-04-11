# Agent Voice Response - Gemini Speech-to-Text Integration

This repository provides a speech-to-text transcription service using **Google's Gemini API** integrated with the **Agent Voice Response** system. The code sets up an Express.js server that accepts audio input from Agent Voice Response Core, transcribes the audio using the Gemini API, and returns the transcription to the Agent Voice Response Core.

## Prerequisites

Before setting up the project, ensure you have the following:

1. **Node.js** and **npm** installed.
2. A **Google Cloud account** with the **Gemini API** enabled.
3. A **Google Cloud API Key** with the necessary permissions to access the Gemini API.

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/agentvoiceresponse/avr-stt-gemini.git
cd avr-stt-gemini
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Google Cloud Credentials

Set the environment variable to use your Google Cloud API key in your Node.js application:

```bash

```

Alternatively, you can set this variable in your `.env` file (you can use the `dotenv` package for loading environment variables).

### 4. Configuration

Ensure that you have the following environment variables set in your `.env` file:

```
PORT=6021
GOOGLE_API_KEY=your_google_api_key

```

You can adjust the port number as needed.

## How It Works

This application sets up an Express.js server that accepts audio input from clients and uses the Gemini API to transcribe the audio. The transcribed text is then returned to the Agent Voice Response Core. Below is an overview of the core components:

### 1. **Express.js Server**

The server listens for audio input on a specific route (`/transcribe`) and passes the audio to the Gemini API for transcription.

### 2. **Audio Processing**

The application processes the incoming audio data and prepares it for the Gemini API, ensuring it meets the required format and specifications.

### 3. **Gemini Speech-to-Text API**

The API processes the audio data received from the client and converts it into text using Gemini's advanced speech recognition capabilities.

### 4. **Route /transcribe**

This route accepts audio input from the client and transmits it for transcription. The transcription is sent back to the client once processing is complete.

## Example Code Overview

Here's a high-level breakdown of the key parts of the code:

- **Server Setup**: Configures the Express.js server and the Gemini API integration.
- **Audio Processing**: A function that handles the incoming audio from clients. It:
  - Processes the audio data to meet Gemini API requirements
  - Sends the audio to the Gemini API for transcription
  - Returns the transcribed text to the client
  
- **Express.js Route**: The route `/transcribe` processes the audio input and returns the transcription.

## Running the Application

To start the application:

```bash
npm run start
```

or

```bash
npm run start:dev
```

The server will start and listen on the port specified in the `.env` file or default to `PORT=6021`.

### Sample Request

You can send audio data to the `/transcribe` endpoint using a client that can send audio files or streams. Ensure that the audio format is compatible with the Gemini API requirements.
