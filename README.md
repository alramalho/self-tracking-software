<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Tracking Software</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #f9f9f9;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 20px;
    }
    .emoji {
      font-size: 150px;
      line-height: 150px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 2.5rem;
      font-weight: bold;
      color: #333;
    }
    .highlight {
      color: #1e90ff;
    }
    .subtitle {
      font-size: 1.25rem;
      color: #666;
      margin-top: 10px;
    }
    .button {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      font-size: 1rem;
      color: #fff;
      background-color: #1e90ff;
      border: none;
      border-radius: 5px;
      text-decoration: none;
      transition: background-color 0.3s ease;
    }
    .button:hover {
      background-color: #1c86ee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🎯</div>
    <h1 class="title">
      Welcome to your <br>
      <span class="highlight">tracking.so<span style="color: #87cefa;">ftware</span></span>
    </h1>
    <p class="subtitle">An app that helps you achieve your activity goals, together.</p>
    <a href="https://app.tracking.so" class="button">Open App</a>
  </div>
</body>
</html>

<div class="iphone-frame">
  <div class="iphone-border">
    <img src="./assets/img1.png" alt="iPhone screenshot" class="iphone-content" />
    <div class="home-indicator"></div>
  </div>
</div>

<style>
  .iphone-frame {
    position: relative;
    margin: 0 auto;
  }
  .iphone-border {
    position: relative;
    border: 7px solid black;
    border-radius: 48px;
    background-color: white;
    overflow: hidden;
    width: 390px; /* iPhone width */
    height: 844px; /* iPhone height */
  }
  .iphone-content {
    width: 100%;
    height: auto;
  }
  .home-indicator {
    position: absolute;
    bottom: 1px;
    left: 50%;
    transform: translateX(-50%);
    width: 33%;
    height: 2px;
    background-color: black;
    border-radius: 1px;
  }
</style>
