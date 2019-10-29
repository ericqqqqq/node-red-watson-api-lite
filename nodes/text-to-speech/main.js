const TextToSpeechV1 = require("ibm-watson/text-to-speech/v1");
const { IamAuthenticator } = require("ibm-watson/auth");

module.exports = function(RED) {
  function WatsonSpeechToText(config) {
    RED.nodes.createNode(this, config);
    this.apikey = config.apikey;
    this.url = config.url;
    var node = this;
    node.on("input", main);

    function main(msg) {
      const textToSpeech = new TextToSpeechV1({
        authenticator: new IamAuthenticator({
          apikey: node.apikey
        }),
        url: this.url
      });

      const params = {
        text: msg.payload.text,
        voice: "en-US_AllisonVoice",
        accept: "audio/wav"
      };

      textToSpeech
        .synthesize(params)
        .then(response => {
          const audio = response.result;
          return textToSpeech.repairWavHeaderStream(audio);
        })
        .then(repairedFile => {
          msg.payload = repairedFile;
          node.send(msg);
        })
        .catch(err => {
          msg.payload = {
            status: err.code,
            message: err.message,
            body: err.body
          };
          node.send(msg);
        });
    }
  }
  RED.nodes.registerType("watson-text-to-speech-lite", WatsonSpeechToText);
};
