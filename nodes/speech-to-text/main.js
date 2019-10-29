"use strict";
const fs = require("fs");
const mic = require("mic");
const wav = require("wav");
const SpeechToTextV1 = require("ibm-watson/speech-to-text/v1");
const { IamAuthenticator } = require("ibm-watson/auth");

let micInstance = null;
let error = null;
const nodeStart = { fill: "red", shape: "ring", text: "recording" };
const nodeStop = { fill: "green", shape: "dot", text: "stopping" };

module.exports = function(RED) {
  function WatsonSpeechToText(config) {
    RED.nodes.createNode(this, config);
    this.apikey = config.apikey;
    this.url = config.url;
    const node = this;
    node.on("input", main);

    function main(msg) {
      const { payload } = msg;
      const mode = payload.mode || "start";

      if (micInstance) {
        if (mode === "stop") {
          micInstance.stop();
          msg.payload = { status: "200", msg: "mic is stopped" };

          return;
        }
        msg.payload = {
          status: "403",
          err: "node is running, only stop mode will work"
        };
        node.send(msg);

        return;
      }

      if (mode !== "start") {
        msg.payload = { status: "404", err: "please initilize the mic first" };
        node.send(msg);

        return;
      }

      const speechToText = new SpeechToTextV1({
        authenticator: new IamAuthenticator({
          apikey: node.apikey
        }),
        url: node.url
      });

      micInstance = mic({
        rate: "48000",
        channels: "1",
        debug: false,
        exitOnSilence: 20
      });

      const micInputStream = micInstance.getAudioStream();

      const wavStream = new wav.FileWriter("./audio.wav", {
        sampleRate: 48000,
        channels: 1
      });

      const recognizeStream = speechToText.recognizeUsingWebSocket({
        content_type: "audio.wav"
      });

      micInputStream.pipe(wavStream);
      wavStream.pipe(recognizeStream);
      recognizeStream.pipe(fs.createWriteStream("./transcription.txt"));

      micInputStream.on("startComplete", function() {
        node.status(nodeStart);
      });

      micInputStream.on("silence", function() {
        micInstance.stop();
      });

      micInputStream.on("stopComplete", function() {
        node.status(nodeStop);
        if (micInstance) {
          micInstance = null;
        }
      });

      recognizeStream.on("end", function() {
        if (!error) {
          const text = fs.readFileSync("./transcription.txt", "utf-8");
          msg.payload = {
            status: "200",
            text
          };
          node.send(msg);
        }
        node.status({});
        error = null;
      });

      recognizeStream.on("error", function(err) {
        error = true;
        micInstance.stop();

        msg.payload = {
          status: err.code,
          message: err.message,
          body: err.body
        };
        node.send(msg);
      });

      micInstance.start();
    }
  }
  RED.nodes.registerType("watson-speech-to-text-lite", WatsonSpeechToText);
};
